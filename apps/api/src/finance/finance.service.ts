import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction, type TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { nextBillNumber } from '../common/sequences';
import { BillingService } from '../billing/billing.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApprovalDecisionDto,
  BillFromChargesDto,
  CancelChargeDto,
  CreateChargeDto,
  DayCloseDto,
  FinanceCancelBillDto,
  FinancePaymentDto,
  FinanceRefundDto,
  RequestApprovalDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, phone: true } };
const ACTIVE_CLAIMS = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as const;

@Injectable()
export class FinanceService {
  constructor(
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly notifications?: NotificationsService,
  ) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string | null, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private dayRange(raw?: string) {
    const base = raw ? new Date(raw) : new Date();
    if (Number.isNaN(base.getTime())) throw new BadRequestException('Invalid business date');
    const start = new Date(base);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  private paymentMethodTotals(payments: { amount: number; method: string }[]) {
    return payments.reduce(
      (acc, p) => {
        const key = `${p.method.toLowerCase().replace(/_transfer/g, '')}Total`;
        if (key in acc) acc[key as keyof typeof acc] += p.amount;
        else acc.otherTotal += p.amount;
        return acc;
      },
      { cashTotal: 0, cardTotal: 0, upiTotal: 0, bankTotal: 0, insuranceTotal: 0, otherTotal: 0 },
    );
  }

  private billStatus(net: number, paid: number, refunded: number, cancelled = false): any {
    if (cancelled) return 'CANCELLED';
    const netPaid = paid - refunded;
    if (paid === 0) return 'UNPAID';
    if (netPaid <= 0) return 'REFUNDED';
    if (netPaid >= net) return 'PAID';
    return 'PARTIAL';
  }

  private async attachPatients(db: TenantClient, rows: any[]) {
    const ids = Array.from(new Set(rows.map((r) => r.patientId).filter(Boolean)));
    const patients = ids.length ? await db.patient.findMany({ where: { id: { in: ids } }, select: PATIENT_SELECT.select }) : [];
    const byId = new Map(patients.map((p) => [p.id, p]));
    return rows.map((row) => ({ ...row, patient: byId.get(row.patientId) ?? null }));
  }

  async createCharge(ctx: RequestContext, dto: CreateChargeDto) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({ where: { id: dto.patientId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new BadRequestException('Patient not found');
    const charge = await s.db.billableCharge.create({
      data: {
        tenantId: s.tenantId,
        patientId: dto.patientId,
        encounterId: dto.encounterId ?? null,
        admissionId: dto.admissionId ?? null,
        catalogId: dto.catalogId ?? null,
        sourceModule: dto.sourceModule as any,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId ?? null,
        name: dto.name.trim(),
        quantity: dto.quantity,
        unitPrice: dto.unitPrice,
        total: dto.quantity * dto.unitPrice,
        createdById: s.actorId,
      },
    });
    await this.record(s, 'charge.create', 'billable_charge', charge.id, {
      patientId: dto.patientId,
      sourceModule: dto.sourceModule,
      sourceType: dto.sourceType,
      amount: charge.total,
    });
    return charge;
  }

  async dashboard(ctx: RequestContext) {
    const s = this.scope(ctx);
    const { start, end } = this.dayRange();
    const [
      payments,
      refunds,
      pendingCharges,
      unpaidBills,
      partialBills,
      cancelledToday,
      approvals,
      claims,
      dayClose,
      billedChargesToday,
    ] = await Promise.all([
      s.db.payment.findMany({ where: { createdAt: { gte: start, lt: end } } }),
      s.db.refund.findMany({ where: { createdAt: { gte: start, lt: end } } }),
      s.db.billableCharge.findMany({ where: { status: 'PENDING' as any }, orderBy: { createdAt: 'asc' }, take: 10 }),
      s.db.bill.findMany({ where: { status: 'UNPAID' as any }, include: { payments: true, refunds: true, patient: PATIENT_SELECT }, take: 20 }),
      s.db.bill.findMany({ where: { status: 'PARTIAL' as any }, include: { payments: true, refunds: true, patient: PATIENT_SELECT }, take: 20 }),
      s.db.bill.findMany({ where: { status: 'CANCELLED' as any, updatedAt: { gte: start, lt: end } } }),
      s.db.financeApproval.findMany({ where: { status: 'PENDING' as any }, orderBy: { requestedAt: 'asc' }, take: 10 }),
      s.db.insuranceClaim.findMany({ where: { status: { in: ACTIVE_CLAIMS as any } }, include: { settlements: true }, take: 50 }),
      s.db.financeDayClose.findFirst({ where: { businessDate: start }, orderBy: { closedAt: 'desc' } }),
      s.db.billableCharge.findMany({ where: { status: 'BILLED' as any, updatedAt: { gte: start, lt: end } } }),
    ]);
    const methodTotals = this.paymentMethodTotals(payments);
    const collectionToday = payments.reduce((sum, p) => sum + p.amount, 0);
    const refundsToday = refunds.reduce((sum, r) => sum + r.amount, 0);
    const outstandingPatientDues = [...unpaidBills, ...partialBills].reduce((sum: number, b: any) => {
      const paid = b.payments.reduce((a: number, p: any) => a + p.amount, 0);
      const refunded = b.refunds.reduce((a: number, r: any) => a + r.amount, 0);
      return sum + Math.max(0, b.netAmount - (paid - refunded));
    }, 0);
    const insuranceReceivables = claims.reduce((sum: number, claim: any) => {
      const approved = claim.approvedAmount ?? 0;
      const settled = (claim.settlements ?? []).reduce((s2: number, row: any) => s2 + row.amount, 0);
      return sum + Math.max(0, approved - settled);
    }, 0);
    const moduleRevenue = billedChargesToday.reduce((acc: Record<string, number>, charge: any) => {
      acc[charge.sourceModule] = (acc[charge.sourceModule] ?? 0) + charge.total;
      return acc;
    }, {});
    const blockers = [
      pendingCharges.length > 0 && { type: 'PENDING_CHARGES', label: `${pendingCharges.length} charges not billed`, href: '/finance/pending-charges' },
      unpaidBills.length > 0 && { type: 'UNPAID_BILLS', label: `${unpaidBills.length} unpaid bills`, href: '/finance/bills?status=UNPAID' },
      partialBills.length > 0 && { type: 'PARTIAL_BILLS', label: `${partialBills.length} partial bills`, href: '/finance/bills?status=PARTIAL' },
      approvals.length > 0 && { type: 'APPROVALS', label: `${approvals.length} finance approvals pending`, href: '/finance/approvals' },
      !dayClose && { type: 'DAY_CLOSE', label: 'Day close is not completed', href: '/finance/day-close' },
    ].filter(Boolean);

    return {
      generatedAt: new Date().toISOString(),
      collectionToday,
      refundsToday,
      netCollectionToday: collectionToday - refundsToday,
      outstandingPatientDues,
      insuranceReceivables,
      pendingCharges: pendingCharges.length,
      unpaidBills: unpaidBills.length,
      partialBills: partialBills.length,
      cancelledBillsToday: cancelledToday.length,
      pendingApprovals: approvals.length,
      dayCloseStatus: dayClose?.status ?? 'OPEN',
      paymentMethodSplit: methodTotals,
      moduleRevenue,
      blockers,
      pendingChargeRows: await this.attachPatients(s.db, pendingCharges),
    };
  }

  async patientAccount(ctx: RequestContext, patientId: string) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new NotFoundException('Patient not found');
    const [charges, bills, claims, documents] = await Promise.all([
      s.db.billableCharge.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } }),
      s.db.bill.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: { items: true, payments: true, refunds: true, claims: { include: { patientPolicy: { include: { provider: true } }, settlements: true } } },
      }),
      s.db.insuranceClaim.findMany({ where: { bill: { patientId } }, include: { patientPolicy: { include: { provider: true } }, settlements: true, bill: true } }),
      s.db.patientDocument.findMany({ where: { patientId, category: { in: ['BILLING', 'INSURANCE', 'GENERATED_REPORT'] as any } }, orderBy: { createdAt: 'desc' }, take: 25 }),
    ]);
    const outstanding = bills.reduce((sum: number, b: any) => {
      const paid = b.payments.reduce((a: number, p: any) => a + p.amount, 0);
      const refunded = b.refunds.reduce((a: number, r: any) => a + r.amount, 0);
      return sum + Math.max(0, b.netAmount - (paid - refunded));
    }, 0);
    return {
      patient,
      charges,
      pendingCharges: charges.filter((c: any) => c.status === 'PENDING'),
      bills,
      claims,
      documents,
      totals: {
        pendingCharges: charges.filter((c: any) => c.status === 'PENDING').reduce((s2: number, c: any) => s2 + c.total, 0),
        outstanding,
        paid: bills.flatMap((b: any) => b.payments).reduce((s2: number, p: any) => s2 + p.amount, 0),
        refunded: bills.flatMap((b: any) => b.refunds).reduce((s2: number, r: any) => s2 + r.amount, 0),
      },
    };
  }

  async pendingCharges(ctx: RequestContext, filters: { patientId?: string; status?: string; sourceModule?: string; q?: string }) {
    const s = this.scope(ctx);
    const where: any = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;
    else where.status = 'PENDING';
    if (filters.sourceModule) where.sourceModule = filters.sourceModule;
    if (filters.q) {
      const patients = await s.db.patient.findMany({
        where: {
          OR: [
            { fullName: { contains: filters.q, mode: 'insensitive' } },
            { mrn: { contains: filters.q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 100,
      });
      where.OR = [{ name: { contains: filters.q, mode: 'insensitive' } }, { patientId: { in: patients.map((p) => p.id) } }];
    }
    const rows = await s.db.billableCharge.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return this.attachPatients(s.db, rows);
  }

  async cancelCharge(ctx: RequestContext, id: string, dto: CancelChargeDto) {
    const s = this.scope(ctx);
    const charge = await s.db.billableCharge.findFirst({ where: { id } });
    if (!charge) throw new NotFoundException('Charge not found');
    if (charge.status !== 'PENDING') throw new BadRequestException('Only pending charges can be cancelled directly');
    const updated = await s.db.billableCharge.update({
      where: { id },
      data: { status: 'CANCELLED', cancellationReason: dto.reason },
    });
    await this.record(s, 'charge.cancel', 'billable_charge', id, { reason: dto.reason, patientId: charge.patientId });
    return updated;
  }

  async billFromCharges(ctx: RequestContext, dto: BillFromChargesDto) {
    const s = this.scope(ctx);
    const charges = await s.db.billableCharge.findMany({ where: { id: { in: dto.chargeIds } } });
    if (charges.length !== dto.chargeIds.length) throw new BadRequestException('One or more charges were not found');
    if (charges.some((c: any) => c.status !== 'PENDING')) throw new BadRequestException('Only pending charges can be billed');
    const patientIds = new Set(charges.map((c: any) => c.patientId));
    if (patientIds.size !== 1) throw new BadRequestException('Selected charges must belong to the same patient');
    const patientId = charges[0].patientId;
    const totalAmount = charges.reduce((sum: number, c: any) => sum + c.total, 0);
    const discount = Math.min(dto.discount ?? 0, totalAmount);
    const netAmount = totalAmount - discount;
    const billNumber = await nextBillNumber(s.db, s.tenantId);
    const billId = await tenantTransaction(s.tenantId, async (tx) => {
      const bill = await tx.bill.create({
        data: {
          tenantId: s.tenantId,
          patientId,
          encounterId: charges.find((c: any) => c.encounterId)?.encounterId ?? null,
          admissionId: charges.find((c: any) => c.admissionId)?.admissionId ?? null,
          billNumber,
          totalAmount,
          discount,
          netAmount,
          status: netAmount === 0 ? 'PAID' : 'UNPAID',
          notes: dto.notes ?? 'Created from pending charges',
        },
      });
      for (const charge of charges as any[]) {
        const billItem = await tx.billItem.create({
          data: {
            tenantId: s.tenantId,
            billId: bill.id,
            catalogId: charge.catalogId,
            sourceType: this.toBillSource(charge),
            sourceId: charge.sourceId,
            name: charge.name,
            quantity: charge.quantity,
            unitPrice: charge.unitPrice,
            total: charge.total,
          },
        });
        await tx.billableCharge.update({
          where: { id: charge.id },
          data: { status: 'BILLED', billId: bill.id, billItemId: billItem.id },
        });
      }
      return bill.id;
    });
    await this.record(s, 'bill.from_charges', 'bill', billId, {
      billNumber,
      chargeIds: dto.chargeIds,
      netAmount,
    });
    return this.billing.getById(ctx, billId);
  }

  private toBillSource(charge: any): any {
    if (charge.sourceModule === 'LAB') return 'LAB';
    if (charge.sourceModule === 'PHARMACY') return 'PHARMACY';
    if (charge.sourceModule === 'IPD') return 'IPD';
    if (charge.sourceModule === 'OPD') return charge.sourceType === 'PROCEDURE' ? 'PROCEDURE' : 'CONSULTATION';
    return 'MANUAL';
  }

  bills(ctx: RequestContext, filters: { status?: string; patientId?: string; q?: string }) {
    return this.billing.list(ctx, filters);
  }

  bill(ctx: RequestContext, id: string) {
    return this.billing.getById(ctx, id);
  }

  async addPayment(ctx: RequestContext, id: string, dto: FinancePaymentDto) {
    return this.billing.addPayment(ctx, id, dto);
  }

  async refund(ctx: RequestContext, id: string, dto: FinanceRefundDto) {
    const s = this.scope(ctx);
    await this.record(s, 'refund.request', 'bill', id, { amount: dto.amount, reason: dto.reason });
    const out = await this.billing.refund(ctx, id, dto.amount, dto.reason);
    await this.record(s, 'refund.process', 'bill', id, { amount: dto.amount, reason: dto.reason });
    return out;
  }

  async cancelBill(ctx: RequestContext, id: string, dto: FinanceCancelBillDto) {
    const s = this.scope(ctx);
    await this.record(s, 'bill.cancel.request', 'bill', id, { reason: dto.reason });
    return this.billing.cancel(ctx, id, dto.reason);
  }

  async payments(ctx: RequestContext, filters: { startDate?: string; endDate?: string }) {
    const s = this.scope(ctx);
    const where: any = {};
    if (filters.startDate || filters.endDate) where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    return s.db.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: { bill: { include: { patient: PATIENT_SELECT } } },
    });
  }

  async refunds(ctx: RequestContext, filters: { startDate?: string; endDate?: string }) {
    const s = this.scope(ctx);
    const where: any = {};
    if (filters.startDate || filters.endDate) where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    return s.db.refund.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 250,
      include: { bill: { include: { patient: PATIENT_SELECT } } },
    });
  }

  insuranceReceivables(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.insuranceClaim.findMany({
      where: { status: { in: ACTIVE_CLAIMS as any } },
      orderBy: { createdAt: 'desc' },
      include: {
        settlements: true,
        bill: { include: { patient: PATIENT_SELECT, payments: true, refunds: true } },
        patientPolicy: { include: { provider: true } },
      },
    });
  }

  async dayClose(ctx: RequestContext, date?: string, cashierId?: string) {
    const s = this.scope(ctx);
    const { start, end } = this.dayRange(date);
    const whereActor = cashierId ? { collectedById: cashierId } : {};
    const [payments, refunds, cancelledBills, existing] = await Promise.all([
      s.db.payment.findMany({ where: { createdAt: { gte: start, lt: end }, ...whereActor } }),
      s.db.refund.findMany({ where: { createdAt: { gte: start, lt: end }, ...(cashierId ? { refundedById: cashierId } : {}) } }),
      s.db.bill.findMany({ where: { status: 'CANCELLED' as any, updatedAt: { gte: start, lt: end } } }),
      s.db.financeDayClose.findMany({ where: { businessDate: start, ...(cashierId ? { cashierId } : {}) }, orderBy: { closedAt: 'desc' } }),
    ]);
    const methodTotals = this.paymentMethodTotals(payments);
    const refundTotal = refunds.reduce((sum, r) => sum + r.amount, 0);
    const cancellationTotal = cancelledBills.reduce((sum, b) => sum + b.netAmount, 0);
    const gross = payments.reduce((sum, p) => sum + p.amount, 0);
    return {
      businessDate: start.toISOString(),
      status: existing[0]?.status ?? 'OPEN',
      ...methodTotals,
      grossCollection: gross,
      refundTotal,
      cancellationTotal,
      netCollection: gross - refundTotal,
      payments,
      refunds,
      cancelledBills,
      closes: existing,
    };
  }

  async closeDay(ctx: RequestContext, dto: DayCloseDto) {
    const s = this.scope(ctx);
    const { start } = this.dayRange(dto.businessDate);
    const summary = await this.dayClose(ctx, dto.businessDate, dto.cashierId);
    const closed = await s.db.financeDayClose.create({
      data: {
        tenantId: s.tenantId,
        businessDate: start,
        cashierId: dto.cashierId ?? null,
        status: 'CLOSED' as any,
        cashTotal: summary.cashTotal,
        cardTotal: summary.cardTotal,
        upiTotal: summary.upiTotal,
        bankTotal: summary.bankTotal,
        insuranceTotal: summary.insuranceTotal,
        otherTotal: summary.otherTotal,
        refundTotal: summary.refundTotal,
        cancellationTotal: summary.cancellationTotal,
        netCollection: summary.netCollection,
        notes: dto.notes,
        closedById: s.actorId,
      },
    });
    await this.record(s, 'finance.day_close', 'finance_day_close', closed.id, {
      businessDate: start.toISOString(),
      cashierId: dto.cashierId ?? null,
      netCollection: summary.netCollection,
    });
    return closed;
  }

  approvals(ctx: RequestContext, status?: string) {
    const { db } = this.scope(ctx);
    return db.financeApproval.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
  }

  async requestApproval(ctx: RequestContext, dto: RequestApprovalDto) {
    const s = this.scope(ctx);
    const approval = await s.db.financeApproval.create({
      data: {
        tenantId: s.tenantId,
        type: dto.type as any,
        entity: dto.entity,
        entityId: dto.entityId ?? null,
        amount: dto.amount ?? null,
        reason: dto.reason,
        notes: dto.notes,
        requestedById: s.actorId,
      },
    });
    await this.record(s, `${dto.type.toLowerCase()}.request`, 'finance_approval', approval.id, {
      entity: dto.entity,
      entityId: dto.entityId ?? null,
      amount: dto.amount ?? null,
    });
    return approval;
  }

  async decideApproval(ctx: RequestContext, id: string, status: 'APPROVED' | 'REJECTED', dto: ApprovalDecisionDto) {
    const s = this.scope(ctx);
    const existing = await s.db.financeApproval.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Approval not found');
    if (existing.status !== 'PENDING') throw new BadRequestException('Approval has already been decided');
    const updated = await s.db.financeApproval.update({
      where: { id },
      data: { status: status as any, decidedById: s.actorId, decidedAt: new Date(), decisionReason: dto.reason },
    });
    if (status === 'APPROVED' && existing.type === 'DAY_CLOSE_REOPEN' && existing.entity === 'finance_day_close' && existing.entityId) {
      await s.db.financeDayClose.update({
        where: { id: existing.entityId },
        data: { status: 'REOPENED' as any, reopenedById: s.actorId, reopenedAt: new Date(), reopenReason: dto.reason },
      });
      await this.record(s, 'finance.day_close.reopen', 'finance_day_close', existing.entityId, { reason: dto.reason });
    }
    await this.record(s, status === 'APPROVED' ? 'finance.approval.approve' : 'finance.approval.reject', 'finance_approval', id, {
      type: existing.type,
      reason: dto.reason,
    });
    return updated;
  }

  /**
   * Revenue-leakage reconciliation (Phase 21.2): clinical events that should have a
   * charge but don't — completed lab orders, dispenses, OPD consults, and admitted
   * bed-days not yet accrued. The #1 source of lost hospital revenue.
   */
  async leakage(ctx: RequestContext) {
    const s = this.scope(ctx);
    const DAY = 24 * 60 * 60 * 1000;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const since = new Date(todayStart.getTime() - 120 * DAY);
    const dayOf = (d: Date | string) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x.getTime();
    };

    // 1) LAB — completed orders with no LAB_ORDER charge.
    const labOrders = await s.db.labOrder.findMany({ where: { status: 'COMPLETED' as any, createdAt: { gte: since } }, select: { id: true, patientId: true, createdAt: true }, take: 500 });
    const labBilled = labOrders.length
      ? new Set((await s.db.billableCharge.findMany({ where: { sourceModule: 'LAB' as any, sourceType: 'LAB_ORDER', sourceId: { in: labOrders.map((o) => o.id) } }, select: { sourceId: true } })).map((c) => c.sourceId))
      : new Set<string>();
    const labLeaks = labOrders.filter((o) => !labBilled.has(o.id)).map((o) => ({ sourceId: o.id, patientId: o.patientId, label: 'Completed lab order not billed', occurredAt: o.createdAt, href: `/lab/orders/${o.id}`, estimated: null as number | null }));

    // 2) PHARMACY — dispensed records with no bill.
    const dispenses = await s.db.dispenseRecord.findMany({ where: { status: 'DISPENSED' as any, billId: null, createdAt: { gte: since } }, select: { id: true, patientId: true, createdAt: true }, take: 500 });
    const pharmaLeaks = dispenses.map((d) => ({ sourceId: d.id, patientId: d.patientId, label: 'Dispensed medication not billed', occurredAt: d.createdAt, href: `/finance/patient-accounts/${d.patientId}`, estimated: null as number | null }));

    // 3) OPD — completed OPD encounters with no consultation charge.
    const encounters = await s.db.encounter.findMany({ where: { status: 'COMPLETED' as any, type: 'OPD' as any, createdAt: { gte: since } }, select: { id: true, patientId: true, createdAt: true }, take: 500 });
    const opdBilled = encounters.length
      ? new Set((await s.db.billableCharge.findMany({ where: { sourceModule: 'OPD' as any, sourceType: 'CONSULTATION', sourceId: { in: encounters.map((e) => e.id) } }, select: { sourceId: true } })).map((c) => c.sourceId))
      : new Set<string>();
    const opdLeaks = encounters.filter((e) => !opdBilled.has(e.id)).map((e) => ({ sourceId: e.id, patientId: e.patientId, label: 'Completed consultation not billed', occurredAt: e.createdAt, href: `/finance/patient-accounts/${e.patientId}`, estimated: null as number | null }));

    // 4) IPD — admitted patients with un-accrued completed bed-days (uses the 21.1 watermark).
    const admitted = await s.db.admission.findMany({ where: { status: 'ADMITTED' as any }, select: { id: true, patientId: true, admittedAt: true, bedChargedThrough: true, bedId: true }, take: 500 });
    const bedIds = [...new Set(admitted.map((a) => a.bedId))];
    const beds = bedIds.length ? await s.db.bed.findMany({ where: { id: { in: bedIds } }, include: { ward: true } }) : [];
    const rateByBed = new Map<string, number>(beds.filter((b: any) => b.ward).map((b: any) => [b.id, b.ward.dailyRate ?? 0]));
    const ipdLeaks = admitted
      .map((a) => {
        const rate = rateByBed.get(a.bedId) ?? 0;
        const admittedDay = dayOf(a.admittedAt);
        const through = a.bedChargedThrough ? dayOf(a.bedChargedThrough) : null;
        const yesterdayStart = todayStart.getTime() - DAY;
        const behind = rate > 0 && admittedDay < todayStart.getTime() && (through == null || through < yesterdayStart);
        if (!behind) return null;
        const fromMs = through != null ? through + DAY : admittedDay;
        const daysBehind = Math.max(1, Math.round((todayStart.getTime() - fromMs) / DAY));
        return { sourceId: a.id, patientId: a.patientId, label: `${daysBehind} bed-day(s) not accrued`, occurredAt: a.admittedAt, href: `/ipd/admissions/${a.id}`, estimated: daysBehind * rate, admissionId: a.id };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const all = [...labLeaks, ...pharmaLeaks, ...opdLeaks, ...ipdLeaks];
    const patientIds = [...new Set(all.map((r) => r.patientId))];
    const patients = patientIds.length ? await s.db.patient.findMany({ where: { id: { in: patientIds } }, select: PATIENT_SELECT.select }) : [];
    const byPatient = new Map(patients.map((p) => [p.id, p]));
    const withPatient = (rows: any[]) => rows.map((r) => ({ ...r, patient: byPatient.get(r.patientId) ?? null }));

    const categories = [
      { key: 'IPD', label: 'Bed-days not accrued', actionable: true, rows: withPatient(ipdLeaks) },
      { key: 'LAB', label: 'Completed lab orders not billed', actionable: false, rows: withPatient(labLeaks) },
      { key: 'PHARMACY', label: 'Dispenses not billed', actionable: false, rows: withPatient(pharmaLeaks) },
      { key: 'OPD', label: 'Consultations not billed', actionable: false, rows: withPatient(opdLeaks) },
    ].map((c) => ({ ...c, count: c.rows.length }));

    return {
      generatedAt: now.toISOString(),
      totalCount: categories.reduce((sum, c) => sum + c.count, 0),
      estimatedRecoverable: categories.reduce((sum, c) => sum + c.rows.reduce((a: number, r: any) => a + (r.estimated ?? 0), 0), 0),
      categories,
    };
  }

  async reportsSummary(ctx: RequestContext) {
    const dashboard = await this.dashboard(ctx);
    const receivables = await this.insuranceReceivables(ctx);
    return {
      generatedAt: dashboard.generatedAt,
      dashboard,
      insuranceReceivableCount: receivables.length,
    };
  }
}
