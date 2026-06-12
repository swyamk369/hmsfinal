import { ForbiddenException, Injectable } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import type { TenantClient } from '@hms/db';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import type { ReportQueryDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
}

const DAY_MS = 86400000;

@Injectable()
export class ReportsService {
  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId! };
  }

  private hasModule(ctx: RequestContext, module: string): boolean {
    return ctx.modules.has(module);
  }

  private can(ctx: RequestContext, ...perms: string[]): boolean {
    return perms.some((p) => ctx.permissions.has(p));
  }

  private requireModule(ctx: RequestContext, module: string) {
    if (!this.hasModule(ctx, module)) throw new ForbiddenException(`Module ${module} not enabled`);
  }

  private range(q?: ReportQueryDto) {
    const end = q?.endDate ? new Date(q.endDate) : new Date();
    end.setHours(23, 59, 59, 999);
    const start = q?.startDate ? new Date(q.startDate) : new Date(end.getTime() - 29 * DAY_MS);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  private today() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private countBy<T extends Record<string, any>>(rows: T[], key: keyof T): Record<string, number> {
    return rows.reduce(
      (acc, row) => {
        const value = String(row[key] ?? 'UNKNOWN');
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private byDate(rows: { createdAt?: Date | string; scheduledAt?: Date | string; admittedAt?: Date | string }[]) {
    const map = new Map<string, number>();
    for (const row of rows) {
      const raw = row.createdAt ?? row.scheduledAt ?? row.admittedAt;
      if (!raw) continue;
      const key = new Date(raw).toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }

  private sum(
    rows: { amount?: number | null; netAmount?: number | null; total?: number | null }[],
    key: 'amount' | 'netAmount' | 'total',
  ) {
    return rows.reduce((acc, row) => acc + (row[key] ?? 0), 0);
  }

  async dashboard(ctx: RequestContext) {
    const s = this.scope(ctx);
    const { start, end } = this.today();
    const generatedAt = new Date().toISOString();

    const setup = this.can(ctx, PERMISSIONS.SETTINGS_READ, PERMISSIONS.STAFF_READ)
      ? await this.setupSummary(s.db)
      : null;
    const opd =
      this.hasModule(ctx, MODULES.OPD) && this.can(ctx, PERMISSIONS.QUEUE_READ, PERMISSIONS.APPOINTMENT_READ)
        ? await this.opdToday(s.db, start, end, ctx.providerId)
        : null;
    const billing =
      this.hasModule(ctx, MODULES.BILLING) && this.can(ctx, PERMISSIONS.BILL_READ, PERMISSIONS.REPORTS_FINANCIAL_READ)
        ? await this.billingToday(s.db, start, end)
        : null;
    const lab =
      this.hasModule(ctx, MODULES.LAB) && this.can(ctx, PERMISSIONS.LAB_READ)
        ? await this.labSummary(s.db, start)
        : null;
    const pharmacy =
      this.hasModule(ctx, MODULES.PHARMACY) && this.can(ctx, PERMISSIONS.PHARMACY_READ)
        ? await this.pharmacySummary(s.db, start)
        : null;
    const inventory =
      this.hasModule(ctx, MODULES.INVENTORY) &&
      this.can(ctx, PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_REPORTS_READ)
        ? await this.inventorySummary(s.db)
        : null;
    const ipd =
      this.hasModule(ctx, MODULES.IPD) && this.can(ctx, PERMISSIONS.IPD_READ)
        ? await this.ipdSummary(s.db, start)
        : null;
    const nursing =
      this.hasModule(ctx, MODULES.IPD) && this.can(ctx, PERMISSIONS.NURSING_READ)
        ? await this.nursingSummary(s.db, start)
        : null;
    const insurance =
      this.hasModule(ctx, MODULES.INSURANCE) && this.can(ctx, PERMISSIONS.INSURANCE_READ)
        ? await this.insuranceSummary(s.db, start)
        : null;

    return {
      generatedAt,
      roles: ctx.roles,
      enabledModules: [...ctx.modules],
      setup,
      opd,
      billing,
      lab,
      pharmacy,
      inventory,
      ipd,
      nursing,
      insurance,
      alerts: this.alerts({ billing, lab, pharmacy, inventory, ipd, insurance }),
    };
  }

  async manager(ctx: RequestContext) {
    const dashboard = await this.dashboard(ctx);
    return {
      ...dashboard,
      commandCenter: {
        opdVolume: dashboard.opd?.todayEncounters ?? 0,
        consultationCompletionRate: dashboard.opd?.completionRate ?? 0,
        revenueCollectedToday: dashboard.billing?.paidToday ?? 0,
        outstandingReceivables: dashboard.billing?.outstandingReceivables ?? 0,
        openInsuranceReceivables: dashboard.insurance?.approvedOutstanding ?? 0,
        occupiedBeds: dashboard.ipd?.occupiedBeds ?? 0,
      },
    };
  }

  async operations(ctx: RequestContext, q: ReportQueryDto) {
    const { db } = this.scope(ctx);
    const { start, end } = this.range(q);
    const [patients, appointments, encounters] = await Promise.all([
      db.patient.findMany({
        where: { createdAt: { gte: start, lte: end }, deletedAt: null },
        select: { id: true, createdAt: true },
      }),
      db.appointment.findMany({
        where: { scheduledAt: { gte: start, lte: end } },
        select: { id: true, status: true, scheduledAt: true },
      }),
      db.encounter.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(q.departmentId ? { departmentId: q.departmentId } : {}),
          ...(q.providerId ? { providerId: q.providerId } : {}),
          ...(q.status ? { status: q.status as any } : {}),
        },
        select: { id: true, type: true, status: true, createdAt: true, endedAt: true },
      }),
    ]);
    const labOrders =
      this.hasModule(ctx, MODULES.LAB) && this.can(ctx, PERMISSIONS.LAB_READ)
        ? await db.labOrder.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { id: true, status: true, createdAt: true },
          })
        : [];
    const dispenses =
      this.hasModule(ctx, MODULES.PHARMACY) && this.can(ctx, PERMISSIONS.PHARMACY_READ)
        ? await db.dispenseRecord.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { id: true, status: true, createdAt: true },
          })
        : [];
    const admissions =
      this.hasModule(ctx, MODULES.IPD) && this.can(ctx, PERMISSIONS.IPD_READ)
        ? await db.admission.findMany({
            where: { admittedAt: { gte: start, lte: end } },
            select: { id: true, status: true, admittedAt: true, dischargedAt: true },
          })
        : [];

    return {
      generatedAt: new Date().toISOString(),
      range: { start, end },
      totals: {
        registrations: patients.length,
        appointments: appointments.length,
        encounters: encounters.length,
        consultationsCompleted: encounters.filter((e) => e.status === 'COMPLETED').length,
        labOrders: labOrders.length,
        dispenses: dispenses.length,
        admissions: admissions.length,
        discharges: admissions.filter((a) => !!a.dischargedAt || a.status === 'DISCHARGED').length,
      },
      registrationsByDate: this.byDate(patients),
      appointmentStatus: this.countBy(appointments, 'status'),
      encounterStatus: this.countBy(encounters, 'status'),
      encounterType: this.countBy(encounters, 'type'),
      labStatus: this.countBy(labOrders, 'status'),
      pharmacyStatus: this.countBy(dispenses, 'status'),
      admissionStatus: this.countBy(admissions, 'status'),
      rows: [
        ...appointments.slice(0, 60).map((a) => ({ type: 'Appointment', status: a.status, date: a.scheduledAt })),
        ...encounters.slice(0, 60).map((e) => ({ type: 'Encounter', status: e.status, date: e.createdAt })),
        ...labOrders.slice(0, 60).map((o) => ({ type: 'Lab order', status: o.status, date: o.createdAt })),
        ...dispenses.slice(0, 60).map((d) => ({ type: 'Pharmacy dispense', status: d.status, date: d.createdAt })),
      ].sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime()),
    };
  }

  async financial(ctx: RequestContext, q: ReportQueryDto) {
    const { db } = this.scope(ctx);
    const { start, end } = this.range(q);
    const [bills, payments, refunds] = await Promise.all([
      db.bill.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(q.billStatus ? { status: q.billStatus as any } : {}),
        },
        include: { payments: true, refunds: true, patient: { select: { fullName: true, mrn: true } } },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      db.payment.findMany({
        where: { createdAt: { gte: start, lte: end }, ...(q.paymentMethod ? { method: q.paymentMethod as any } : {}) },
        select: { id: true, amount: true, method: true, createdAt: true },
      }),
      db.refund.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { id: true, amount: true, createdAt: true },
      }),
    ]);
    const insurance =
      this.hasModule(ctx, MODULES.INSURANCE) && this.can(ctx, PERMISSIONS.INSURANCE_READ)
        ? await db.insuranceClaim.findMany({
            where: { createdAt: { gte: start, lte: end } },
            include: { settlements: true, bill: { include: { patient: { select: { fullName: true, mrn: true } } } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
          })
        : [];

    const paidByBill = new Map<string, number>();
    const refundedByBill = new Map<string, number>();
    for (const b of bills) {
      paidByBill.set(
        b.id,
        b.payments.reduce((sum, p) => sum + p.amount, 0),
      );
      refundedByBill.set(
        b.id,
        b.refunds.reduce((sum, r) => sum + r.amount, 0),
      );
    }
    const outstanding = bills.reduce(
      (sum, b) => sum + Math.max(0, b.netAmount - ((paidByBill.get(b.id) ?? 0) - (refundedByBill.get(b.id) ?? 0))),
      0,
    );
    const settlementTotal = insurance.flatMap((c) => c.settlements).reduce((sum, s) => sum + s.amount, 0);

    return {
      generatedAt: new Date().toISOString(),
      range: { start, end },
      totals: {
        totalBilled: bills.reduce((sum, b) => sum + b.netAmount, 0),
        totalCollected: this.sum(payments, 'amount'),
        outstandingReceivables: outstanding,
        refunds: this.sum(refunds, 'amount'),
        insuranceClaimed: insurance.reduce((sum, c) => sum + c.claimAmount, 0),
        insuranceApproved: insurance.reduce((sum, c) => sum + (c.approvedAmount ?? 0), 0),
        insuranceSettled: settlementTotal,
        patientShare: insurance.reduce((sum, c) => sum + (c.patientShare ?? 0), 0),
      },
      billStatus: this.countBy(bills, 'status'),
      paymentMethod: this.countBy(payments, 'method'),
      insuranceStatus: this.countBy(insurance, 'status'),
      rows: bills.map((b) => ({
        billNumber: b.billNumber,
        patient: b.patient?.fullName ?? 'Patient',
        status: b.status,
        billed: b.netAmount,
        collected: paidByBill.get(b.id) ?? 0,
        refunded: refundedByBill.get(b.id) ?? 0,
        outstanding: Math.max(0, b.netAmount - ((paidByBill.get(b.id) ?? 0) - (refundedByBill.get(b.id) ?? 0))),
        date: b.createdAt,
      })),
      insuranceRows: insurance.map((c) => ({
        claimId: c.id,
        billNumber: c.bill?.billNumber,
        patient: c.bill?.patient?.fullName ?? 'Patient',
        status: c.status,
        claimAmount: c.claimAmount,
        approvedAmount: c.approvedAmount ?? 0,
        patientShare: c.patientShare ?? 0,
        settled: c.settlements.reduce((sum, s) => sum + s.amount, 0),
        date: c.createdAt,
      })),
    };
  }

  async inventory(ctx: RequestContext, q: ReportQueryDto) {
    this.requireModule(ctx, MODULES.INVENTORY);
    const { db } = this.scope(ctx);
    const { start, end } = this.range(q);
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * DAY_MS);
    const [items, batches, transactions, purchases, suppliers] = await Promise.all([
      db.inventoryItem.findMany({
        where: { active: true, ...(q.itemId ? { id: q.itemId } : {}) },
        include: { batches: true },
        orderBy: { name: 'asc' },
      }),
      db.inventoryBatch.findMany({
        where: { ...(q.itemId ? { itemId: q.itemId } : {}), ...(q.supplierId ? { supplierId: q.supplierId } : {}) },
        orderBy: { expiryDate: 'asc' },
        take: 300,
      }),
      db.inventoryTransaction.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(q.itemId ? { itemId: q.itemId } : {}),
          ...(q.transactionType ? { type: q.transactionType as any } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      db.purchaseOrder.findMany({
        where: { createdAt: { gte: start, lte: end }, ...(q.supplierId ? { supplierId: q.supplierId } : {}) },
        include: { items: true, supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      db.supplier.findMany({ orderBy: { name: 'asc' }, take: 200 }),
    ]);
    const itemById = new Map(items.map((i) => [i.id, i]));
    const lowStock = items
      .map((it) => {
        const totalStock = it.batches.reduce((sum, b) => sum + b.quantity, 0);
        return { id: it.id, name: it.name, totalStock, threshold: it.lowStockThreshold };
      })
      .filter((it) => it.totalStock <= it.threshold);
    const expiring = batches.filter((b) => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) <= horizon);
    const expired = batches.filter((b) => b.quantity > 0 && b.expiryDate && new Date(b.expiryDate) < now);

    return {
      generatedAt: new Date().toISOString(),
      range: { start, end },
      totals: {
        itemCount: items.length,
        stockValue: batches.reduce((sum, b) => sum + b.quantity * b.salePrice, 0),
        lowStock: lowStock.length,
        expiring: expiring.length,
        expired: expired.length,
        stockInQuantity: transactions.filter((t) => t.type === 'STOCK_IN').reduce((sum, t) => sum + t.quantity, 0),
        adjustmentQuantity: transactions.filter((t) => t.type === 'ADJUSTMENT').reduce((sum, t) => sum + t.quantity, 0),
        pendingPurchases: purchases.filter((p) => p.status === 'DRAFT' || p.status === 'ORDERED').length,
      },
      transactionType: this.countBy(transactions, 'type'),
      purchaseStatus: this.countBy(purchases, 'status'),
      supplierSummary: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        active: s.active,
        purchaseOrders: purchases.filter((p) => p.supplierId === s.id).length,
      })),
      lowStock,
      expiringBatches: expiring.map((b) => ({
        id: b.id,
        item: itemById.get(b.itemId)?.name ?? b.itemId,
        batchNumber: b.batchNumber,
        quantity: b.quantity,
        expiryDate: b.expiryDate,
        expired: !!b.expiryDate && new Date(b.expiryDate) < now,
      })),
      rows: transactions.map((t) => ({
        id: t.id,
        item: itemById.get(t.itemId)?.name ?? t.itemId,
        type: t.type,
        quantity: t.quantity,
        reason: t.reason,
        date: t.createdAt,
      })),
      purchaseRows: purchases.map((p) => ({
        id: p.id,
        supplier: p.supplier?.name ?? 'Supplier',
        status: p.status,
        quantity: p.items.reduce((sum, i) => sum + i.quantity, 0),
        value: p.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
        date: p.createdAt,
      })),
    };
  }

  async clinical(ctx: RequestContext, q: ReportQueryDto) {
    const { db } = this.scope(ctx);
    const { start, end } = this.range(q);
    const encounterWhere: any = {
      createdAt: { gte: start, lte: end },
      ...(q.providerId ? { providerId: q.providerId } : {}),
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
    };
    const [encounters, diagnoses, vitals, prescriptions, labResults] = await Promise.all([
      db.encounter.findMany({
        where: encounterWhere,
        select: { id: true, status: true, type: true, createdAt: true, providerId: true },
      }),
      db.diagnosis.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          encounter: q.providerId || q.departmentId ? encounterWhere : undefined,
        },
        select: { id: true, description: true, icdCode: true, type: true, createdAt: true },
      }),
      db.vitals.findMany({
        where: {
          recordedAt: { gte: start, lte: end },
          encounter: q.providerId || q.departmentId ? encounterWhere : undefined,
        },
        select: { id: true, recordedAt: true },
      }),
      db.prescription.findMany({
        where: { createdAt: { gte: start, lte: end }, ...(q.providerId ? { providerId: q.providerId } : {}) },
        select: { id: true, status: true, finalizedAt: true, createdAt: true },
      }),
      this.hasModule(ctx, MODULES.LAB) && this.can(ctx, PERMISSIONS.LAB_READ)
        ? db.labResult.findMany({
            where: { recordedAt: { gte: start, lte: end } },
            select: { id: true, abnormalFlag: true, testName: true, recordedAt: true, isVerified: true },
          })
        : Promise.resolve([]),
    ]);
    const ipdRounds =
      this.hasModule(ctx, MODULES.IPD) && this.can(ctx, PERMISSIONS.IPD_READ)
        ? await db.ipdRound.findMany({
            where: { createdAt: { gte: start, lte: end }, ...(q.providerId ? { providerId: q.providerId } : {}) },
            select: { id: true, createdAt: true },
          })
        : [];
    const dischargeSummaries =
      this.hasModule(ctx, MODULES.IPD) && this.can(ctx, PERMISSIONS.IPD_READ)
        ? await db.dischargeSummary.findMany({
            where: { createdAt: { gte: start, lte: end } },
            select: { id: true, finalizedAt: true, createdAt: true },
          })
        : [];
    const diagnosisCounts = diagnoses.reduce(
      (acc, d) => {
        const key = d.icdCode || d.description;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return {
      generatedAt: new Date().toISOString(),
      range: { start, end },
      totals: {
        consultationsCompleted: encounters.filter((e) => e.status === 'COMPLETED').length,
        vitalsRecorded: vitals.length,
        prescriptionsFinalized: prescriptions.filter((p) => p.status === 'FINALIZED' || p.finalizedAt).length,
        labAbnormalResults: labResults.filter((r) => r.abnormalFlag !== 'NORMAL').length,
        ipdRounds: ipdRounds.length,
        dischargeSummaries: dischargeSummaries.length,
      },
      encounterStatus: this.countBy(encounters, 'status'),
      diagnosisCounts,
      labAbnormalFlags: this.countBy(labResults, 'abnormalFlag'),
      rows: [
        ...encounters.map((e) => ({ type: 'Encounter', label: e.type, status: e.status, date: e.createdAt })),
        ...diagnoses.map((d) => ({
          type: 'Diagnosis',
          label: d.icdCode || d.description,
          status: d.type,
          date: d.createdAt,
        })),
        ...labResults
          .filter((r) => r.abnormalFlag !== 'NORMAL')
          .map((r) => ({ type: 'Lab result', label: r.testName, status: r.abnormalFlag, date: r.recordedAt })),
      ].sort((a, b) => new Date(b.date as any).getTime() - new Date(a.date as any).getTime()),
    };
  }

  private async setupSummary(db: TenantClient) {
    const [facilities, departments, staff, patients, catalog] = await Promise.all([
      db.facility.count({ where: { active: true } }),
      db.department.count({ where: { active: true } }),
      db.tenantUser.count({ where: { active: true } }),
      db.patient.count({ where: { deletedAt: null } }),
      db.serviceCatalog.count({ where: { active: true } }),
    ]);
    return { facilities, departments, activeStaff: staff, patients, serviceCatalogItems: catalog };
  }

  private async opdToday(db: TenantClient, start: Date, end: Date, providerId?: string | null) {
    const [appointments, encounters] = await Promise.all([
      db.appointment.findMany({ where: { scheduledAt: { gte: start, lte: end } }, select: { id: true, status: true } }),
      db.encounter.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          type: { in: ['OPD', 'WALK_IN'] as any },
          ...(providerId ? { providerId } : {}),
        },
        select: { id: true, type: true, status: true },
      }),
    ]);
    const completed = encounters.filter((e) => e.status === 'COMPLETED').length;
    return {
      todayAppointments: appointments.length,
      appointmentStatus: this.countBy(appointments, 'status'),
      todayEncounters: encounters.length,
      walkIns: encounters.filter((e) => e.type === 'WALK_IN').length,
      queueWaiting: encounters.filter((e) => e.status === 'CHECKED_IN').length,
      inProgress: encounters.filter((e) => e.status === 'IN_PROGRESS').length,
      completed,
      completionRate: encounters.length ? Math.round((completed / encounters.length) * 100) : 0,
    };
  }

  private async billingToday(db: TenantClient, start: Date, end: Date) {
    const [bills, payments, refunds, outstandingBills] = await Promise.all([
      db.bill.findMany({ where: { createdAt: { gte: start, lte: end } }, include: { payments: true, refunds: true } }),
      db.payment.findMany({ where: { createdAt: { gte: start, lte: end } }, select: { amount: true, method: true } }),
      db.refund.findMany({ where: { createdAt: { gte: start, lte: end } }, select: { amount: true } }),
      db.bill.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL'] as any } },
        include: { payments: true, refunds: true },
      }),
    ]);
    const outstandingReceivables = outstandingBills.reduce((sum, b) => {
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const refunded = b.refunds.reduce((s, r) => s + r.amount, 0);
      return sum + Math.max(0, b.netAmount - (paid - refunded));
    }, 0);
    return {
      billedToday: bills.reduce((sum, b) => sum + b.netAmount, 0),
      paidToday: payments.reduce((sum, p) => sum + p.amount, 0),
      refundsToday: refunds.reduce((sum, r) => sum + r.amount, 0),
      outstandingReceivables,
      unpaidBills: outstandingBills.filter((b) => b.status === 'UNPAID').length,
      partialBills: outstandingBills.filter((b) => b.status === 'PARTIAL').length,
      paymentMethod: this.countBy(payments, 'method'),
    };
  }

  private async labSummary(db: TenantClient, start: Date) {
    const [orders, abnormal] = await Promise.all([
      db.labOrder.findMany({ select: { id: true, status: true, createdAt: true } }),
      db.labResult.count({ where: { abnormalFlag: { not: 'NORMAL' as any }, isVerified: false } }),
    ]);
    return {
      ordered: orders.filter((o) => o.status === 'ORDERED').length,
      sampleCollected: orders.filter((o) => o.status === 'SAMPLE_COLLECTED').length,
      processing: orders.filter((o) => o.status === 'PROCESSING').length,
      completedToday: orders.filter((o) => o.status === 'COMPLETED' && new Date(o.createdAt) >= start).length,
      abnormalUnverified: abnormal,
    };
  }

  private async pharmacySummary(db: TenantClient, start: Date) {
    const [pending, dispensedToday] = await Promise.all([
      db.prescription.count({ where: { status: 'FINALIZED' } }),
      db.dispenseRecord.count({ where: { status: 'DISPENSED', createdAt: { gte: start } } }),
    ]);
    return { pendingPrescriptions: pending, dispensedToday };
  }

  private async inventorySummary(db: TenantClient) {
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * DAY_MS);
    const [items, expiringBatches, pendingPurchases] = await Promise.all([
      db.inventoryItem.findMany({
        where: { active: true },
        include: { batches: { select: { quantity: true, salePrice: true } } },
      }),
      db.inventoryBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: horizon } } }),
      db.purchaseOrder.count({ where: { status: { in: ['DRAFT', 'ORDERED'] as any } } }),
    ]);
    const lowStock = items.filter(
      (it) => it.batches.reduce((sum, b) => sum + b.quantity, 0) <= it.lowStockThreshold,
    ).length;
    const stockValue = items.reduce((sum, it) => sum + it.batches.reduce((s, b) => s + b.quantity * b.salePrice, 0), 0);
    return { itemCount: items.length, lowStock, expiringBatches, pendingPurchases, stockValue };
  }

  private async ipdSummary(db: TenantClient, start: Date) {
    const [beds, admissionsToday, dischargesToday, activeAdmissions] = await Promise.all([
      db.bed.findMany({ select: { id: true, status: true } }),
      db.admission.count({ where: { admittedAt: { gte: start } } }),
      db.admission.count({ where: { dischargedAt: { gte: start } } }),
      db.admission.count({ where: { status: 'ADMITTED' } }),
    ]);
    const occupiedBeds = beds.filter((b) => b.status === 'OCCUPIED').length;
    return {
      totalBeds: beds.length,
      occupiedBeds,
      availableBeds: beds.filter((b) => b.status === 'AVAILABLE').length,
      occupancyRate: beds.length ? Math.round((occupiedBeds / beds.length) * 100) : 0,
      admissionsToday,
      dischargesToday,
      activeAdmissions,
    };
  }

  private async nursingSummary(db: TenantClient, start: Date) {
    const admissions = await db.admission.findMany({
      where: { status: 'ADMITTED' },
      select: { id: true, encounterId: true },
    });
    const encounterIds = admissions.map((a) => a.encounterId).filter(Boolean) as string[];
    const [vitalsToday, medsToday, notesToday] = await Promise.all([
      encounterIds.length
        ? db.vitals.findMany({
            where: { encounterId: { in: encounterIds }, recordedAt: { gte: start } },
            select: { encounterId: true },
          })
        : [],
      db.medicationAdministration.count({ where: { administeredAt: { gte: start } } }),
      db.nursingNote.count({ where: { createdAt: { gte: start } } }),
    ]);
    const vitalsSet = new Set(vitalsToday.map((v) => v.encounterId));
    return {
      vitalsDue: admissions.filter((a) => !a.encounterId || !vitalsSet.has(a.encounterId)).length,
      medsToday,
      notesToday,
    };
  }

  private async insuranceSummary(db: TenantClient, start: Date) {
    const claims = await db.insuranceClaim.findMany({ include: { settlements: true }, take: 300 });
    const approved = claims.filter((c) => c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED');
    return {
      submitted: claims.filter((c) => c.status === 'SUBMITTED').length,
      underReview: claims.filter((c) => c.status === 'UNDER_REVIEW').length,
      approved: approved.length,
      rejected: claims.filter((c) => c.status === 'REJECTED').length,
      settled: claims.filter((c) => c.status === 'SETTLED').length,
      approvedOutstanding: approved.reduce((sum, c) => {
        const settled = c.settlements.reduce((s, row) => s + row.amount, 0);
        return sum + Math.max(0, (c.approvedAmount ?? c.claimAmount) - settled);
      }, 0),
      settledToday: claims
        .flatMap((c) => c.settlements)
        .filter((s) => new Date(s.settledAt) >= start)
        .reduce((sum, s) => sum + s.amount, 0),
    };
  }

  private alerts(data: Record<string, any>) {
    const rows: { label: string; tone: string; href: string }[] = [];
    if (data.billing?.outstandingReceivables > 0)
      rows.push({ label: 'Outstanding billing receivables', tone: 'warning', href: '/billing' });
    if (data.lab?.abnormalUnverified > 0)
      rows.push({ label: 'Unverified abnormal lab results', tone: 'danger', href: '/lab' });
    if (data.pharmacy?.pendingPrescriptions > 0)
      rows.push({ label: 'Prescriptions pending dispense', tone: 'warning', href: '/pharmacy' });
    if (data.inventory?.lowStock > 0)
      rows.push({ label: 'Low-stock inventory items', tone: 'danger', href: '/inventory' });
    if (data.ipd?.occupancyRate >= 85) rows.push({ label: 'High IPD occupancy', tone: 'warning', href: '/ipd' });
    if (data.insurance?.approvedOutstanding > 0)
      rows.push({ label: 'Insurance settlements pending', tone: 'warning', href: '/insurance' });
    return rows;
  }
}
