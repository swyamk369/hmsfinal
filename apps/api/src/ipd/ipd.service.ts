import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction } from '@hms/db';
import type { TenantClient, TenantTx } from '@hms/db';
import { bedChargePolicyFromSettings, planBedCharges, type BedChargePlan } from './bed-charges';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import { nextBillNumber } from '../common/sequences';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ChargeDto,
  CreateAdmissionDto,
  CreateBedDto,
  CreateWardDto,
  DischargeDto,
  RoundDto,
  TransferDto,
  UpdateBedDto,
  UpdateWardDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, dob: true, sex: true, phone: true } };

@Injectable()
export class IpdService {
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

  // ── Wards ─────────────────────────────────────────────────────
  listWards(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.ward.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { beds: true } } } });
  }

  async createWard(ctx: RequestContext, dto: CreateWardDto) {
    const s = this.scope(ctx);
    const ward = await s.db.ward.create({
      data: {
        tenantId: s.tenantId,
        name: dto.name,
        type: (dto.type ?? 'GENERAL') as any,
        dailyRate: dto.dailyRate ?? 0,
        chargeCatalogId: dto.chargeCatalogId ?? null,
      },
    });
    await this.record(s, 'ward.create', 'ward', ward.id, { name: ward.name, dailyRate: ward.dailyRate });
    return ward;
  }

  async updateWard(ctx: RequestContext, id: string, dto: UpdateWardDto) {
    const s = this.scope(ctx);
    const existing = await s.db.ward.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Ward not found');
    const ward = await s.db.ward.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type as any,
        active: dto.active,
        dailyRate: dto.dailyRate,
        chargeCatalogId: dto.chargeCatalogId,
      },
    });
    await this.record(s, dto.active === false ? 'ward.deactivate' : 'ward.update', 'ward', id, { changes: dto });
    return ward;
  }

  // ── Beds ──────────────────────────────────────────────────────
  listBeds(ctx: RequestContext, wardId?: string) {
    const { db } = this.scope(ctx);
    return db.bed.findMany({
      where: wardId ? { wardId } : {},
      orderBy: { bedNumber: 'asc' },
      include: { ward: { select: { name: true } } },
    });
  }

  async createBed(ctx: RequestContext, dto: CreateBedDto) {
    const s = this.scope(ctx);
    const ward = await s.db.ward.findFirst({ where: { id: dto.wardId }, select: { id: true } });
    if (!ward) throw new BadRequestException('Ward not found');
    const bed = await s.db.bed.create({
      data: {
        tenantId: s.tenantId,
        wardId: dto.wardId,
        bedNumber: dto.bedNumber,
        status: (dto.status ?? 'AVAILABLE') as any,
      },
    });
    await this.record(s, 'bed.create', 'bed', bed.id, { bedNumber: bed.bedNumber });
    return bed;
  }

  async updateBed(ctx: RequestContext, id: string, dto: UpdateBedDto) {
    const s = this.scope(ctx);
    const existing = await s.db.bed.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Bed not found');
    if (dto.status && existing.status === 'OCCUPIED' && dto.status !== 'OCCUPIED') {
      throw new BadRequestException(
        'Cannot change the status of an occupied bed — discharge or transfer the patient first',
      );
    }
    const bed = await s.db.bed.update({ where: { id }, data: { bedNumber: dto.bedNumber, status: dto.status as any } });
    await this.record(s, dto.status ? 'bed.status' : 'bed.update', 'bed', id, { changes: dto });
    return bed;
  }

  // ── Occupancy ─────────────────────────────────────────────────
  async occupancy(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const wards = await db.ward.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { beds: { orderBy: { bedNumber: 'asc' } } },
    });
    const bedIds = wards.flatMap((w) => w.beds.map((b) => b.id));
    const admissions = bedIds.length
      ? await db.admission.findMany({
          where: { status: 'ADMITTED', bedId: { in: bedIds } },
          include: { patient: PATIENT_SELECT },
        })
      : [];
    const byBed = new Map(admissions.map((a) => [a.bedId, a]));
    const counts = { occupied: 0, available: 0, maintenance: 0, reserved: 0 };
    const wardsOut = wards.map((w) => ({
      ...w,
      beds: w.beds.map((b) => {
        if (b.status === 'OCCUPIED') counts.occupied++;
        else if (b.status === 'AVAILABLE') counts.available++;
        else if (b.status === 'MAINTENANCE') counts.maintenance++;
        else if (b.status === 'RESERVED') counts.reserved++;
        return { ...b, admission: byBed.get(b.id) ?? null };
      }),
    }));
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const dischargesToday = await db.admission.count({ where: { status: 'DISCHARGED', dischargedAt: { gte: start } } });
    return { wards: wardsOut, counts: { ...counts, dischargesToday } };
  }

  // ── Admissions ────────────────────────────────────────────────
  listAdmissions(ctx: RequestContext, filters: { status?: string; wardId?: string; q?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.wardId) where.bed = { wardId: filters.wardId };
    if (filters.q)
      where.patient = {
        OR: [
          { fullName: { contains: filters.q, mode: 'insensitive' } },
          { mrn: { contains: filters.q, mode: 'insensitive' } },
        ],
      };
    return db.admission.findMany({
      where,
      orderBy: { admittedAt: 'desc' },
      take: 200,
      include: { patient: PATIENT_SELECT, bed: { include: { ward: { select: { name: true } } } } },
    });
  }

  async admit(ctx: RequestContext, dto: CreateAdmissionDto) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({
      where: { id: dto.patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new BadRequestException('Patient not found');
    const bed = await s.db.bed.findFirst({ where: { id: dto.bedId } });
    if (!bed) throw new BadRequestException('Bed not found');
    if (bed.status !== 'AVAILABLE') throw new BadRequestException('Bed is not available');

    const admission = await tenantTransaction(s.tenantId, async (tx) => {
      const fresh = await tx.bed.findFirst({ where: { id: dto.bedId } });
      if (!fresh || fresh.status !== 'AVAILABLE') throw new BadRequestException('Bed was just taken — pick another');
      // An IPD encounter anchors nursing vitals (Vitals require an encounterId).
      const encounter = await tx.encounter.create({
        data: {
          tenantId: s.tenantId,
          patientId: dto.patientId,
          providerId: dto.providerId,
          type: 'IPD',
          status: 'IN_PROGRESS',
          chiefComplaint: dto.reason,
          startedAt: new Date(),
        },
      });
      const created = await tx.admission.create({
        data: {
          tenantId: s.tenantId,
          patientId: dto.patientId,
          bedId: dto.bedId,
          providerId: dto.providerId,
          encounterId: encounter.id,
          status: 'ADMITTED',
          expectedDischargeAt: dto.expectedDischargeAt ? new Date(dto.expectedDischargeAt) : null,
        },
      });
      await tx.bed.update({ where: { id: dto.bedId }, data: { status: 'OCCUPIED' } });
      return created;
    });

    await this.record(s, 'ipd.admit', 'admission', admission.id, { patientId: dto.patientId, bedId: dto.bedId });
    await this.notifications?.safeNotify(ctx, {
      category: 'IPD',
      type: 'ipd.admission.created',
      severity: 'INFO',
      title: 'IPD admission created',
      message: 'A patient has been admitted to IPD.',
      actionUrl: `/ipd/admissions/${admission.id}`,
      metadata: { admissionId: admission.id, bedId: dto.bedId },
      roleCodes: ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN'],
    });
    return this.getAdmission(ctx, admission.id);
  }

  private async load(s: Scope, id: string) {
    const adm = await s.db.admission.findFirst({ where: { id } });
    if (!adm) throw new NotFoundException('Admission not found');
    return adm;
  }

  async getAdmission(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const adm = await s.db.admission.findFirst({
      where: { id },
      include: {
        patient: { include: { allergies: true } },
        bed: { include: { ward: true } },
        rounds: { orderBy: { createdAt: 'desc' } },
        charges: { orderBy: { createdAt: 'desc' } },
        transfers: { orderBy: { transferredAt: 'desc' } },
      },
    });
    if (!adm) throw new NotFoundException('Admission not found');
    const [provider, nursingNotes, medications, vitals, labOrders, bill, dischargeSummary] = await Promise.all([
      adm.providerId
        ? s.db.provider.findFirst({ where: { id: adm.providerId }, include: { user: { select: { fullName: true } } } })
        : null,
      s.db.nursingNote.findMany({ where: { admissionId: id }, orderBy: { createdAt: 'desc' } }),
      s.db.medicationAdministration.findMany({ where: { admissionId: id }, orderBy: { administeredAt: 'desc' } }),
      adm.encounterId
        ? s.db.vitals.findMany({ where: { encounterId: adm.encounterId }, orderBy: { recordedAt: 'desc' } })
        : Promise.resolve([]),
      s.db.labOrder.findMany({ where: { admissionId: id }, orderBy: { createdAt: 'desc' } }),
      s.db.bill.findFirst({
        where: { admissionId: id },
        orderBy: { createdAt: 'desc' },
        include: { items: true, payments: true },
      }),
      s.db.dischargeSummary.findUnique({ where: { admissionId: id } }),
    ]);
    return {
      ...adm,
      providerName: provider?.user?.fullName ?? null,
      nursingNotes,
      medications,
      vitals,
      labOrders,
      bill,
      dischargeSummary,
    };
  }

  async transfer(ctx: RequestContext, id: string, dto: TransferDto) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    if (adm.status !== 'ADMITTED')
      throw new BadRequestException(`Cannot transfer a ${adm.status.toLowerCase()} admission`);
    if (dto.toBedId === adm.bedId) throw new BadRequestException('Patient is already in that bed');
    const toBed = await s.db.bed.findFirst({ where: { id: dto.toBedId } });
    if (!toBed) throw new BadRequestException('Target bed not found');
    if (toBed.status !== 'AVAILABLE') throw new BadRequestException('Target bed is not available');

    await tenantTransaction(s.tenantId, async (tx) => {
      const fresh = await tx.bed.findFirst({ where: { id: dto.toBedId } });
      if (!fresh || fresh.status !== 'AVAILABLE') throw new BadRequestException('Target bed was just taken');
      await tx.bedTransfer.create({
        data: {
          tenantId: s.tenantId,
          admissionId: id,
          fromBedId: adm.bedId,
          toBedId: dto.toBedId,
          reason: dto.reason,
          transferredById: s.actorId,
        },
      });
      await tx.bed.update({ where: { id: adm.bedId }, data: { status: 'AVAILABLE' } });
      await tx.bed.update({ where: { id: dto.toBedId }, data: { status: 'OCCUPIED' } });
      await tx.admission.update({ where: { id }, data: { bedId: dto.toBedId } });
    });

    await this.record(s, 'ipd.transfer', 'admission', id, {
      fromBedId: adm.bedId,
      toBedId: dto.toBedId,
      reason: dto.reason,
    });
    await this.notifications?.safeNotify(ctx, {
      category: 'IPD',
      type: 'ipd.bed_transfer',
      severity: 'INFO',
      title: 'IPD bed transfer completed',
      message: 'An admitted patient has been transferred to another bed.',
      actionUrl: `/ipd/admissions/${id}`,
      metadata: { admissionId: id, fromBedId: adm.bedId, toBedId: dto.toBedId },
      roleCodes: ['NURSE', 'DOCTOR', 'HOSPITAL_ADMIN'],
    });
    return this.getAdmission(ctx, id);
  }

  async addRound(ctx: RequestContext, id: string, dto: RoundDto) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    if (adm.status !== 'ADMITTED') throw new BadRequestException('Admission is not active');
    const round = await s.db.ipdRound.create({
      data: {
        tenantId: s.tenantId,
        admissionId: id,
        providerId: dto.providerId ?? ctx.providerId ?? null,
        notes: dto.notes,
      },
    });
    await this.record(s, 'ipd.round.write', 'ipd_round', round.id, { admissionId: id });
    return round;
  }

  async addCharge(ctx: RequestContext, id: string, dto: ChargeDto) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    if (adm.status !== 'ADMITTED') throw new BadRequestException('Admission is not active');
    const quantity = dto.quantity ?? 1;
    const total = quantity * dto.unitPrice;

    let bill = await s.db.bill.findFirst({
      where: { admissionId: id, status: { in: ['UNPAID', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!bill) {
      const billNumber = await nextBillNumber(s.db, s.tenantId);
      bill = await s.db.bill.create({
        data: {
          tenantId: s.tenantId,
          patientId: adm.patientId,
          admissionId: id,
          billNumber,
          totalAmount: total,
          discount: 0,
          netAmount: total,
          status: 'UNPAID',
          notes: 'IPD charges',
        },
      });
    } else {
      const totalAmount = bill.totalAmount + total;
      await s.db.bill.update({ where: { id: bill.id }, data: { totalAmount, netAmount: totalAmount - bill.discount } });
    }
    const billItem = await s.db.billItem.create({
      data: {
        tenantId: s.tenantId,
        billId: bill.id,
        sourceType: 'IPD' as any,
        name: dto.description,
        quantity,
        unitPrice: dto.unitPrice,
        total,
      },
    });
    const charge = await s.db.ipdCharge.create({
      data: {
        tenantId: s.tenantId,
        admissionId: id,
        catalogId: dto.catalogId,
        description: dto.description,
        quantity,
        unitPrice: dto.unitPrice,
        notes: dto.notes,
        createdById: s.actorId,
        billItemId: billItem.id,
      },
    });
    const ledgerCharge = await s.db.billableCharge.create({
      data: {
        tenantId: s.tenantId,
        patientId: adm.patientId,
        admissionId: id,
        billId: bill.id,
        billItemId: billItem.id,
        catalogId: dto.catalogId ?? null,
        sourceModule: 'IPD',
        sourceType: 'IPD_CHARGE',
        sourceId: charge.id,
        name: dto.description,
        quantity,
        unitPrice: dto.unitPrice,
        total,
        status: 'BILLED',
        createdById: s.actorId,
      },
    });
    await this.record(s, 'ipd.charge.write', 'ipd_charge', charge.id, { admissionId: id, billId: bill.id, total });
    await this.record(s, 'charge.create', 'billable_charge', ledgerCharge.id, {
      admissionId: id,
      billId: bill.id,
      sourceModule: 'IPD',
      total,
    });
    return charge;
  }

  // ── Per-diem bed/room charges (Phase 21.1) ────────────────────
  /** Read the inputs and compute the bed-charge plan as of a given instant (no writes). */
  private async computeBedPlan(
    s: Scope,
    adm: {
      id: string;
      bedId: string;
      admittedAt: Date | string;
      dischargedAt: Date | string | null;
      bedChargedThrough: Date | string | null;
    },
    asOf: Date,
  ): Promise<BedChargePlan> {
    const transfers = await s.db.bedTransfer.findMany({
      where: { admissionId: adm.id },
      orderBy: { transferredAt: 'asc' },
    });
    const bedIds = new Set<string>([adm.bedId]);
    for (const t of transfers) {
      bedIds.add(t.fromBedId);
      bedIds.add(t.toBedId);
    }
    const beds = await s.db.bed.findMany({ where: { id: { in: [...bedIds] } }, include: { ward: true } });
    const wardByBedId = new Map(
      beds
        .filter((b: any) => b.ward)
        .map((b: any) => [
          b.id,
          {
            wardId: b.ward.id,
            wardName: b.ward.name,
            dailyRate: b.ward.dailyRate ?? 0,
            chargeCatalogId: b.ward.chargeCatalogId ?? null,
          },
        ]),
    );
    const settings = await s.db.hospitalSettings.findUnique({ where: { tenantId: s.tenantId } });
    return planBedCharges({
      admission: {
        bedId: adm.bedId,
        admittedAt: new Date(adm.admittedAt),
        dischargedAt: adm.dischargedAt ? new Date(adm.dischargedAt) : null,
        bedChargedThrough: adm.bedChargedThrough ? new Date(adm.bedChargedThrough) : null,
      },
      transfers: transfers.map((t: any) => ({
        fromBedId: t.fromBedId,
        toBedId: t.toBedId,
        transferredAt: new Date(t.transferredAt),
      })),
      wardByBedId,
      policy: bedChargePolicyFromSettings(settings ?? undefined),
      asOf,
    });
  }

  /** Post a computed bed-charge plan onto the running IPD bill and advance the watermark. */
  private async postBedCharges(tx: TenantTx, s: Scope, adm: { id: string; patientId: string }, plan: BedChargePlan) {
    const billable = plan.lines.filter((l) => l.total > 0);
    if (!billable.length) {
      if (plan.chargedThrough)
        await tx.admission.update({ where: { id: adm.id }, data: { bedChargedThrough: plan.chargedThrough } });
      return { billId: null as string | null, posted: 0 };
    }
    const added = billable.reduce((sum, l) => sum + l.total, 0);
    let bill = await tx.bill.findFirst({
      where: { admissionId: adm.id, status: { in: ['UNPAID', 'PARTIAL'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!bill) {
      const billNumber = await nextBillNumber(tx as unknown as TenantClient, s.tenantId);
      bill = await tx.bill.create({
        data: {
          tenantId: s.tenantId,
          patientId: adm.patientId,
          admissionId: adm.id,
          billNumber,
          totalAmount: added,
          discount: 0,
          netAmount: added,
          status: 'UNPAID',
          notes: 'IPD charges',
        },
      });
    } else {
      const totalAmount = bill.totalAmount + added;
      await tx.bill.update({ where: { id: bill.id }, data: { totalAmount, netAmount: totalAmount - bill.discount } });
    }
    for (const line of billable) {
      const desc = `${line.wardName} room charge (${line.units} day${line.units > 1 ? 's' : ''})`;
      const item = await tx.billItem.create({
        data: {
          tenantId: s.tenantId,
          billId: bill.id,
          catalogId: line.catalogId,
          sourceType: 'IPD' as any,
          name: desc,
          quantity: line.units,
          unitPrice: line.unitPrice,
          total: line.total,
        },
      });
      const ipdCharge = await tx.ipdCharge.create({
        data: {
          tenantId: s.tenantId,
          admissionId: adm.id,
          catalogId: line.catalogId,
          description: desc,
          quantity: line.units,
          unitPrice: line.unitPrice,
          notes: `Auto bed charge ${line.fromDate}…${line.toDate}`,
          createdById: s.actorId,
          billItemId: item.id,
        },
      });
      await tx.billableCharge.create({
        data: {
          tenantId: s.tenantId,
          patientId: adm.patientId,
          admissionId: adm.id,
          billId: bill.id,
          billItemId: item.id,
          catalogId: line.catalogId,
          sourceModule: 'IPD' as any,
          sourceType: 'BED_CHARGE',
          sourceId: ipdCharge.id,
          name: desc,
          quantity: line.units,
          unitPrice: line.unitPrice,
          total: line.total,
          status: 'BILLED' as any,
          createdById: s.actorId,
        },
      });
    }
    await tx.admission.update({ where: { id: adm.id }, data: { bedChargedThrough: plan.chargedThrough } });
    return { billId: bill.id as string | null, posted: billable.length };
  }

  /**
   * Preview bed charges without writing: what is billable NOW (completed days), the
   * running total if the patient were discharged now, and the current room rate — so
   * the UI can show the rate even before any calendar day has completed.
   */
  async previewBedCharges(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    const now = new Date();
    const pending = await this.computeBedPlan(s, adm as any, now);
    const projected = adm.dischargedAt
      ? pending
      : await this.computeBedPlan(s, { ...(adm as any), dischargedAt: now }, now);
    const bed = await s.db.bed.findFirst({ where: { id: adm.bedId }, include: { ward: true } });
    return {
      pending,
      projected,
      currentWard: bed?.ward ? { id: bed.ward.id, name: bed.ward.name, dailyRate: bed.ward.dailyRate ?? 0 } : null,
      admittedAt: adm.admittedAt,
      bedChargedThrough: adm.bedChargedThrough ?? null,
    };
  }

  /** Interim/manual accrual: post bed charges accrued through `asOf` (default now). */
  async accrueBedCharges(ctx: RequestContext, id: string, asOf?: string) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    const asOfDate = asOf ? new Date(asOf) : new Date();
    if (Number.isNaN(asOfDate.getTime())) throw new BadRequestException('Invalid asOf date');
    const plan = await this.computeBedPlan(s, adm as any, asOfDate);
    const result = await tenantTransaction(s.tenantId, (tx) =>
      this.postBedCharges(tx, s, { id, patientId: adm.patientId }, plan),
    );
    if (result.billId) {
      await this.record(s, 'charge.create', 'billable_charge', result.billId, {
        admissionId: id,
        sourceModule: 'IPD',
        sourceType: 'BED_CHARGE',
        units: plan.totalUnits,
        total: plan.totalAmount,
      });
      await this.record(s, 'ipd.bed_charge.accrue', 'admission', id, {
        units: plan.totalUnits,
        total: plan.totalAmount,
        billId: result.billId,
      });
    }
    return { posted: result.posted, billId: result.billId, plan };
  }

  async discharge(ctx: RequestContext, id: string, dto: DischargeDto) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    if (adm.status !== 'ADMITTED') throw new BadRequestException(`Admission is already ${adm.status.toLowerCase()}`);

    // Final bed-charge true-up: compute against the discharge instant before the txn.
    const dischargedAt = new Date();
    const plan = await this.computeBedPlan(s, { ...(adm as any), dischargedAt }, dischargedAt);
    let billResult: { billId: string | null; posted: number } = { billId: null, posted: 0 };

    await tenantTransaction(s.tenantId, async (tx) => {
      await tx.admission.update({
        where: { id },
        data: {
          status: 'DISCHARGED',
          dischargedAt,
          dischargeReason: dto.reason,
          dischargeSummary: dto.summary,
          dischargeNotes: dto.instructions,
        },
      });
      await tx.bed.update({ where: { id: adm.bedId }, data: { status: 'AVAILABLE' } });
      if (adm.encounterId)
        await tx.encounter.update({
          where: { id: adm.encounterId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });
      await tx.dischargeSummary.upsert({
        where: { admissionId: id },
        create: {
          tenantId: s.tenantId,
          admissionId: id,
          summary: dto.summary,
          instructions: dto.instructions,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
          preparedById: s.actorId,
          finalizedAt: new Date(),
        },
        update: {
          summary: dto.summary,
          instructions: dto.instructions,
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
          finalizedAt: new Date(),
        },
      });
      billResult = await this.postBedCharges(tx, s, { id, patientId: adm.patientId }, plan);
    });

    await this.record(s, 'ipd.discharge', 'admission', id, { reason: dto.reason });
    if (billResult.billId) {
      await this.record(s, 'charge.create', 'billable_charge', billResult.billId, {
        admissionId: id,
        sourceModule: 'IPD',
        sourceType: 'BED_CHARGE',
        units: plan.totalUnits,
        total: plan.totalAmount,
      });
      await this.record(s, 'ipd.bed_charge.accrue', 'admission', id, {
        units: plan.totalUnits,
        total: plan.totalAmount,
        billId: billResult.billId,
      });
    }
    await this.notifications?.safeNotify(ctx, {
      category: 'IPD',
      type: 'ipd.discharge_summary.ready',
      severity: 'SUCCESS',
      title: 'Discharge summary ready',
      message: 'An IPD discharge summary has been finalized.',
      actionUrl: `/ipd/admissions/${id}/summary`,
      metadata: { admissionId: id },
      roleCodes: ['NURSE', 'DOCTOR', 'BILLING', 'HOSPITAL_ADMIN'],
    });
    return this.getAdmission(ctx, id);
  }

  async summary(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const admission = await this.getAdmission(ctx, id);
    const [tenant, settings, diagnoses] = await Promise.all([
      s.db.tenant.findUnique({ where: { id: s.tenantId } }),
      s.db.hospitalSettings.findUnique({ where: { tenantId: s.tenantId } }),
      admission.encounterId
        ? s.db.diagnosis.findMany({ where: { encounterId: admission.encounterId } })
        : Promise.resolve([]),
    ]);
    return {
      admission,
      diagnoses,
      hospital: {
        name: tenant?.name ?? 'Hospital',
        address: tenant?.address ?? null,
        phone: tenant?.contactPhone ?? null,
        currency: settings?.currency ?? 'INR',
      },
    };
  }
}
