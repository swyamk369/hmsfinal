import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction } from '@hms/db';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import { nextBillNumber } from '../common/sequences';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { DispenseDto, ReturnDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

interface BatchLike {
  id: string;
  quantity: number;
  expiryDate: Date | string | null;
  salePrice: number;
}

export interface Allocation {
  batchId: string;
  quantity: number;
  salePrice: number;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, dob: true, sex: true, phone: true } };

/** A batch is expired if it has an expiry date strictly before `now`. */
export function isExpired(expiryDate: Date | string | null, now = new Date()): boolean {
  return !!expiryDate && new Date(expiryDate) < now;
}

/**
 * FEFO allocation: consumes from the earliest-expiry, non-expired batches first.
 * Returns the per-batch allocations and any quantity that could not be filled.
 */
export function fefoAllocate(
  batches: BatchLike[],
  qty: number,
  now = new Date(),
): { allocations: Allocation[]; remaining: number } {
  const usable = batches
    .filter((b) => b.quantity > 0 && !isExpired(b.expiryDate, now))
    .sort((a, b) => {
      const ea = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      const eb = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      return ea - eb;
    });
  const allocations: Allocation[] = [];
  let remaining = qty;
  for (const b of usable) {
    if (remaining <= 0) break;
    const take = Math.min(b.quantity, remaining);
    allocations.push({ batchId: b.id, quantity: take, salePrice: b.salePrice });
    remaining -= take;
  }
  return { allocations, remaining };
}

@Injectable()
export class PharmacyService {
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

  // ── Queue ─────────────────────────────────────────────────────
  listPrescriptions(ctx: RequestContext, filters: { status?: string; q?: string }) {
    const { db } = this.scope(ctx);
    const where: any = { status: filters.status || 'FINALIZED' };
    if (filters.q) {
      where.encounter = {
        patient: {
          OR: [
            { fullName: { contains: filters.q, mode: 'insensitive' } },
            { mrn: { contains: filters.q, mode: 'insensitive' } },
          ],
        },
      };
    }
    return db.prescription.findMany({
      where,
      orderBy: { finalizedAt: 'desc' },
      take: 100,
      include: { items: true, encounter: { include: { patient: PATIENT_SELECT } } },
    });
  }

