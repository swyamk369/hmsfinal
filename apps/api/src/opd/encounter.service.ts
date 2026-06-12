import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MODULES, type TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import { nextToken } from '../common/sequences';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CompleteEncounterDto,
  ConsultationChargeDto,
  CreateEncounterDto,
  CreatePrescriptionDto,
  DiagnosisDto,
  NoteDto,
  VitalsDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, dob: true, sex: true, phone: true } };

// Allowed encounter status transitions.
const TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class EncounterService {
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

  private async load(s: Scope, id: string) {
    const enc = await s.db.encounter.findFirst({ where: { id } });
    if (!enc) throw new NotFoundException('Encounter not found');
    return enc;
  }

  private assertTransition(from: string, to: string) {
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException(`Cannot move encounter from ${from} to ${to}`);
    }
  }

  private assertActive(status: string) {
    if (!['CHECKED_IN', 'IN_PROGRESS'].includes(status)) {
      throw new BadRequestException(`Encounter is ${status.toLowerCase()} — clinical data cannot be changed`);
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  list(ctx: RequestContext, filters: { patientId?: string; status?: string; providerId?: string; today?: boolean }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.today) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    }
    return db.encounter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { patient: PATIENT_SELECT },
    });
  }

  queue(ctx: RequestContext, filters: { providerId?: string; departmentId?: string }) {
    const { db } = this.scope(ctx);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const where: any = { createdAt: { gte: start } };
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    return db.encounter.findMany({ where, orderBy: { tokenNumber: 'asc' }, include: { patient: PATIENT_SELECT } });
  }

  async create(ctx: RequestContext, dto: CreateEncounterDto) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({
      where: { id: dto.patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new BadRequestException('Patient not found');
    const token = await nextToken(s.db);
    const enc = await s.db.encounter.create({
      data: {
        tenantId: s.tenantId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        departmentId: dto.departmentId,
        appointmentId: dto.appointmentId,
        type: (dto.type ?? 'WALK_IN') as any,
        status: 'CHECKED_IN',
        chiefComplaint: dto.chiefComplaint,
        tokenNumber: token,
      },
      include: { patient: PATIENT_SELECT },
    });
    if (dto.appointmentId) {
      await s.db.appointment.updateMany({ where: { id: dto.appointmentId }, data: { status: 'CHECKED_IN' } });
    }
    if (ctx.modules.has(MODULES.BILLING)) await this.postDefaultConsultationCharge(s, enc.id, dto.patientId);
    await this.record(s, 'encounter.create', 'encounter', enc.id, { patientId: dto.patientId, token });
    return enc;
  }

  async checkin(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertTransition(enc.status, 'CHECKED_IN');
    const token = enc.tokenNumber ?? (await nextToken(s.db));
    const updated = await s.db.encounter.update({ where: { id }, data: { status: 'CHECKED_IN', tokenNumber: token } });
    if (ctx.modules.has(MODULES.BILLING)) await this.postDefaultConsultationCharge(s, id, enc.patientId);
    await this.record(s, 'encounter.checkin', 'encounter', id, { token });
    return updated;
  }

  private async postDefaultConsultationCharge(s: Scope, encounterId: string, patientId: string) {
    return this.createConsultationCharge(s, encounterId, patientId, {}, true);
  }

  private async createConsultationCharge(
    s: Scope,
    encounterId: string,
    patientId: string,
    dto: ConsultationChargeDto,
    allowMissingDefault = false,
  ) {
    const duplicate = await s.db.billableCharge.findFirst({
      where: {
        encounterId,
        sourceModule: 'OPD' as any,
        sourceType: 'CONSULTATION',
        status: { in: ['PENDING', 'BILLED'] as any },
      },
    });
    if (duplicate) return duplicate;

    let catalog = null;
    let catalogId = dto.catalogId ?? null;
    if (!catalogId) {
      const settings = await s.db.hospitalSettings.findUnique({ where: { tenantId: s.tenantId } });
      catalogId = settings?.defaultConsultationCatalogId ?? null;
    }
    if (catalogId) {
      catalog = await s.db.serviceCatalog.findFirst({ where: { id: catalogId, active: true } });
    }

    const name = (dto.name?.trim() || catalog?.name || 'OPD consultation').slice(0, 200);
    const unitPrice = dto.unitPrice ?? catalog?.price;
    if (unitPrice == null) {
      if (allowMissingDefault) return null;
      throw new BadRequestException('Configure a default consultation service or enter a consultation fee');
    }
    const quantity = dto.quantity ?? 1;
    const charge = await s.db.billableCharge.create({
      data: {
        tenantId: s.tenantId,
        patientId,
        encounterId,
        catalogId: catalog?.id ?? null,
        sourceModule: 'OPD',
        sourceType: 'CONSULTATION',
        sourceId: encounterId,
        name,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
        createdById: s.actorId,
      },
    });
    await this.record(s, 'charge.create', 'billable_charge', charge.id, {
      sourceModule: 'OPD',
      sourceType: 'CONSULTATION',
      encounterId,
      patientId,
      amount: charge.total,
    });
    return charge;
  }

  async chargeConsultation(ctx: RequestContext, id: string, dto: ConsultationChargeDto) {
    if (!ctx.modules.has(MODULES.BILLING)) throw new ForbiddenException('BILLING module is not enabled');
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    if (enc.status === 'CANCELLED') throw new BadRequestException('Cancelled encounters cannot be charged');
    return this.createConsultationCharge(s, id, enc.patientId, dto);
  }

  async start(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertTransition(enc.status, 'IN_PROGRESS');
    const updated = await s.db.encounter.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    await this.record(s, 'encounter.start', 'encounter', id, {});
    return updated;
  }

  async complete(ctx: RequestContext, id: string, dto: CompleteEncounterDto) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertTransition(enc.status, 'COMPLETED');
    const updated = await s.db.encounter.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        followUpNotes: dto.followUpNotes,
      },
    });
    await this.record(s, 'encounter.complete', 'encounter', id, { followUpDate: dto.followUpDate ?? null });
    return updated;
  }

  async cancel(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertTransition(enc.status, 'CANCELLED');
    const updated = await s.db.encounter.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.record(s, 'encounter.cancel', 'encounter', id, { reason });
    return updated;
  }

  async detail(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const enc = await s.db.encounter.findFirst({
      where: { id },
      include: {
        patient: { include: { allergies: true } },
        vitals: { orderBy: { recordedAt: 'desc' } },
        diagnoses: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        prescriptions: { include: { items: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!enc) throw new NotFoundException('Encounter not found');
    return enc;
  }

  // ── Clinical ──────────────────────────────────────────────────
  async addVitals(ctx: RequestContext, id: string, dto: VitalsDto) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertActive(enc.status);
    const vitals = await s.db.vitals.create({
      data: { tenantId: s.tenantId, encounterId: id, recordedById: s.actorId, ...dto },
    });
    await this.record(s, 'vitals.create', 'vitals', vitals.id, { encounterId: id });
    return vitals;
  }

  getVitals(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    return db.vitals.findMany({ where: { encounterId: id }, orderBy: { recordedAt: 'desc' } });
  }

  async addDiagnosis(ctx: RequestContext, id: string, dto: DiagnosisDto) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertActive(enc.status);
    const diagnosis = await s.db.diagnosis.create({
      data: {
        tenantId: s.tenantId,
        encounterId: id,
        description: dto.description,
        icdCode: dto.icdCode,
        type: (dto.type ?? 'PROVISIONAL') as any,
        notes: dto.notes,
      },
    });
    await this.record(s, 'diagnosis.create', 'diagnosis', diagnosis.id, { encounterId: id });
    return diagnosis;
  }

  getDiagnoses(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    return db.diagnosis.findMany({ where: { encounterId: id }, orderBy: { createdAt: 'desc' } });
  }

  async addNote(ctx: RequestContext, id: string, dto: NoteDto) {
    const s = this.scope(ctx);
    const enc = await this.load(s, id);
    this.assertActive(enc.status);
    const note = await s.db.clinicalNote.create({
      data: {
        tenantId: s.tenantId,
        encounterId: id,
        authorId: s.actorId,
        noteType: (dto.noteType ?? 'GENERAL') as any,
        content: dto.content,
      },
    });
    await this.record(s, 'clinical_note.create', 'clinical_note', note.id, { encounterId: id });
    return note;
  }

  getNotes(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    return db.clinicalNote.findMany({ where: { encounterId: id }, orderBy: { createdAt: 'desc' } });
  }

  // ── Prescriptions ─────────────────────────────────────────────
  listPrescriptions(ctx: RequestContext, encounterId: string) {
    const { db } = this.scope(ctx);
    return db.prescription.findMany({
      where: { encounterId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPrescription(ctx: RequestContext, encounterId: string, dto: CreatePrescriptionDto) {
    const s = this.scope(ctx);
    const enc = await this.load(s, encounterId);
    this.assertActive(enc.status);
    const rx = await s.db.prescription.create({
      data: {
        tenantId: s.tenantId,
        encounterId,
        providerId: enc.providerId,
        status: 'DRAFT',
        notes: dto.notes,
        items: {
          create: dto.items.map((it) => ({
            tenantId: s.tenantId,
            drugName: it.drugName,
            dosage: it.dosage,
            frequency: it.frequency,
            duration: it.duration,
            route: it.route,
            instructions: it.instructions,
            quantity: it.quantity ?? 1,
          })),
        },
      },
      include: { items: true },
    });
    await this.record(s, 'prescription.create', 'prescription', rx.id, { encounterId, items: dto.items.length });
    return rx;
  }

  async getPrescription(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const rx = await s.db.prescription.findFirst({
      where: { id },
      include: { items: true, encounter: { include: { patient: PATIENT_SELECT } } },
    });
    if (!rx) throw new NotFoundException('Prescription not found');
    return rx;
  }

  async finalizePrescription(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const rx = await s.db.prescription.findFirst({ where: { id } });
    if (!rx) throw new NotFoundException('Prescription not found');
    if (rx.status !== 'DRAFT') {
      throw new BadRequestException(`Prescription is already ${rx.status.toLowerCase()} and cannot be finalized again`);
    }
    const updated = await s.db.prescription.update({
      where: { id },
      data: { status: 'FINALIZED', finalizedAt: new Date() },
      include: { items: true },
    });
    await this.record(s, 'prescription.finalize', 'prescription', id, {});
    await this.notifications?.safeNotify(ctx, {
      category: 'PHARMACY',
      type: 'prescription.ready',
      severity: 'INFO',
      title: 'Prescription ready',
      message: 'A finalized prescription is ready for pharmacy dispensing.',
      actionUrl: '/pharmacy',
      metadata: { prescriptionId: id, encounterId: rx.encounterId },
      roleCodes: ['PHARMACIST', 'HOSPITAL_ADMIN'],
    });
    return updated;
  }
}
