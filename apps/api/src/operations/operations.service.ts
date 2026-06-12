import { Injectable } from '@nestjs/common';
import { MODULES, PERMISSIONS, ROLES, type TenantClient } from '@hms/db';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export interface WorkItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  patientId?: string | null;
  patientName?: string | null;
  module: string;
  priority: Priority;
  status: string;
  assignedRole?: string | null;
  assignedUser?: string | null;
  dueAt?: string | null;
  createdAt: string;
  actionHref: string;
  blocker?: string | null;
  help: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class OperationsService {
  private can(ctx: RequestContext, ...perms: string[]) {
    return perms.some((p) => ctx.permissions.has(p));
  }

  private hasModule(ctx: RequestContext, module: string) {
    return ctx.modules.has(module);
  }

  private broad(ctx: RequestContext) {
    return ctx.roles.includes(ROLES.HOSPITAL_ADMIN) || ctx.roles.includes(ROLES.HOSPITAL_MANAGER);
  }

  private iso(value: Date | string | null | undefined) {
    return value ? new Date(value).toISOString() : new Date().toISOString();
  }

  private startOfToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private endOfToday() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
  }

  async workQueue(ctx: RequestContext) {
    const db = requireDb(ctx);
    const groups = await Promise.all([
      this.setupItems(ctx, db),
      this.opdItems(ctx, db),
      this.labItems(ctx, db),
      this.pharmacyItems(ctx, db),
      this.inventoryItems(ctx, db),
      this.ipdItems(ctx, db),
      this.financeItems(ctx, db),
      this.billingItems(ctx, db),
      this.insuranceItems(ctx, db),
      this.notificationItems(ctx, db),
    ]);
    const items = groups
      .flat()
      .sort(
        (a, b) =>
          this.priorityRank(b.priority) - this.priorityRank(a.priority) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .slice(0, 80);
    return { generatedAt: new Date().toISOString(), roles: ctx.roles, items };
  }

  async summary(ctx: RequestContext) {
    const queue = await this.workQueue(ctx);
    const byPriority = this.countBy(queue.items, 'priority');
    const byModule = this.countBy(queue.items, 'module');
    const blockers = queue.items.filter((i) => i.blocker || i.priority === 'CRITICAL' || i.priority === 'HIGH').length;
    return { generatedAt: queue.generatedAt, total: queue.items.length, blockers, byPriority, byModule };
  }

  async blockers(ctx: RequestContext) {
    const queue = await this.workQueue(ctx);
    return {
      generatedAt: queue.generatedAt,
      items: queue.items.filter((i) => i.blocker || i.priority === 'CRITICAL' || i.priority === 'HIGH').slice(0, 30),
    };
  }

  async recentActivity(ctx: RequestContext) {
    const db = requireDb(ctx);
    const rows = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, action: true, entity: true, entityId: true, metadata: true, actorId: true, createdAt: true },
    });
    return {
      generatedAt: new Date().toISOString(),
      items: rows.map((r) => ({
        id: r.id,
        title: r.action.replace(/\./g, ' '),
        subtitle: r.entity,
        entityId: r.entityId,
        actorId: r.actorId,
        metadata: r.metadata,
        createdAt: this.iso(r.createdAt),
      })),
    };
  }

  private countBy<T extends Record<string, any>>(items: T[], key: keyof T) {
    return items.reduce(
      (acc, item) => {
        const value = String(item[key] ?? 'UNKNOWN');
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private priorityRank(priority: Priority) {
    return { LOW: 0, NORMAL: 1, HIGH: 2, CRITICAL: 3 }[priority];
  }

  private async setupItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (!this.can(ctx, PERMISSIONS.SETTINGS_READ, PERMISSIONS.STAFF_READ)) return [];
    const [departments, catalog, staff, providers] = await Promise.all([
      db.department.count({ where: { active: true } }),
      db.serviceCatalog.count({ where: { active: true } }),
      db.tenantUser.count({ where: { active: true } }),
      db.provider.count({ where: { active: true } }),
    ]);
    const now = new Date().toISOString();
    const items: WorkItem[] = [];
    if (departments === 0) {
      items.push(
        this.item(
          'setup-departments',
          'SETUP_BLOCKER',
          'Departments are not configured',
          'Add departments before assigning staff and appointments.',
          MODULES.ADMIN,
          'HIGH',
          'MISSING',
          '/admin/departments?new=1',
          now,
          'Appointments and providers need departments to route work correctly.',
          'Department setup controls routing for doctors, nurses, reception, and reporting.',
        ),
      );
    }
    if (catalog === 0) {
      items.push(
        this.item(
          'setup-catalog',
          'SETUP_BLOCKER',
          'Service catalog is empty',
          'Billing and IPD charges need catalog/service prices.',
          MODULES.ADMIN,
          'HIGH',
          'MISSING',
          '/admin/catalog?new=1',
          now,
          'Bills may need manual items until catalog is configured.',
          'Catalog items keep pricing consistent across OPD, IPD, lab, and manual billing.',
        ),
      );
    }
    if (staff === 0) {
      items.push(
        this.item(
          'setup-staff',
          'SETUP_BLOCKER',
          'No active staff yet',
          'Invite staff and assign tenant roles.',
          MODULES.ADMIN,
          'HIGH',
          'MISSING',
          '/admin/staff?new=1',
          now,
          'Work queues stay empty until staff can access workflows.',
          'Staff roles control what each team member can see and do.',
        ),
      );
    }
    if (providers === 0 && this.hasModule(ctx, MODULES.OPD)) {
      items.push(
        this.item(
          'setup-providers',
          'SETUP_BLOCKER',
          'No active providers',
          'Invite doctors or nurses and assign departments.',
          MODULES.ADMIN,
          'NORMAL',
          'MISSING',
          '/admin/staff?new=1',
          now,
          'Consultations and IPD rounds need provider profiles.',
          'Doctor and Nurse roles create provider profiles when a department is selected.',
        ),
      );
    }
    return items;
  }

  private async opdItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (
      !this.hasModule(ctx, MODULES.OPD) ||
      !this.can(ctx, PERMISSIONS.QUEUE_READ, PERMISSIONS.ENCOUNTER_READ, PERMISSIONS.APPOINTMENT_READ)
    )
      return [];
    const start = this.startOfToday();
    const end = this.endOfToday();
    const providerOnly = ctx.roles.includes(ROLES.DOCTOR) && !this.broad(ctx) && ctx.providerId;
    const [encounters, appointments] = await Promise.all([
      this.can(ctx, PERMISSIONS.QUEUE_READ, PERMISSIONS.ENCOUNTER_READ)
        ? db.encounter.findMany({
            where: {
              status: { in: ['CHECKED_IN', 'IN_PROGRESS'] as any },
              ...(providerOnly ? { providerId: ctx.providerId! } : {}),
            },
            include: { patient: { select: { id: true, fullName: true, mrn: true } } },
            orderBy: { createdAt: 'asc' },
            take: 20,
          })
        : Promise.resolve([]),
      this.can(ctx, PERMISSIONS.APPOINTMENT_READ)
        ? db.appointment.findMany({
            where: { scheduledAt: { gte: start, lte: end }, status: { in: ['SCHEDULED', 'CHECKED_IN'] as any } },
            include: { patient: { select: { id: true, fullName: true, mrn: true } } },
            orderBy: { scheduledAt: 'asc' },
            take: 20,
          })
        : Promise.resolve([]),
    ]);
    return [
      ...encounters.map((e: any) => {
        const waitingMinutes = Math.max(0, Math.round((Date.now() - new Date(e.createdAt).getTime()) / 60000));
        const canOpenConsult =
          e.status === 'IN_PROGRESS' &&
          this.can(ctx, PERMISSIONS.CONSULTATION_WRITE) &&
          (ctx.roles.includes(ROLES.DOCTOR) || this.broad(ctx));
        const actionHref = canOpenConsult ? `/doctor/consult/${e.id}` : '/opd';
        return this.item(
          `opd-${e.id}`,
          'OPD_QUEUE',
          e.status === 'IN_PROGRESS'
            ? `Consultation in progress: ${e.patient?.fullName ?? 'Patient'}`
            : `Patient waiting: ${e.patient?.fullName ?? 'Patient'}`,
          `Token ${e.tokenNumber ?? '-'} · ${e.chiefComplaint || 'Consultation'} · ${waitingMinutes} min`,
          MODULES.OPD,
          waitingMinutes >= 45 ? 'HIGH' : 'NORMAL',
          e.status,
          actionHref,
          this.iso(e.createdAt),
          waitingMinutes >= 45 ? 'Waiting time is above 45 minutes.' : null,
          'Checked-in patients appear here until a doctor starts and completes the consultation.',
          { tokenNumber: e.tokenNumber, waitingMinutes },
          e.patient?.id,
          e.patient?.fullName,
        );
      }),
      ...appointments.map((a: any) =>
        this.item(
          `appointment-${a.id}`,
          'APPOINTMENT_TODAY',
          `Appointment due: ${a.patient?.fullName ?? 'Patient'}`,
          `${new Date(a.scheduledAt).toLocaleTimeString()} · ${a.reason || 'Scheduled visit'}`,
          MODULES.SCHEDULING,
          new Date(a.scheduledAt).getTime() < Date.now() ? 'HIGH' : 'NORMAL',
          a.status,
          '/opd/appointments',
          this.iso(a.scheduledAt),
          new Date(a.scheduledAt).getTime() < Date.now()
            ? 'Appointment time has passed; check in or reschedule.'
            : null,
          'Today’s scheduled appointments help reception keep check-in moving.',
          {},
          a.patient?.id,
          a.patient?.fullName,
        ),
      ),
    ];
  }

  private async labItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (!this.hasModule(ctx, MODULES.LAB) || !this.can(ctx, PERMISSIONS.LAB_READ)) return [];
    const [orders, abnormal] = await Promise.all([
      db.labOrder.findMany({
        where: { status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING'] as any } },
        include: { patient: { select: { id: true, fullName: true, mrn: true } }, items: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      }),
      db.labResult.findMany({
        where: { isVerified: false, abnormalFlag: { in: ['HIGH', 'LOW', 'CRITICAL'] as any } },
        include: {
          labOrderItem: {
            include: { labOrder: { include: { patient: { select: { id: true, fullName: true, mrn: true } } } } },
          },
        },
        orderBy: { recordedAt: 'asc' },
        take: 15,
      }),
    ]);
    return [
      ...orders.map((o: any) => {
        const label =
          o.status === 'ORDERED'
            ? 'Sample pending'
            : o.status === 'SAMPLE_COLLECTED'
              ? 'Processing pending'
              : 'Result pending';
        return this.item(
          `lab-order-${o.id}`,
          'LAB_LIFECYCLE',
          `${label}: ${o.patient?.fullName ?? 'Patient'}`,
          `${(o.items ?? []).map((i: any) => i.testName).join(', ') || 'Lab tests'}`,
          MODULES.LAB,
          o.status === 'ORDERED' ? 'HIGH' : 'NORMAL',
          o.status,
          `/lab/orders/${o.id}`,
          this.iso(o.createdAt),
          o.status === 'ORDERED' ? 'Sample has not been collected yet.' : null,
          'Lab orders move from sample collection to processing, result entry, verification, and report printing.',
          { itemCount: o.items?.length ?? 0 },
          o.patient?.id,
          o.patient?.fullName,
        );
      }),
      ...abnormal.map((r: any) =>
        this.item(
          `lab-result-${r.id}`,
          'CRITICAL_LAB_RESULT',
          `${r.abnormalFlag} lab result needs verification`,
          `${r.testName} · ${r.labOrderItem?.labOrder?.patient?.fullName ?? 'Patient'}`,
          MODULES.LAB,
          r.abnormalFlag === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
          'UNVERIFIED',
          `/lab/orders/${r.labOrderItem?.labOrder?.id}`,
          this.iso(r.recordedAt),
          'Abnormal result is not verified yet.',
          'Abnormal results stay visible until a permitted lab user verifies them.',
          { abnormalFlag: r.abnormalFlag, value: r.value, unit: r.unit },
          r.labOrderItem?.labOrder?.patient?.id,
          r.labOrderItem?.labOrder?.patient?.fullName,
        ),
      ),
    ];
  }

  private async pharmacyItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (
      !this.hasModule(ctx, MODULES.PHARMACY) ||
      !this.can(ctx, PERMISSIONS.PHARMACY_READ, PERMISSIONS.PRESCRIPTION_READ)
    )
      return [];
    const [rxs, partials] = await Promise.all([
      db.prescription.findMany({
        where: { status: 'FINALIZED' as any },
        include: {
          encounter: { include: { patient: { select: { id: true, fullName: true, mrn: true } } } },
          items: true,
        },
        orderBy: { finalizedAt: 'asc' },
        take: 20,
      }),
      db.dispenseRecord.findMany({ where: { status: 'PARTIAL' as any }, orderBy: { createdAt: 'asc' }, take: 10 }),
    ]);
    return [
      ...rxs.map((rx: any) =>
        this.item(
          `rx-${rx.id}`,
          'PHARMACY_DISPENSE',
          `Prescription ready: ${rx.encounter?.patient?.fullName ?? 'Patient'}`,
          `${rx.items?.length ?? 0} medication(s) waiting to dispense`,
          MODULES.PHARMACY,
          'NORMAL',
          rx.status,
          `/pharmacy/dispense/${rx.id}`,
          this.iso(rx.finalizedAt ?? rx.createdAt),
          null,
          'Finalized prescriptions appear here until pharmacy dispenses or marks partial stock.',
          { itemCount: rx.items?.length ?? 0 },
          rx.encounter?.patient?.id,
          rx.encounter?.patient?.fullName,
        ),
      ),
      ...partials.map((d: any) =>
        this.item(
          'dispense-partial-' + d.id,
          'PARTIAL_DISPENSE',
          'Partial pharmacy dispense needs follow-up',
          'Review missing stock or patient pickup.',
          MODULES.PHARMACY,
          'HIGH',
          d.status,
          `/pharmacy/dispense/${d.prescriptionId}`,
          this.iso(d.createdAt),
          'Prescription was only partially dispensed.',
          'Partial dispense remains open until stock or clinical decision resolves the prescription.',
          { prescriptionId: d.prescriptionId },
          d.patientId,
          null,
        ),
      ),
    ];
  }

  private async inventoryItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (
      !this.hasModule(ctx, MODULES.INVENTORY) ||
      !this.can(ctx, PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_REPORTS_READ)
    )
      return [];
    const soon = new Date(Date.now() + 30 * 86400000);
    const [items, batches, purchases] = await Promise.all([
      db.inventoryItem.findMany({
        where: { active: true },
        include: { batches: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      db.inventoryBatch.findMany({
        where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: soon } },
        include: { item: true },
        orderBy: { expiryDate: 'asc' },
        take: 20,
      }),
      db.purchaseOrder.findMany({
        where: { status: { in: ['DRAFT', 'ORDERED'] as any } },
        include: { supplier: true, items: true },
        orderBy: { createdAt: 'asc' },
        take: 15,
      }),
    ]);
    const low = items
      .map((it: any) => ({
        item: it,
        qty: (it.batches ?? []).reduce((sum: number, b: any) => sum + (b.quantity ?? 0), 0),
      }))
      .filter((row) => row.qty <= row.item.lowStockThreshold)
      .slice(0, 20);
    return [
      ...low.map((row) =>
        this.item(
          `stock-${row.item.id}`,
          'LOW_STOCK',
          `${row.item.name} is ${row.qty <= 0 ? 'out of stock' : 'low stock'}`,
          `${row.qty} ${row.item.unit} available · reorder level ${row.item.lowStockThreshold}`,
          MODULES.INVENTORY,
          row.qty <= 0 ? 'CRITICAL' : 'HIGH',
          row.qty <= 0 ? 'OUT' : 'LOW',
          `/inventory/items`,
          this.iso(row.item.createdAt),
          'Available quantity is at or below reorder level.',
          'Low stock appears when total available quantity is below the configured reorder threshold.',
          { itemId: row.item.id, quantity: row.qty, threshold: row.item.lowStockThreshold },
        ),
      ),
      ...batches.map((b: any) =>
        this.item(
          `expiry-${b.id}`,
          'EXPIRY_RISK',
          `${b.item?.name ?? 'Item'} batch expiring`,
          `${b.batchNumber} · ${b.quantity} units · ${new Date(b.expiryDate).toLocaleDateString()}`,
          MODULES.INVENTORY,
          new Date(b.expiryDate).getTime() < Date.now() ? 'CRITICAL' : 'HIGH',
          'EXPIRING',
          '/inventory',
          this.iso(b.expiryDate),
          'Batch should be reviewed before use or write-off.',
          'Expiry alerts show batches expiring in the next 30 days or already expired.',
          { batchId: b.id, itemId: b.itemId },
        ),
      ),
      ...purchases.map((po: any) =>
        this.item(
          `po-${po.id}`,
          'PO_RECEIVE',
          `Purchase order ${po.status.toLowerCase()} with ${po.supplier?.name ?? 'supplier'}`,
          `${po.items?.length ?? 0} line item(s)`,
          MODULES.INVENTORY,
          po.status === 'ORDERED' ? 'NORMAL' : 'LOW',
          po.status,
          `/inventory/purchases/${po.id}`,
          this.iso(po.createdAt),
          po.status === 'ORDERED' ? 'Goods have not been received yet.' : null,
          'Purchase orders become stock only after goods receipt creates batches and ledger entries.',
          { supplierId: po.supplierId },
        ),
      ),
    ];
  }

  private async ipdItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (!this.hasModule(ctx, MODULES.IPD) || !this.can(ctx, PERMISSIONS.IPD_READ, PERMISSIONS.NURSING_READ)) return [];
    const [admissions, meds] = await Promise.all([
      db.admission.findMany({
        where: { status: 'ADMITTED' as any },
        include: { patient: { select: { id: true, fullName: true, mrn: true } }, bed: { include: { ward: true } } },
        orderBy: { admittedAt: 'asc' },
        take: 25,
      }),
      this.can(ctx, PERMISSIONS.NURSING_READ, PERMISSIONS.MEDICATION_ADMINISTER)
        ? db.medicationAdministration.findMany({
            where: { status: { in: ['MISSED', 'REFUSED', 'HELD'] as any } },
            orderBy: { administeredAt: 'desc' },
            take: 15,
          })
        : Promise.resolve([]),
    ]);
    return [
      ...admissions.map((a: any) =>
        this.item(
          `ipd-${a.id}`,
          'IPD_CARE',
          `IPD patient active: ${a.patient?.fullName ?? 'Patient'}`,
          `${a.bed?.ward?.name ?? 'Ward'} / ${a.bed?.bedNumber ?? 'Bed'} · admitted ${new Date(a.admittedAt).toLocaleDateString()}`,
          MODULES.IPD,
          'NORMAL',
          a.status,
          ctx.roles.includes(ROLES.NURSE) && !this.broad(ctx) ? `/nursing/ipd/${a.id}` : `/ipd/admissions/${a.id}`,
          this.iso(a.admittedAt),
          a.expectedDischargeAt && new Date(a.expectedDischargeAt).getTime() < Date.now()
            ? 'Expected discharge date has passed.'
            : null,
          'Active admissions appear until discharge is completed and the bed is released.',
          { bedId: a.bedId, expectedDischargeAt: a.expectedDischargeAt },
          a.patient?.id,
          a.patient?.fullName,
        ),
      ),
      ...meds.map((m: any) =>
        this.item(
          `med-${m.id}`,
          'MEDICATION_ALERT',
          `Medication ${m.status.toLowerCase()}`,
          'Review MAR notes and patient status.',
          MODULES.IPD,
          m.status === 'MISSED' ? 'HIGH' : 'NORMAL',
          m.status,
          m.admissionId ? `/nursing/ipd/${m.admissionId}` : '/nursing',
          this.iso(m.administeredAt),
          m.status === 'MISSED' ? 'Medication was marked missed.' : null,
          'Medication exceptions need clinical review so the MAR remains accurate.',
          { medicationId: m.id },
          m.patientId,
          null,
        ),
      ),
    ];
  }

  private async billingItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (
      !this.hasModule(ctx, MODULES.BILLING) ||
      !this.can(ctx, PERMISSIONS.BILL_READ, PERMISSIONS.REPORTS_FINANCIAL_READ)
    )
      return [];
    const bills = await db.bill.findMany({
      where: { status: { in: ['UNPAID', 'PARTIAL'] as any } },
      include: { patient: { select: { id: true, fullName: true, mrn: true } }, payments: true, refunds: true },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    return bills.map((b: any) => {
      const paid = (b.payments ?? []).reduce((sum: number, p: any) => sum + p.amount, 0);
      const refunded = (b.refunds ?? []).reduce((sum: number, r: any) => sum + r.amount, 0);
      const due = Math.max(0, b.netAmount - (paid - refunded));
      return this.item(
        `bill-${b.id}`,
        'BILLING_RECEIVABLE',
        `${b.status === 'PARTIAL' ? 'Partial payment' : 'Unpaid bill'}: ${b.patient?.fullName ?? 'Patient'}`,
        `${b.billNumber} · due ${due}`,
        MODULES.BILLING,
        b.admissionId ? 'HIGH' : 'NORMAL',
        b.status,
        `/finance/bills/${b.id}`,
        this.iso(b.createdAt),
        b.admissionId ? 'IPD/discharge billing should be settled before financial closure.' : null,
        'Unpaid and partial bills remain in the work queue until payment or approved cancellation/refund resolves them.',
        { billNumber: b.billNumber, due },
        b.patient?.id,
        b.patient?.fullName,
      );
    });
  }

  private async financeItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (
      !this.hasModule(ctx, MODULES.BILLING) ||
      !this.can(ctx, PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ, PERMISSIONS.PAYMENT_COLLECT)
    )
      return [];
    const start = this.startOfToday();
    const [charges, approvals, dayClose] = await Promise.all([
      db.billableCharge.findMany({ where: { status: 'PENDING' as any }, orderBy: { createdAt: 'asc' }, take: 20 }),
      this.can(ctx, PERMISSIONS.FINANCE_APPROVAL_MANAGE)
        ? db.financeApproval.findMany({
            where: { status: 'PENDING' as any },
            orderBy: { requestedAt: 'asc' },
            take: 10,
          })
        : Promise.resolve([]),
      this.can(ctx, PERMISSIONS.FINANCE_DAY_CLOSE, PERMISSIONS.FINANCE_RECONCILE)
        ? db.financeDayClose.findFirst({ where: { businessDate: start }, orderBy: { closedAt: 'desc' } })
        : Promise.resolve(null),
    ]);
    const items = charges.map((c: any) =>
      this.item(
        `charge-${c.id}`,
        'PENDING_CHARGE',
        `Unbilled charge: ${c.name}`,
        `${c.sourceModule} · ${c.quantity} × ${c.unitPrice} · ${c.total}`,
        MODULES.BILLING,
        'HIGH',
        c.status,
        '/finance/pending-charges',
        this.iso(c.createdAt),
        'Charge has not been added to a bill yet.',
        'Pending charges are the financial inbox for OPD, lab, pharmacy, IPD, and manual services.',
        { chargeId: c.id, sourceModule: c.sourceModule, sourceId: c.sourceId },
        c.patientId,
        null,
      ),
    );
    items.push(
      ...approvals.map((a: any) =>
        this.item(
          `finance-approval-${a.id}`,
          'FINANCE_APPROVAL',
          `${String(a.type).replace(/_/g, ' ').toLowerCase()} approval pending`,
          a.reason,
          MODULES.BILLING,
          'HIGH',
          a.status,
          '/finance/approvals',
          this.iso(a.requestedAt),
          'Finance approval is waiting for a decision.',
          'Approvals keep refunds, write-offs, cancellations, and overrides auditable.',
          { approvalId: a.id, type: a.type, amount: a.amount },
        ),
      ),
    );
    if (!dayClose && this.can(ctx, PERMISSIONS.FINANCE_DAY_CLOSE, PERMISSIONS.FINANCE_RECONCILE)) {
      items.push(
        this.item(
          'finance-day-close-open',
          'DAY_CLOSE_OPEN',
          'Day close is not completed',
          'Close or review today’s finance counter totals.',
          MODULES.BILLING,
          'NORMAL',
          'OPEN',
          '/finance/day-close',
          new Date().toISOString(),
          'Daily finance reconciliation has not been closed yet.',
          'Day close compares payments, refunds, cancellations, and net collections for the business day.',
        ),
      );
    }
    return items;
  }

  private async insuranceItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (!this.hasModule(ctx, MODULES.INSURANCE) || !this.can(ctx, PERMISSIONS.INSURANCE_READ)) return [];
    const claims = await db.insuranceClaim.findMany({
      where: {
        status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as any },
      },
      include: {
        bill: { include: { patient: { select: { id: true, fullName: true, mrn: true } } } },
        patientPolicy: { include: { provider: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 25,
    });
    return claims.map((c: any) =>
      this.item(
        `claim-${c.id}`,
        'INSURANCE_CLAIM',
        c.status === 'REJECTED'
          ? `Rejected claim: ${c.bill?.patient?.fullName ?? 'Patient'}`
          : `Insurance claim ${c.status.toLowerCase()}`,
        `${c.patientPolicy?.provider?.name ?? 'Payer'} · ${c.bill?.billNumber ?? 'Bill'}`,
        MODULES.INSURANCE,
        c.status === 'REJECTED'
          ? 'HIGH'
          : c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED'
            ? 'NORMAL'
            : 'LOW',
        c.status,
        `/insurance/claims/${c.id}`,
        this.iso(c.createdAt),
        c.status === 'REJECTED'
          ? c.rejectionReason || 'Claim rejected and needs correction.'
          : c.status === 'APPROVED'
            ? 'Approved claim is not settled yet.'
            : null,
        'Claims move from draft to submitted, review, approval/rejection, and settlement.',
        { claimAmount: c.claimAmount, approvedAmount: c.approvedAmount },
        c.bill?.patient?.id,
        c.bill?.patient?.fullName,
      ),
    );
  }

  private async notificationItems(ctx: RequestContext, db: TenantClient): Promise<WorkItem[]> {
    if (!ctx.userId) return [];
    const rows = await db.notification.findMany({
      where: {
        readAt: null,
        archivedAt: null,
        severity: { in: ['WARNING', 'CRITICAL'] as any },
        OR: [{ recipientUserId: ctx.userId }, { recipientUserId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    return rows.map((n: any) =>
      this.item(
        `notification-${n.id}`,
        'NOTIFICATION',
        n.title,
        n.message,
        'SYSTEM',
        n.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        n.severity,
        n.actionUrl || '/notifications',
        this.iso(n.createdAt),
        'High-priority notification is unread.',
        'Unread high-priority notifications appear here until read or archived.',
        { category: n.category, type: n.type },
      ),
    );
  }

  private item(
    id: string,
    type: string,
    title: string,
    subtitle: string,
    module: string,
    priority: Priority,
    status: string,
    actionHref: string,
    createdAt: string,
    blocker: string | null,
    help: string,
    metadata: Record<string, unknown> = {},
    patientId: string | null = null,
    patientName: string | null = null,
  ): WorkItem {
    return {
      id,
      type,
      title,
      subtitle,
      module,
      priority,
      status,
      actionHref,
      createdAt,
      blocker,
      help,
      metadata,
      patientId,
      patientName,
    };
  }
}
