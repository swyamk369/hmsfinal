import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, phone: true } };

@Injectable()
export class AppointmentService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications?: NotificationsService,
  ) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, {
      tenantId: s.tenantId,
      actorId: s.actorId,
      action,
      entity: 'appointment',
      entityId,
      metadata,
    });
  }

  /** Active doctors for OPD pickers (name + speciality). */
  async doctors(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const providers = await db.provider.findMany({
      where: { type: 'DOCTOR', active: true },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return providers.map((p) => ({
      id: p.id,
      fullName: p.user?.fullName ?? 'Doctor',
      speciality: p.speciality,
      departmentId: p.departmentId,
    }));
  }

  /** Active departments for OPD pickers. */
  departments(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }

  list(ctx: RequestContext, filters: { date?: string; status?: string; providerId?: string; patientId?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.scheduledAt = { gte: start, lt: end };
    }
    return db.appointment.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take: 200,
      include: { patient: PATIENT_SELECT },
    });
  }

  private async assertPatient(s: Scope, patientId: string) {
    const p = await s.db.patient.findFirst({ where: { id: patientId, deletedAt: null }, select: { id: true } });
    if (!p) throw new BadRequestException('Patient not found');
  }

  private async providerUserIds(s: Scope, providerId?: string | null) {
    if (!providerId) return [];
    const provider = await s.db.provider.findFirst({
      where: { id: providerId, active: true },
      select: { userId: true },
    });
    return provider?.userId ? [provider.userId] : [];
  }

  async create(ctx: RequestContext, dto: CreateAppointmentDto) {
    const s = this.scope(ctx);
    await this.assertPatient(s, dto.patientId);
    const appt = await s.db.appointment.create({
      data: {
        tenantId: s.tenantId,
        patientId: dto.patientId,
        providerId: dto.providerId,
        departmentId: dto.departmentId,
        scheduledAt: new Date(dto.scheduledAt),
        reason: dto.reason,
        status: 'SCHEDULED',
      },
      include: { patient: PATIENT_SELECT },
    });
    await this.record(s, 'appointment.create', appt.id, { patientId: dto.patientId, scheduledAt: dto.scheduledAt });
    await this.notifications?.safeNotify(ctx, {
      category: 'APPOINTMENT',
      type: 'appointment.confirmed',
      severity: 'INFO',
      title: 'Appointment scheduled',
      message: 'A patient appointment has been scheduled.',
      actionUrl: '/opd/appointments',
      metadata: { appointmentId: appt.id },
      roleCodes: ['RECEPTION', 'HOSPITAL_ADMIN'],
      userIds: await this.providerUserIds(s, appt.providerId),
    });
    return appt;
  }

  private async load(s: Scope, id: string) {
    const appt = await s.db.appointment.findFirst({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    return appt;
  }

  async update(ctx: RequestContext, id: string, dto: UpdateAppointmentDto) {
    const s = this.scope(ctx);
    await this.load(s, id);
    const appt = await s.db.appointment.update({
      where: { id },
      data: {
        providerId: dto.providerId,
        departmentId: dto.departmentId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        reason: dto.reason,
      },
      include: { patient: PATIENT_SELECT },
    });
    await this.record(s, 'appointment.update', id, { changes: dto });
    return appt;
  }

  async reschedule(ctx: RequestContext, id: string, scheduledAt: string, reason: string) {
    const s = this.scope(ctx);
    const appt = await this.load(s, id);
    if (['CANCELLED', 'COMPLETED'].includes(appt.status)) {
      throw new BadRequestException(`Cannot reschedule a ${appt.status.toLowerCase()} appointment`);
    }
    const updated = await s.db.appointment.update({
      where: { id },
      data: { scheduledAt: new Date(scheduledAt), status: 'SCHEDULED' },
      include: { patient: PATIENT_SELECT },
    });
    await this.record(s, 'appointment.reschedule', id, { from: appt.scheduledAt, to: scheduledAt, reason });
    await this.notifications?.safeNotify(ctx, {
      category: 'APPOINTMENT',
      type: 'appointment.rescheduled',
      severity: 'INFO',
      title: 'Appointment rescheduled',
      message: 'An appointment time has changed.',
      actionUrl: '/opd/appointments',
      metadata: { appointmentId: id },
      roleCodes: ['RECEPTION', 'HOSPITAL_ADMIN'],
      userIds: await this.providerUserIds(s, updated.providerId),
    });
    return updated;
  }

  async cancel(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const appt = await this.load(s, id);
    if (['CANCELLED', 'COMPLETED'].includes(appt.status)) {
      throw new BadRequestException(`Appointment is already ${appt.status.toLowerCase()}`);
    }
    const updated = await s.db.appointment.update({
      where: { id },
      data: { status: 'CANCELLED', cancellationReason: reason },
      include: { patient: PATIENT_SELECT },
    });
    await this.record(s, 'appointment.cancel', id, { reason });
    await this.notifications?.safeNotify(ctx, {
      category: 'APPOINTMENT',
      type: 'appointment.cancelled',
      severity: 'WARNING',
      title: 'Appointment cancelled',
      message: 'An appointment has been cancelled.',
      actionUrl: '/opd/appointments',
      metadata: { appointmentId: id },
      roleCodes: ['RECEPTION', 'HOSPITAL_ADMIN'],
      userIds: await this.providerUserIds(s, updated.providerId),
    });
    return updated;
  }
}
