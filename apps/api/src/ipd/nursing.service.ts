import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { IpdService } from './ipd.service';
import { MedAdminDto, NursingNoteDto, NursingVitalsDto, UpdateMedAdminDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

@Injectable()
export class NursingService {
  constructor(
    private readonly audit: AuditService,
    private readonly ipd: IpdService,
  ) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  async dashboard(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const admissions = await db.admission.findMany({
      where: { status: 'ADMITTED' },
      orderBy: { admittedAt: 'desc' },
      take: 100,
      include: { patient: { include: { allergies: { select: { id: true } } } }, bed: { include: { ward: { select: { name: true } } } } },
    });
    const encounterIds = admissions.map((a) => a.encounterId).filter(Boolean) as string[];
    const [medsToday, notesToday, vitalsTodayRows] = await Promise.all([
      db.medicationAdministration.count({ where: { administeredAt: { gte: start } } }),
      db.nursingNote.count({ where: { createdAt: { gte: start } } }),
      encounterIds.length
        ? db.vitals.findMany({ where: { encounterId: { in: encounterIds }, recordedAt: { gte: start } }, select: { encounterId: true } })
        : Promise.resolve([]),
    ]);
    const vitalsTodaySet = new Set(vitalsTodayRows.map((v) => v.encounterId));
    const vitalsDue = admissions.filter((a) => !a.encounterId || !vitalsTodaySet.has(a.encounterId)).length;
    const alerts = admissions.filter((a) => (a.patient.allergies?.length ?? 0) > 0).length;
    return {
      admissions: admissions.map((a) => ({ ...a, allergyCount: a.patient.allergies?.length ?? 0 })),
      counts: { admitted: admissions.length, vitalsToday: vitalsTodaySet.size, vitalsDue, medsToday, notesToday, alerts },
    };
  }

  getAdmission(ctx: RequestContext, id: string) {
    return this.ipd.getAdmission(ctx, id);
  }

  private async activeAdmission(s: Scope, id: string) {
    const adm = await s.db.admission.findFirst({ where: { id } });
    if (!adm) throw new NotFoundException('Admission not found');
    if (adm.status !== 'ADMITTED') throw new BadRequestException('Admission is not active');
    return adm;
  }

  async addVitals(ctx: RequestContext, id: string, dto: NursingVitalsDto) {
    const s = this.scope(ctx);
    const adm = await this.activeAdmission(s, id);
    if (!adm.encounterId) throw new BadRequestException('Admission has no clinical encounter for vitals');
    const vitals = await s.db.vitals.create({
      data: { tenantId: s.tenantId, encounterId: adm.encounterId, recordedById: s.actorId, ...dto },
    });
    await this.record(s, 'vitals.write', 'vitals', vitals.id, { admissionId: id });
    return vitals;
  }

  async addNote(ctx: RequestContext, id: string, dto: NursingNoteDto) {
    const s = this.scope(ctx);
    const adm = await this.activeAdmission(s, id);
    const note = await s.db.nursingNote.create({
      data: { tenantId: s.tenantId, patientId: adm.patientId, admissionId: id, encounterId: adm.encounterId, nurseId: s.actorId, note: dto.note },
    });
    await this.record(s, 'nursing.note.write', 'nursing_note', note.id, { admissionId: id });
    return note;
  }

  listMedications(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    return db.medicationAdministration.findMany({ where: { admissionId: id }, orderBy: { administeredAt: 'desc' } });
  }

  async addMedication(ctx: RequestContext, id: string, dto: MedAdminDto) {
    const s = this.scope(ctx);
    const adm = await this.activeAdmission(s, id);
    const med = await s.db.medicationAdministration.create({
      data: {
        tenantId: s.tenantId,
        patientId: adm.patientId,
        admissionId: id,
        prescriptionItemId: dto.prescriptionItemId,
        administeredById: s.actorId,
        status: (dto.status ?? 'ADMINISTERED') as any,
        notes: dto.notes,
      },
    });
    await this.record(s, 'medication.administer', 'medication_administration', med.id, { admissionId: id, status: med.status });
    return med;
  }

  async updateMedication(ctx: RequestContext, medId: string, dto: UpdateMedAdminDto) {
    const s = this.scope(ctx);
    const existing = await s.db.medicationAdministration.findFirst({ where: { id: medId } });
    if (!existing) throw new NotFoundException('Medication record not found');
    const med = await s.db.medicationAdministration.update({
      where: { id: medId },
      data: { status: dto.status as any, notes: dto.notes },
    });
    await this.record(s, 'medication.administer', 'medication_administration', medId, { status: med.status, update: true });
    return med;
  }
}
