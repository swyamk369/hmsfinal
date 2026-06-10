import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction } from '@hms/db';
import type { TenantClient } from '@hms/db';
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
  constructor(private readonly audit: AuditService, private readonly notifications?: NotificationsService) {}

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
    const ward = await s.db.ward.create({ data: { tenantId: s.tenantId, name: dto.name, type: (dto.type ?? 'GENERAL') as any } });
    await this.record(s, 'ward.create', 'ward', ward.id, { name: ward.name });
    return ward;
  }

  async updateWard(ctx: RequestContext, id: string, dto: UpdateWardDto) {
    const s = this.scope(ctx);
    const existing = await s.db.ward.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Ward not found');
    const ward = await s.db.ward.update({ where: { id }, data: { name: dto.name, type: dto.type as any, active: dto.active } });
    await this.record(s, dto.active === false ? 'ward.deactivate' : 'ward.update', 'ward', id, { changes: dto });
    return ward;
  }

  // ── Beds ──────────────────────────────────────────────────────
  listBeds(ctx: RequestContext, wardId?: string) {
    const { db } = this.scope(ctx);
    return db.bed.findMany({ where: wardId ? { wardId } : {}, orderBy: { bedNumber: 'asc' }, include: { ward: { select: { name: true } } } });
  }

  async createBed(ctx: RequestContext, dto: CreateBedDto) {
    const s = this.scope(ctx);
    const ward = await s.db.ward.findFirst({ where: { id: dto.wardId }, select: { id: true } });
    if (!ward) throw new BadRequestException('Ward not found');
    const bed = await s.db.bed.create({
      data: { tenantId: s.tenantId, wardId: dto.wardId, bedNumber: dto.bedNumber, status: (dto.status ?? 'AVAILABLE') as any },
    });
    await this.record(s, 'bed.create', 'bed', bed.id, { bedNumber: bed.bedNumber });
    return bed;
  }

  async updateBed(ctx: RequestContext, id: string, dto: UpdateBedDto) {
    const s = this.scope(ctx);
    const existing = await s.db.bed.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Bed not found');
    if (dto.status && existing.status === 'OCCUPIED' && dto.status !== 'OCCUPIED') {
      throw new BadRequestException('Cannot change the status of an occupied bed — discharge or transfer the patient first');
    }
    const bed = await s.db.bed.update({ where: { id }, data: { bedNumber: dto.bedNumber, status: dto.status as any } });
    await this.record(s, dto.status ? 'bed.status' : 'bed.update', 'bed', id, { changes: dto });
    return bed;
  }

  // ── Occupancy ─────────────────────────────────────────────────
  async occupancy(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const wards = await db.ward.findMany({ where: { active: true }, orderBy: { name: 'asc' }, include: { beds: { orderBy: { bedNumber: 'asc' } } } });
    const bedIds = wards.flatMap((w) => w.beds.map((b) => b.id));
    const admissions = bedIds.length
      ? await db.admission.findMany({ where: { status: 'ADMITTED', bedId: { in: bedIds } }, include: { patient: PATIENT_SELECT } })
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
    if (filters.q) where.patient = { OR: [{ fullName: { contains: filters.q, mode: 'insensitive' } }, { mrn: { contains: filters.q, mode: 'insensitive' } }] };
    return db.admission.findMany({
      where,
      orderBy: { admittedAt: 'desc' },
      take: 200,
      include: { patient: PATIENT_SELECT, bed: { include: { ward: { select: { name: true } } } } },
    });
  }

  async admit(ctx: RequestContext, dto: CreateAdmissionDto) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({ where: { id: dto.patientId, deletedAt: null }, select: { id: true } });
    if (!patient) throw new BadRequestException('Patient not found');
    const bed = await s.db.bed.findFirst({ where: { id: dto.bedId } });
    if (!bed) throw new BadRequestException('Bed not found');
    if (bed.status !== 'AVAILABLE') throw new BadRequestException('Bed is not available');

    const admission = await tenantTransaction(s.tenantId, async (tx) => {
      const fresh = await tx.bed.findFirst({ where: { id: dto.bedId } });
      if (!fresh || fresh.status !== 'AVAILABLE') throw new BadRequestException('Bed was just taken — pick another');
      // An IPD encounter anchors nursing vitals (Vitals require an encounterId).
      const encounter = await tx.encounter.create({
        data: { tenantId: s.tenantId, patientId: dto.patientId, providerId: dto.providerId, type: 'IPD', status: 'IN_PROGRESS', chiefComplaint: dto.reason, startedAt: new Date() },
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
      adm.providerId ? s.db.provider.findFirst({ where: { id: adm.providerId }, include: { user: { select: { fullName: true } } } }) : null,
      s.db.nursingNote.findMany({ where: { admissionId: id }, orderBy: { createdAt: 'desc' } }),
      s.db.medicationAdministration.findMany({ where: { admissionId: id }, orderBy: { administeredAt: 'desc' } }),
      adm.encounterId ? s.db.vitals.findMany({ where: { encounterId: adm.encounterId }, orderBy: { recordedAt: 'desc' } }) : Promise.resolve([]),
      s.db.labOrder.findMany({ where: { admissionId: id }, orderBy: { createdAt: 'desc' } }),
      s.db.bill.findFirst({ where: { admissionId: id }, orderBy: { createdAt: 'desc' }, include: { items: true, payments: true } }),
      s.db.dischargeSummary.findUnique({ where: { admissionId: id } }),
    ]);
    return { ...adm, providerName: provider?.user?.fullName ?? null, nursingNotes, medications, vitals, labOrders, bill, dischargeSummary };
  }

  async transfer(ctx: RequestContext, id: string, dto: TransferDto) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    if (adm.status !== 'ADMITTED') throw new BadRequestException(`Cannot transfer a ${adm.status.toLowerCase()} admission`);
    if (dto.toBedId === adm.bedId) throw new BadRequestException('Patient is already in that bed');
    const toBed = await s.db.bed.findFirst({ where: { id: dto.toBedId } });
    if (!toBed) throw new BadRequestException('Target bed not found');
    if (toBed.status !== 'AVAILABLE') throw new BadRequestException('Target bed is not available');

    await tenantTransaction(s.tenantId, async (tx) => {
      const fresh = await tx.bed.findFirst({ where: { id: dto.toBedId } });
      if (!fresh || fresh.status !== 'AVAILABLE') throw new BadRequestException('Target bed was just taken');
      await tx.bedTransfer.create({
        data: { tenantId: s.tenantId, admissionId: id, fromBedId: adm.bedId, toBedId: dto.toBedId, reason: dto.reason, transferredById: s.actorId },
      });
      await tx.bed.update({ where: { id: adm.bedId }, data: { status: 'AVAILABLE' } });
      await tx.bed.update({ where: { id: dto.toBedId }, data: { status: 'OCCUPIED' } });
      await tx.admission.update({ where: { id }, data: { bedId: dto.toBedId } });
    });

    await this.record(s, 'ipd.transfer', 'admission', id, { fromBedId: adm.bedId, toBedId: dto.toBedId, reason: dto.reason });
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
      data: { tenantId: s.tenantId, admissionId: id, providerId: dto.providerId ?? ctx.providerId ?? null, notes: dto.notes },
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

    let bill = await s.db.bill.findFirst({ where: { admissionId: id, status: { in: ['UNPAID', 'PARTIAL'] } }, orderBy: { createdAt: 'desc' } });
    if (!bill) {
      const billNumber = await nextBillNumber(s.db, s.tenantId);
      bill = await s.db.bill.create({
        data: { tenantId: s.tenantId, patientId: adm.patientId, admissionId: id, billNumber, totalAmount: total, discount: 0, netAmount: total, status: 'UNPAID', notes: 'IPD charges' },
      });
    } else {
      const totalAmount = bill.totalAmount + total;
      await s.db.bill.update({ where: { id: bill.id }, data: { totalAmount, netAmount: totalAmount - bill.discount } });
    }
    const billItem = await s.db.billItem.create({
      data: { tenantId: s.tenantId, billId: bill.id, sourceType: 'IPD' as any, name: dto.description, quantity, unitPrice: dto.unitPrice, total },
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
    await this.record(s, 'ipd.charge.write', 'ipd_charge', charge.id, { admissionId: id, billId: bill.id, total });
    return charge;
  }

  async discharge(ctx: RequestContext, id: string, dto: DischargeDto) {
    const s = this.scope(ctx);
    const adm = await this.load(s, id);
    if (adm.status !== 'ADMITTED') throw new BadRequestException(`Admission is already ${adm.status.toLowerCase()}`);

    await tenantTransaction(s.tenantId, async (tx) => {
      await tx.admission.update({
        where: { id },
        data: { status: 'DISCHARGED', dischargedAt: new Date(), dischargeReason: dto.reason, dischargeSummary: dto.summary, dischargeNotes: dto.instructions },
      });
      await tx.bed.update({ where: { id: adm.bedId }, data: { status: 'AVAILABLE' } });
      if (adm.encounterId) await tx.encounter.update({ where: { id: adm.encounterId }, data: { status: 'COMPLETED', endedAt: new Date() } });
      await tx.dischargeSummary.upsert({
        where: { admissionId: id },
        create: { tenantId: s.tenantId, admissionId: id, summary: dto.summary, instructions: dto.instructions, followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null, preparedById: s.actorId, finalizedAt: new Date() },
        update: { summary: dto.summary, instructions: dto.instructions, followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null, finalizedAt: new Date() },
      });
    });

    await this.record(s, 'ipd.discharge', 'admission', id, { reason: dto.reason });
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
      admission.encounterId ? s.db.diagnosis.findMany({ where: { encounterId: admission.encounterId } }) : Promise.resolve([]),
    ]);
    return {
      admission,
      diagnoses,
      hospital: { name: tenant?.name ?? 'Hospital', address: tenant?.address ?? null, phone: tenant?.contactPhone ?? null, currency: settings?.currency ?? 'INR' },
    };
  }
}
