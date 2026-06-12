import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import { nextBillNumber } from '../common/sequences';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBillDto, PaymentDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, phone: true } };

@Injectable()
export class BillingService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications?: NotificationsService,
  ) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private status(net: number, paid: number, refunded: number, cancelled: boolean): any {
    if (cancelled) return 'CANCELLED';
    const netPaid = paid - refunded;
    if (paid === 0) return 'UNPAID';
    if (netPaid <= 0) return 'REFUNDED';
    if (netPaid >= net) return 'PAID';
    return 'PARTIAL';
  }

  catalog(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.serviceCatalog.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  list(ctx: RequestContext, filters: { status?: string; patientId?: string; q?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.q) {
      where.OR = [
        { billNumber: { contains: filters.q, mode: 'insensitive' } },
        { patient: { fullName: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }
    return db.bill.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { patient: PATIENT_SELECT, payments: true, refunds: true },
    });
  }

  async create(ctx: RequestContext, dto: CreateBillDto) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({
      where: { id: dto.patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new BadRequestException('Patient not found');

    const items = dto.items.map((it) => ({
      tenantId: s.tenantId,
      catalogId: it.catalogId,
      sourceType: (it.sourceType ?? 'MANUAL') as any,
      name: it.name,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.quantity * it.unitPrice,
    }));
    const totalAmount = items.reduce((sum, it) => sum + it.total, 0);
    const discount = Math.min(dto.discount ?? 0, totalAmount);
    const netAmount = totalAmount - discount;
    const billNumber = await nextBillNumber(s.db, s.tenantId);

    const bill = await s.db.bill.create({
      data: {
        tenantId: s.tenantId,
        patientId: dto.patientId,
        encounterId: dto.encounterId,
        billNumber,
        totalAmount,
        discount,
        netAmount,
        status: netAmount === 0 ? 'PAID' : 'UNPAID',
        notes: dto.notes,
        items: { create: items },
      },
      include: { items: true, patient: PATIENT_SELECT },
    });
    await this.record(s, 'bill.create', 'bill', bill.id, { billNumber, netAmount });
    return bill;
  }

  async getById(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const bill = await s.db.bill.findFirst({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { createdAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        patient: PATIENT_SELECT,
        claims: {
          orderBy: { createdAt: 'desc' },
          include: {
            patientPolicy: { include: { provider: true } },
            settlements: { orderBy: { settledAt: 'desc' } },
          },
        },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  private totals(payments: { amount: number }[], refunds: { amount: number }[]) {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const refunded = refunds.reduce((s, r) => s + r.amount, 0);
    return { paid, refunded };
  }

  async addPayment(ctx: RequestContext, id: string, dto: PaymentDto) {
    const s = this.scope(ctx);
    const bill = await s.db.bill.findFirst({ where: { id }, include: { payments: true, refunds: true } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === 'CANCELLED') throw new BadRequestException('Cannot collect payment on a cancelled bill');

    const { paid, refunded } = this.totals(bill.payments, bill.refunds);
    const outstanding = bill.netAmount - (paid - refunded);
    if (dto.amount > outstanding) {
      throw new BadRequestException(`Payment exceeds outstanding balance (${outstanding} remaining)`);
    }

    const payment = await s.db.payment.create({
      data: {
        tenantId: s.tenantId,
        billId: id,
        amount: dto.amount,
        method: dto.method as any,
        transactionId: dto.transactionId,
        collectedById: s.actorId,
        notes: dto.notes,
      },
    });
    const status = this.status(bill.netAmount, paid + dto.amount, refunded, false);
    await s.db.bill.update({ where: { id }, data: { status } });
    await this.record(s, 'payment.collect', 'payment', payment.id, {
      billId: id,
      amount: dto.amount,
      method: dto.method,
    });
    await this.notifications?.safeNotify(ctx, {
      category: 'BILLING',
      type: 'payment.receipt',
      severity: 'SUCCESS',
      title: 'Payment received',
      message: 'A payment has been collected and the receipt is ready.',
      actionUrl: `/billing/${id}`,
      metadata: { billId: id, paymentId: payment.id, amount: dto.amount, method: dto.method },
      roleCodes: ['BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN'],
    });
    return this.getById(ctx, id);
  }

  async cancel(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const bill = await s.db.bill.findFirst({ where: { id }, include: { payments: true, refunds: true } });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.status === 'CANCELLED') throw new BadRequestException('Bill is already cancelled');
    const { paid, refunded } = this.totals(bill.payments, bill.refunds);
    if (paid - refunded > 0) {
      throw new BadRequestException('Cannot cancel a bill with collected payments — refund the payments first');
    }
    await s.db.bill.update({ where: { id }, data: { status: 'CANCELLED', cancellationReason: reason } });
    await this.record(s, 'bill.cancel', 'bill', id, { reason });
    return this.getById(ctx, id);
  }

  async refund(ctx: RequestContext, id: string, amount: number, reason: string) {
    const s = this.scope(ctx);
    const bill = await s.db.bill.findFirst({ where: { id }, include: { payments: true, refunds: true } });
    if (!bill) throw new NotFoundException('Bill not found');
    const { paid, refunded } = this.totals(bill.payments, bill.refunds);
    const refundable = paid - refunded;
    if (refundable <= 0) throw new BadRequestException('There are no collected payments to refund');
    if (amount > refundable) {
      throw new BadRequestException(`Refund exceeds the refundable amount (${refundable} available)`);
    }
    const refund = await s.db.refund.create({
      data: { tenantId: s.tenantId, billId: id, amount, reason, refundedById: s.actorId },
    });
    const status = this.status(bill.netAmount, paid, refunded + amount, false);
    await s.db.bill.update({ where: { id }, data: { status } });
    await this.record(s, 'payment.refund', 'refund', refund.id, { billId: id, amount, reason });
    await this.notifications?.safeNotify(ctx, {
      category: 'BILLING',
      type: 'payment.refund',
      severity: 'WARNING',
      title: 'Refund processed',
      message: 'A refund has been processed for a bill.',
      actionUrl: `/billing/${id}`,
      metadata: { billId: id, refundId: refund.id, amount },
      roleCodes: ['BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN'],
    });
    return this.getById(ctx, id);
  }

  async invoice(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const bill = await this.getById(ctx, id);
    const [tenant, settings] = await Promise.all([
      s.db.tenant.findUnique({ where: { id: s.tenantId } }),
      s.db.hospitalSettings.findUnique({ where: { tenantId: s.tenantId } }),
    ]);
    const { paid, refunded } = this.totals(bill.payments, bill.refunds);
    return {
      bill,
      hospital: {
        name: tenant?.name ?? 'Hospital',
        address: tenant?.address ?? null,
        phone: tenant?.contactPhone ?? null,
        email: tenant?.contactEmail ?? null,
        currency: settings?.currency ?? 'INR',
      },
      paid,
      refunded,
      balanceDue: bill.netAmount - (paid - refunded),
    };
  }

  async stats(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [unpaidCount, partialCount, totalBills, paidTodayAgg, outstandingBills] = await Promise.all([
      db.bill.count({ where: { status: 'UNPAID' } }),
      db.bill.count({ where: { status: 'PARTIAL' } }),
      db.bill.count({}),
      db.payment.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: startOfDay } } }),
      db.bill.findMany({
        where: { status: { in: ['UNPAID', 'PARTIAL'] } },
        include: { payments: true, refunds: true },
      }),
    ]);
    const outstanding = outstandingBills.reduce((sum, b) => {
      const paid = b.payments.reduce((a, p) => a + p.amount, 0);
      const refunded = b.refunds.reduce((a, r) => a + r.amount, 0);
      return sum + Math.max(0, b.netAmount - (paid - refunded));
    }, 0);
    return {
      unpaidCount,
      partialCount,
      totalBills,
      paidToday: paidTodayAgg._sum.amount ?? 0,
      outstandingReceivables: outstanding,
    };
  }
}