  async getPrescription(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const rx = await s.db.prescription.findFirst({
      where: { id },
      include: { items: true, encounter: { include: { patient: { include: { allergies: true } } } } },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    return rx;
  }

  // ── Availability ──────────────────────────────────────────────
  async availability(ctx: RequestContext, prescriptionId: string) {
    const s = this.scope(ctx);
    const rx = await s.db.prescription.findFirst({ where: { id: prescriptionId }, include: { items: true } });
    if (!rx) throw new NotFoundException('Prescription not found');
    const now = new Date();

    const lines = [];
    for (const item of rx.items) {
      const candidates = await s.db.inventoryItem.findMany({
        where: {
          active: true,
          ...(item.inventoryItemId
            ? { id: item.inventoryItemId }
            : { name: { contains: item.drugName.split(' ')[0], mode: 'insensitive' } }),
        },
        include: { batches: { orderBy: { expiryDate: 'asc' } } },
        take: 5,
      });
      const matches = candidates.map((c) => {
        const valid = c.batches.filter((b) => b.quantity > 0 && !isExpired(b.expiryDate, now));
        const available = valid.reduce((sum, b) => sum + b.quantity, 0);
        return {
          inventoryItemId: c.id,
          name: c.name,
          unit: c.unit,
          available,
          batches: valid.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate,
            quantity: b.quantity,
            salePrice: b.salePrice,
          })),
        };
      });
      const best = matches.reduce((m, c) => (c.available > (m?.available ?? -1) ? c : m), matches[0]);
      const status =
        matches.length === 0 ? 'MISSING' : (best?.available ?? 0) >= item.quantity ? 'FOUND' : 'INSUFFICIENT';
      lines.push({
        prescriptionItemId: item.id,
        drugName: item.drugName,
        requestedQty: item.quantity,
        matches,
        status,
      });
    }
    return { prescriptionId, status: rx.status, lines };
  }

  // ── Dispense (FEFO, transactional) ────────────────────────────
  async dispense(ctx: RequestContext, prescriptionId: string, dto: DispenseDto) {
    const s = this.scope(ctx);
    const rx = await s.db.prescription.findFirst({ where: { id: prescriptionId }, include: { encounter: true } });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.status === 'DISPENSED') throw new BadRequestException('Prescription is already dispensed');
    if (rx.status !== 'FINALIZED') throw new BadRequestException('Only finalized prescriptions can be dispensed');

    // Plan FEFO allocations up-front (reads only). Any shortfall fails before mutation.
    const now = new Date();
    const plan: { line: (typeof dto.items)[number]; drugName: string; allocations: Allocation[] }[] = [];
    for (const line of dto.items) {
      const item = await s.db.inventoryItem.findFirst({
        where: { id: line.inventoryItemId },
        include: { batches: true },
      });
      if (!item) throw new BadRequestException(`Inventory item ${line.inventoryItemId} not found`);
      const { allocations, remaining } = fefoAllocate(item.batches, line.quantity, now);
      if (remaining > 0) {
        await this.notifications?.safeNotify(ctx, {
          category: 'PHARMACY',
          type: 'pharmacy.stock_missing',
          severity: 'WARNING',
          title: 'Prescription stock shortfall',
          message: 'A pharmacy dispense attempt could not be completed because stock is missing.',
          actionUrl: `/pharmacy/dispense/${prescriptionId}`,
          metadata: { prescriptionId, inventoryItemId: item.id, shortBy: remaining },
          roleCodes: ['PHARMACIST', 'INVENTORY_MGR', 'HOSPITAL_ADMIN'],
        });
        throw new BadRequestException(`Insufficient stock for ${item.name}: short by ${remaining} ${item.unit}`);
      }
      plan.push({ line, drugName: item.name, allocations });
    }

    const billNumber = await nextBillNumber(s.db, s.tenantId);
    const billItems = plan.flatMap((p) =>
      p.allocations.map((a) => ({
        name: p.drugName,
        quantity: a.quantity,
        unitPrice: a.salePrice,
        total: a.quantity * a.salePrice,
      })),
    );
    const totalAmount = billItems.reduce((sum, li) => sum + li.total, 0);

    const result = await tenantTransaction(s.tenantId, async (tx) => {
      // Re-verify and deduct stock atomically.
      const dispense = await tx.dispenseRecord.create({
        data: {
          tenantId: s.tenantId,
          prescriptionId,
          patientId: rx.encounter.patientId,
          dispensedById: s.actorId,
          status: 'DISPENSED',
        },
      });
      for (const p of plan) {
        for (const a of p.allocations) {
          const batch = await tx.inventoryBatch.findFirst({ where: { id: a.batchId } });
          if (!batch || batch.quantity < a.quantity) {
            throw new BadRequestException('Stock changed during dispense — please retry');
          }
          await tx.inventoryBatch.update({ where: { id: a.batchId }, data: { quantity: batch.quantity - a.quantity } });
          await tx.inventoryTransaction.create({
            data: {
              tenantId: s.tenantId,
              itemId: batch.itemId,
              batchId: a.batchId,
              type: 'DISPENSE',
              quantity: a.quantity,
              reason: `Dispense Rx ${prescriptionId}`,
              actorId: s.actorId,
            },
          });
          await tx.dispenseItem.create({
            data: {
              tenantId: s.tenantId,
              dispenseRecordId: dispense.id,
              prescriptionItemId: p.line.prescriptionItemId,
              inventoryItemId: p.line.inventoryItemId,
              batchId: a.batchId,
              quantity: a.quantity,
              unitPrice: a.salePrice,
            },
          });
        }
      }
      const bill = await tx.bill.create({
        data: {
          tenantId: s.tenantId,
          patientId: rx.encounter.patientId,
          encounterId: rx.encounterId,
          billNumber,
          totalAmount,
          discount: 0,
          netAmount: totalAmount,
          status: totalAmount === 0 ? 'PAID' : 'UNPAID',
          notes: 'Pharmacy dispense',
          items: {
            create: billItems.map((li) => ({
              tenantId: s.tenantId,
              sourceType: 'PHARMACY' as const,
              name: li.name,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              total: li.total,
            })),
          },
        },
      });
      await tx.billableCharge.createMany({
        data: billItems.map((li) => ({
          tenantId: s.tenantId,
          patientId: rx.encounter.patientId,
          encounterId: rx.encounterId,
          billId: bill.id,
          sourceModule: 'PHARMACY' as const,
          sourceType: 'DISPENSE',
          sourceId: dispense.id,
          name: li.name,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: li.total,
          status: 'BILLED' as const,
          createdById: s.actorId,
        })),
      });
      await tx.dispenseRecord.update({ where: { id: dispense.id }, data: { billId: bill.id } });
      await tx.prescription.update({ where: { id: prescriptionId }, data: { status: 'DISPENSED' } });
      return { dispenseId: dispense.id, billId: bill.id };
    });

    await this.record(s, 'pharmacy.dispense', 'dispense_record', result.dispenseId, {
      prescriptionId,
      billId: result.billId,
    });
    await this.record(s, 'bill.create', 'bill', result.billId, {
      source: 'pharmacy',
      billNumber,
      netAmount: totalAmount,
    });
    await this.record(s, 'charge.create', 'dispense_record', result.dispenseId, {
      sourceModule: 'PHARMACY',
      billId: result.billId,
      items: billItems.length,
      amount: totalAmount,
    });
    await this.notifications?.safeNotify(ctx, {
      category: 'PHARMACY',
      type: 'prescription.dispensed',
      severity: 'SUCCESS',
      title: 'Prescription dispensed',
      message: 'A prescription has been dispensed and a pharmacy bill was created.',
      actionUrl: `/pharmacy/dispense/${result.dispenseId}`,
      metadata: { prescriptionId, dispenseId: result.dispenseId, billId: result.billId },
      roleCodes: ['PHARMACIST', 'BILLING', 'HOSPITAL_ADMIN'],
    });
    return this.getDispense(ctx, result.dispenseId);
  }

  // ── Returns ───────────────────────────────────────────────────
  async returns(ctx: RequestContext, dto: ReturnDto) {
    const s = this.scope(ctx);
    const record = await s.db.dispenseRecord.findFirst({
      where: { id: dto.dispenseRecordId },
      include: { items: true },
    });
    if (!record) throw new NotFoundException('Dispense record not found');
    if (record.status === 'CANCELLED') throw new BadRequestException('Dispense already fully returned');

    // Resolve the lines to return (default: everything).
    const lines = (dto.items ?? record.items.map((i) => ({ dispenseItemId: i.id, quantity: i.quantity }))).map((l) => {
      const di = record.items.find((i) => i.id === l.dispenseItemId);
      if (!di) throw new BadRequestException('Dispense item does not belong to this record');
      if (l.quantity > di.quantity) throw new BadRequestException('Return quantity exceeds dispensed quantity');
      return { di, quantity: l.quantity };
    });

    await tenantTransaction(s.tenantId, async (tx) => {
      for (const { di, quantity } of lines) {
        const batch = await tx.inventoryBatch.findFirst({ where: { id: di.batchId } });
        if (batch)
          await tx.inventoryBatch.update({ where: { id: di.batchId }, data: { quantity: batch.quantity + quantity } });
        await tx.inventoryTransaction.create({
          data: {
            tenantId: s.tenantId,
            itemId: di.inventoryItemId,
            batchId: di.batchId,
            type: 'RETURN',
            quantity,
            reason: dto.reason,
            actorId: s.actorId,
          },
        });
      }
      const fullReturn = lines.every((l) => l.quantity === l.di.quantity) && lines.length === record.items.length;
      if (fullReturn) await tx.dispenseRecord.update({ where: { id: record.id }, data: { status: 'CANCELLED' } });
    });

    await this.record(s, 'pharmacy.return', 'dispense_record', record.id, { reason: dto.reason, lines: lines.length });
    return this.getDispense(ctx, record.id);
  }

  // ── Reads ─────────────────────────────────────────────────────
  // DispenseRecord stores patientId without a Prisma relation, so patients are
  // resolved in a second tenant-scoped query.
  async listDispenses(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const records = await db.dispenseRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: true },
    });
    const ids = [...new Set(records.map((r) => r.patientId))];
    const patients = await db.patient.findMany({ where: { id: { in: ids } }, ...PATIENT_SELECT });
    const byId = new Map(patients.map((p) => [p.id, p]));
    return records.map((r) => ({ ...r, patient: byId.get(r.patientId) ?? null }));
  }

  async getDispense(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const record = await s.db.dispenseRecord.findFirst({ where: { id }, include: { items: true } });
    if (!record) throw new NotFoundException('Dispense record not found');
    const patient = await s.db.patient.findFirst({ where: { id: record.patientId }, ...PATIENT_SELECT });
    return { ...record, patient };
  }

  async stats(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86400000);
    const [pendingCount, dispensedToday, items, nearExpiry] = await Promise.all([
      db.prescription.count({ where: { status: 'FINALIZED' } }),
      db.dispenseRecord.count({ where: { status: 'DISPENSED', createdAt: { gte: startOfDay } } }),
      db.inventoryItem.findMany({ where: { active: true }, include: { batches: { select: { quantity: true } } } }),
      db.inventoryBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: horizon } } }),
    ]);
    const lowStockCount = items.filter((it) => {
      const total = it.batches.reduce((s, b) => s + b.quantity, 0);
      return total <= it.lowStockThreshold;
    }).length;
    return { pendingCount, dispensedToday, lowStockCount, nearExpiry };
  }
}
