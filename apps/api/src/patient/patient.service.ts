import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import { nextMrn } from '../common/sequences';
import type { RequestContext } from '../common/types';
import { AllergyDto, ConsentDto, CreatePatientDto, HistoryDto, UpdatePatientDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

@Injectable()
export class PatientService {
  constructor(private readonly audit: AuditService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  list(ctx: RequestContext, q?: string) {
    const db = requireDb(ctx);
    return db.patient.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { fullName: { contains: q, mode: 'insensitive' } },
                { mrn: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getById(ctx: RequestContext, id: string) {
    const db = requireDb(ctx);
    const patient = await db.patient.findFirst({
      where: { id, deletedAt: null },
      include: { allergies: true, histories: true, consents: { orderBy: { grantedAt: 'desc' } } },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  count(db: TenantClient) {
    return db.patient.count({ where: { deletedAt: null } });
  }

  async register(ctx: RequestContext, dto: CreatePatientDto) {
    const s = this.scope(ctx);
    const mrn = await nextMrn(s.db, s.tenantId);
    const patient = await s.db.patient.create({
      data: {
        tenantId: s.tenantId,
        mrn,
        fullName: dto.fullName,
        dob: dto.dob ? new Date(dto.dob) : null,
        sex: dto.sex,
        phone: dto.phone,
        email: dto.email || null,
        address: dto.address,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
      },
    });
    if (dto.consent) {
      await s.db.consent.create({
        data: { tenantId: s.tenantId, patientId: patient.id, purpose: 'Data processing & treatment' },
      });
    }
    await this.record(s, 'patient.create', 'patient', patient.id, { mrn });
    return patient;
  }

  async update(ctx: RequestContext, id: string, dto: UpdatePatientDto) {
    const s = this.scope(ctx);
    const existing = await s.db.patient.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException('Patient not found');
    const patient = await s.db.patient.update({
      where: { id },
      data: {
        fullName: dto.fullName,
        dob: dto.dob ? new Date(dto.dob) : undefined,
        sex: dto.sex,
        phone: dto.phone,
        email: dto.email === '' ? null : dto.email,
        address: dto.address,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
      },
    });
    await this.record(s, 'patient.update', 'patient', id, { changes: dto });
    return patient;
  }

  async archive(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const existing = await s.db.patient.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Patient not found');
    if (existing.deletedAt) throw new BadRequestException('Patient is already archived');
    const patient = await s.db.patient.update({
      where: { id },
      data: { deletedAt: new Date(), archiveReason: reason },
    });
    await this.record(s, 'patient.archive', 'patient', id, { reason });
    return patient;
  }

  async timeline(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundException('Patient not found');

    const [encounters, appointments, bills, prescriptions, labOrders, allergies, histories, consents] =
      await Promise.all([
        s.db.encounter.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
        s.db.appointment.findMany({ where: { patientId: id }, orderBy: { scheduledAt: 'desc' }, take: 50 }),
        s.db.bill.findMany({
          where: { patientId: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { payments: true },
        }),
        s.db.prescription.findMany({
          where: { encounter: { patientId: id } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { items: true },
        }),
        s.db.labOrder.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
        s.db.allergy.findMany({ where: { patientId: id } }),
        s.db.medicalHistory.findMany({ where: { patientId: id }, orderBy: { recordedAt: 'desc' } }),
        s.db.consent.findMany({ where: { patientId: id }, orderBy: { grantedAt: 'desc' } }),
      ]);

    return { patient, encounters, appointments, bills, prescriptions, labOrders, allergies, histories, consents };
  }

  private async assertPatient(s: Scope, patientId: string) {
    const p = await s.db.patient.findFirst({ where: { id: patientId, deletedAt: null }, select: { id: true } });
    if (!p) throw new NotFoundException('Patient not found');
  }

  async addConsent(ctx: RequestContext, id: string, dto: ConsentDto) {
    const s = this.scope(ctx);
    await this.assertPatient(s, id);
    const consent = await s.db.consent.create({ data: { tenantId: s.tenantId, patientId: id, purpose: dto.purpose } });
    await this.record(s, 'consent.create', 'consent', consent.id, { patientId: id, purpose: dto.purpose });
    return consent;
  }

  async addAllergy(ctx: RequestContext, id: string, dto: AllergyDto) {
    const s = this.scope(ctx);
    await this.assertPatient(s, id);
    const allergy = await s.db.allergy.create({
      data: { tenantId: s.tenantId, patientId: id, substance: dto.substance, severity: dto.severity, notes: dto.notes },
    });
    await this.record(s, 'allergy.create', 'allergy', allergy.id, { patientId: id, substance: dto.substance });
    return allergy;
  }

  async addHistory(ctx: RequestContext, id: string, dto: HistoryDto) {
    const s = this.scope(ctx);
    await this.assertPatient(s, id);
    const history = await s.db.medicalHistory.create({
      data: { tenantId: s.tenantId, patientId: id, type: dto.type, description: dto.description },
    });
    await this.record(s, 'history.create', 'medical_history', history.id, { patientId: id, type: dto.type });
    return history;
  }
}
