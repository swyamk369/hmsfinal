import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { SearchIndexService } from './search-index.service';
import type {
  CreateAppointmentTypeDto,
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  CreateDoctorProfileDto,
  HospitalProfileDto,
  PortalSettingsDto,
  UpdateAppointmentTypeDto,
  UpdateAvailabilityRuleDto,
  UpdateDoctorProfileDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

@Injectable()
export class HmsPublicService {
  constructor(private readonly audit: AuditService, private readonly index: SearchIndexService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'profile';
  }

  private async tenantName(s: Scope): Promise<string> {
    const t = await s.db.tenant.findUnique({ where: { id: s.tenantId }, select: { name: true } });
    return t?.name ?? 'Hospital';
  }

  private async portalBookable(s: Scope): Promise<boolean> {
    const p = await s.db.patientPortalSettings.findUnique({ where: { tenantId: s.tenantId } });
    return Boolean(p?.enabled && p?.onlineBookingEnabled);
  }

  // ── Patient portal settings ───────────────────────────────────
  async getPortalSettings(ctx: RequestContext) {
    const s = this.scope(ctx);
    return (
      (await s.db.patientPortalSettings.findUnique({ where: { tenantId: s.tenantId } })) ??
      (await s.db.patientPortalSettings.create({ data: { tenantId: s.tenantId } }))
    );
  }

  async updatePortalSettings(ctx: RequestContext, dto: PortalSettingsDto) {
    const s = this.scope(ctx);
    const row = await s.db.patientPortalSettings.upsert({
      where: { tenantId: s.tenantId },
      create: { tenantId: s.tenantId, ...dto },
      update: { ...dto },
    });
    await this.record(s, 'patient_portal.settings.update', 'patient_portal_settings', row.id, { changes: dto });
    // Bookability of indexed profiles depends on these flags — re-sync.
    const hp = await s.db.publicHospitalProfile.findUnique({ where: { tenantId: s.tenantId } });
    if (hp) await this.index.syncHospital(s.db, s.tenantId, hp, Boolean(row.enabled && row.onlineBookingEnabled));
    return row;
  }

  // ── Public hospital profile ───────────────────────────────────
  getHospitalProfile(ctx: RequestContext) {
    const s = this.scope(ctx);
    return s.db.publicHospitalProfile.findUnique({ where: { tenantId: s.tenantId } });
  }

  async updateHospitalProfile(ctx: RequestContext, dto: HospitalProfileDto) {
    const s = this.scope(ctx);
    const existing = await s.db.publicHospitalProfile.findUnique({ where: { tenantId: s.tenantId } });
    let row;
    if (existing) {
      row = await s.db.publicHospitalProfile.update({ where: { tenantId: s.tenantId }, data: { ...dto } });
    } else {
      const name = dto.hospitalDisplayName || (await this.tenantName(s));
      const slug = `${this.slugify(name)}-${s.tenantId.slice(0, 8)}`;
      row = await s.db.publicHospitalProfile.create({
        data: { tenantId: s.tenantId, hospitalSlug: slug, hospitalDisplayName: name, ...dto },
      });
    }
    await this.record(s, 'public_profile.update', 'public_hospital_profile', row.id, { changes: dto });
    await this.index.syncHospital(s.db, s.tenantId, row, await this.portalBookable(s));
    return row;
  }

  async publishHospitalProfile(ctx: RequestContext) {
    const s = this.scope(ctx);
    const existing = await s.db.publicHospitalProfile.findUnique({ where: { tenantId: s.tenantId } });
    if (!existing) throw new BadRequestException('Create the hospital public profile before publishing');
    const row = await s.db.publicHospitalProfile.update({
      where: { tenantId: s.tenantId },
      data: { isPublic: true, profileStatus: 'PUBLISHED' },
    });
    await this.record(s, 'public_profile.publish', 'public_hospital_profile', row.id, {});
    await this.index.syncHospital(s.db, s.tenantId, row, await this.portalBookable(s));
    return row;
  }

  async hideHospitalProfile(ctx: RequestContext, reason: string) {
    const s = this.scope(ctx);
    const existing = await s.db.publicHospitalProfile.findUnique({ where: { tenantId: s.tenantId } });
    if (!existing) throw new NotFoundException('Hospital public profile not found');
    const row = await s.db.publicHospitalProfile.update({
      where: { tenantId: s.tenantId },
      data: { isPublic: false, profileStatus: 'HIDDEN' },
    });
    await this.record(s, 'public_profile.hide', 'public_hospital_profile', row.id, { reason });
    // De-list hospital AND its doctors from public search while hidden.
    await this.index.syncHospital(s.db, s.tenantId, row, false);
    const docs = await s.db.publicDoctorProfile.findMany();
    for (const d of docs) await this.index.syncDoctor(s.db, s.tenantId, { ...d, isPublic: false }, row.hospitalDisplayName, false);
    return row;
  }

  // ── Public doctor profiles ────────────────────────────────────
  listDoctorProfiles(ctx: RequestContext) {
    const s = this.scope(ctx);
    return s.db.publicDoctorProfile.findMany({ orderBy: { displayName: 'asc' } });
  }

  async createDoctorProfile(ctx: RequestContext, dto: CreateDoctorProfileDto) {
    const s = this.scope(ctx);
    const provider = await s.db.provider.findFirst({ where: { id: dto.doctorId } });
    if (!provider) throw new BadRequestException('Doctor (provider) not found in this hospital');
    const existing = await s.db.publicDoctorProfile.findFirst({ where: { doctorId: dto.doctorId } });
    if (existing) throw new BadRequestException('A public profile already exists for this doctor');
    const slug = `${this.slugify(dto.displayName)}-${dto.doctorId.slice(0, 6)}`;
    const row = await s.db.publicDoctorProfile.create({
      data: { tenantId: s.tenantId, doctorSlug: slug, ...dto },
    });
    await this.record(s, 'doctor_public_profile.create', 'public_doctor_profile', row.id, { doctorId: dto.doctorId });
    return row;
  }

  async updateDoctorProfile(ctx: RequestContext, id: string, dto: UpdateDoctorProfileDto) {
    const s = this.scope(ctx);
    const existing = await s.db.publicDoctorProfile.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Doctor public profile not found');
    const { doctorId: _ignore, ...data } = dto;
    const row = await s.db.publicDoctorProfile.update({ where: { id }, data });
    await this.record(s, 'doctor_public_profile.update', 'public_doctor_profile', id, { changes: dto });
    if (row.profileStatus === 'PUBLISHED' && row.isPublic) await this.resyncDoctor(s, row);
    return row;
  }

  async publishDoctorProfile(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const existing = await s.db.publicDoctorProfile.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Doctor public profile not found');
    const row = await s.db.publicDoctorProfile.update({ where: { id }, data: { isPublic: true, profileStatus: 'PUBLISHED' } });
    await this.record(s, 'doctor_public_profile.publish', 'public_doctor_profile', id, {});
    await this.resyncDoctor(s, row);
    return row;
  }

  async hideDoctorProfile(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const existing = await s.db.publicDoctorProfile.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Doctor public profile not found');
    const row = await s.db.publicDoctorProfile.update({ where: { id }, data: { isPublic: false, profileStatus: 'HIDDEN' } });
    await this.record(s, 'doctor_public_profile.hide', 'public_doctor_profile', id, { reason });
    await this.resyncDoctor(s, row);
    return row;
  }

  private async resyncDoctor(s: Scope, profile: any) {
    const hp = await s.db.publicHospitalProfile.findUnique({ where: { tenantId: s.tenantId } });
    await this.index.syncDoctor(s.db, s.tenantId, profile, hp?.hospitalDisplayName ?? (await this.tenantName(s)), await this.portalBookable(s));
  }

  // ── Appointment types ─────────────────────────────────────────
  listAppointmentTypes(ctx: RequestContext) {
    const s = this.scope(ctx);
    return s.db.appointmentType.findMany({ orderBy: { name: 'asc' } });
  }

  async createAppointmentType(ctx: RequestContext, dto: CreateAppointmentTypeDto) {
    const s = this.scope(ctx);
    const row = await s.db.appointmentType.create({ data: { tenantId: s.tenantId, ...(dto as any) } });
    await this.record(s, 'appointment_type.create', 'appointment_type', row.id, { name: dto.name });
    return row;
  }

  async updateAppointmentType(ctx: RequestContext, id: string, dto: UpdateAppointmentTypeDto) {
    const s = this.scope(ctx);
    const existing = await s.db.appointmentType.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Appointment type not found');
    const row = await s.db.appointmentType.update({ where: { id }, data: { ...(dto as any) } });
    await this.record(s, 'appointment_type.update', 'appointment_type', id, { changes: dto });
    return row;
  }

  // ── Availability rules ────────────────────────────────────────
  listAvailabilityRules(ctx: RequestContext, doctorId?: string) {
    const s = this.scope(ctx);
    return s.db.availabilityRule.findMany({ where: doctorId ? { doctorId } : {}, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
  }

  async createAvailabilityRule(ctx: RequestContext, dto: CreateAvailabilityRuleDto) {
    const s = this.scope(ctx);
    if (dto.endTime <= dto.startTime) throw new BadRequestException('endTime must be after startTime');
    const row = await s.db.availabilityRule.create({ data: { tenantId: s.tenantId, ...(dto as any) } });
    await this.record(s, 'availability.create', 'availability_rule', row.id, { doctorId: dto.doctorId, dayOfWeek: dto.dayOfWeek });
    return row;
  }

  async updateAvailabilityRule(ctx: RequestContext, id: string, dto: UpdateAvailabilityRuleDto) {
    const s = this.scope(ctx);
    const existing = await s.db.availabilityRule.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Availability rule not found');
    if (dto.startTime && dto.endTime && dto.endTime <= dto.startTime) throw new BadRequestException('endTime must be after startTime');
    const row = await s.db.availabilityRule.update({ where: { id }, data: { ...(dto as any) } });
    await this.record(s, 'availability.update', 'availability_rule', id, { changes: dto });
    return row;
  }

  // ── Availability overrides ────────────────────────────────────
  listAvailabilityOverrides(ctx: RequestContext, doctorId?: string) {
    const s = this.scope(ctx);
    return s.db.availabilityOverride.findMany({ where: doctorId ? { doctorId } : {}, orderBy: { date: 'desc' }, take: 200 });
  }

  async createAvailabilityOverride(ctx: RequestContext, dto: CreateAvailabilityOverrideDto) {
    const s = this.scope(ctx);
    const row = await s.db.availabilityOverride.create({
      data: { tenantId: s.tenantId, doctorId: dto.doctorId, locationId: dto.locationId, date: new Date(dto.date), type: dto.type as any, startTime: dto.startTime, endTime: dto.endTime, reason: dto.reason },
    });
    await this.record(s, 'availability.override', 'availability_override', row.id, { doctorId: dto.doctorId, date: dto.date, type: dto.type });
    return row;
  }

  // ── Online-booking queue (Phase 22.4b) ────────────────────────
  async listOnlineBookings(ctx: RequestContext, status?: string) {
    const s = this.scope(ctx);
    const rows = await s.db.onlineBooking.findMany({ where: status ? { bookingStatus: status as any } : {}, orderBy: { createdAt: 'desc' }, take: 200 });
    const patientIds = [...new Set(rows.map((r: any) => r.patientId).filter(Boolean))];
    const doctorIds = [...new Set(rows.map((r: any) => r.doctorId).filter(Boolean))];
    const [patients, doctors] = await Promise.all([
      patientIds.length ? s.db.patient.findMany({ where: { id: { in: patientIds } }, select: { id: true, fullName: true, mrn: true } }) : [],
      doctorIds.length ? s.db.provider.findMany({ where: { id: { in: doctorIds } }, include: { user: { select: { fullName: true } } } }) : [],
    ]);
    const byPatient = new Map(patients.map((p: any) => [p.id, p]));
    const byDoctor = new Map(doctors.map((d: any) => [d.id, d.user?.fullName ?? null]));
    return rows.map((r: any) => ({ ...r, patient: r.patientId ? byPatient.get(r.patientId) ?? null : null, doctorName: byDoctor.get(r.doctorId) ?? null }));
  }

  private async loadBooking(s: Scope, id: string) {
    const b = await s.db.onlineBooking.findFirst({ where: { id } });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async getOnlineBooking(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const b = await this.loadBooking(s, id);
    const patient = b.patientId ? await s.db.patient.findFirst({ where: { id: b.patientId }, select: { id: true, fullName: true, mrn: true } }) : null;
    const duplicates = b.possibleDuplicatePatient && b.duplicatePatientIds?.length
      ? await s.db.patient.findMany({ where: { id: { in: b.duplicatePatientIds } }, select: { id: true, fullName: true, mrn: true, phone: true, email: true } })
      : [];
    return { ...b, patient, duplicates };
  }

  async approveBooking(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const b = await this.loadBooking(s, id);
    if (b.bookingStatus !== 'PENDING') throw new BadRequestException('Only pending bookings can be approved');
    const row = await s.db.onlineBooking.update({ where: { id }, data: { bookingStatus: 'CONFIRMED', approvalStatus: 'APPROVED' } });
    await this.record(s, 'online_booking.approve', 'online_booking', id, { appointmentId: b.appointmentId });
    return row;
  }

  async rejectBooking(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const b = await this.loadBooking(s, id);
    if (['REJECTED', 'CANCELLED', 'COMPLETED'].includes(b.bookingStatus)) throw new BadRequestException(`Booking is already ${b.bookingStatus.toLowerCase()}`);
    const row = await s.db.onlineBooking.update({ where: { id }, data: { bookingStatus: 'REJECTED', approvalStatus: 'REJECTED', rejectionReason: reason } });
    if (b.appointmentId) await s.db.appointment.update({ where: { id: b.appointmentId }, data: { status: 'CANCELLED', cancellationReason: reason } });
    await this.record(s, 'online_booking.reject', 'online_booking', id, { reason, appointmentId: b.appointmentId });
    return row;
  }

  async rescheduleBooking(ctx: RequestContext, id: string, date: string, time: string) {
    const s = this.scope(ctx);
    const b = await this.loadBooking(s, id);
    if (['REJECTED', 'CANCELLED', 'COMPLETED'].includes(b.bookingStatus)) throw new BadRequestException(`Cannot reschedule a ${b.bookingStatus.toLowerCase()} booking`);
    const scheduledAt = new Date(`${date}T${time}:00`);
    if (b.appointmentId) {
      const clash = await s.db.appointment.count({ where: { providerId: b.doctorId, scheduledAt, status: { notIn: ['CANCELLED'] as any }, id: { not: b.appointmentId } } });
      if (clash > 0) throw new BadRequestException('That time is already booked for this doctor');
      await s.db.appointment.update({ where: { id: b.appointmentId }, data: { scheduledAt } });
    }
    const row = await s.db.onlineBooking.update({ where: { id }, data: { appointmentDate: new Date(date), appointmentTime: time } });
    await this.record(s, 'online_booking.reschedule', 'online_booking', id, { date, time });
    return row;
  }

  async linkBookingPatient(ctx: RequestContext, id: string, patientId: string) {
    const s = this.scope(ctx);
    const b = await this.loadBooking(s, id);
    const patient = await s.db.patient.findFirst({ where: { id: patientId, deletedAt: null } });
    if (!patient) throw new BadRequestException('Patient not found in this hospital');
    await s.db.onlineBooking.update({ where: { id }, data: { patientId, newOrExistingPatient: 'EXISTING', possibleDuplicatePatient: false } });
    if (b.appointmentId) await s.db.appointment.update({ where: { id: b.appointmentId }, data: { patientId } });
    await this.record(s, 'patient_record.linked_to_portal', 'online_booking', id, { patientId, previousPatientId: b.patientId });
    return this.getOnlineBooking(ctx, id);
  }

  // ── Document visibility (Phase 22.6) ──────────────────────────
  async publishDocument(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const doc = await s.db.patientDocument.findFirst({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const row = await s.db.patientDocument.update({ where: { id }, data: { visibleToPatient: true, publishedAt: new Date(), publishedById: s.actorId, hiddenAt: null, hiddenById: null } });
    await this.record(s, 'document.publish_to_patient', 'patient_document', id, { patientId: doc.patientId });
    return row;
  }

  async hideDocument(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const doc = await s.db.patientDocument.findFirst({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const row = await s.db.patientDocument.update({ where: { id }, data: { visibleToPatient: false, hiddenAt: new Date(), hiddenById: s.actorId } });
    await this.record(s, 'document.hide_from_patient', 'patient_document', id, { patientId: doc.patientId, reason });
    return row;
  }

  // ── Patient portal access management (Phase 22.6) ─────────────
  listPortalAccess(ctx: RequestContext, patientId: string) {
    const s = this.scope(ctx);
    return s.db.patientPortalAccess.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' } });
  }

  private async loadAccess(s: Scope, id: string) {
    const a = await s.db.patientPortalAccess.findFirst({ where: { id } });
    if (!a) throw new NotFoundException('Portal access link not found');
    return a;
  }

  async blockPortalAccess(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    await this.loadAccess(s, id);
    const row = await s.db.patientPortalAccess.update({ where: { id }, data: { accessStatus: 'BLOCKED', blockReason: reason } });
    await this.record(s, 'patient_portal_access.block', 'patient_portal_access', id, { reason });
    return row;
  }

  async revokePortalAccess(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    await this.loadAccess(s, id);
    const row = await s.db.patientPortalAccess.update({ where: { id }, data: { accessStatus: 'REVOKED', revokeReason: reason } });
    await this.record(s, 'patient_portal_access.revoke', 'patient_portal_access', id, { reason });
    return row;
  }

  async reactivatePortalAccess(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    await this.loadAccess(s, id);
    const row = await s.db.patientPortalAccess.update({ where: { id }, data: { accessStatus: 'ACTIVE', blockReason: null, revokeReason: null } });
    await this.record(s, 'patient_portal_access.create', 'patient_portal_access', id, { reactivated: true });
    return row;
  }

  // Patient-initiated access requests awaiting staff verification.
  async listAccessRequests(ctx: RequestContext) {
    const s = this.scope(ctx);
    const rows = await s.db.patientPortalAccess.findMany({ where: { accessStatus: 'PENDING' }, orderBy: { createdAt: 'desc' }, take: 200 });
    const pids = [...new Set(rows.map((r: any) => r.patientId))];
    const patients = pids.length ? await s.db.patient.findMany({ where: { id: { in: pids } }, select: { id: true, fullName: true, mrn: true, phone: true } }) : [];
    const byId = new Map(patients.map((p: any) => [p.id, p]));
    return rows.map((r: any) => ({ ...r, patient: byId.get(r.patientId) ?? null }));
  }

  async approveAccessRequest(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const a = await this.loadAccess(s, id);
    if (a.accessStatus !== 'PENDING') throw new BadRequestException('Only pending requests can be approved');
    const row = await s.db.patientPortalAccess.update({ where: { id }, data: { accessStatus: 'ACTIVE', verificationStatus: 'VERIFIED', linkedById: s.actorId, linkedAt: new Date() } });
    await this.record(s, 'patient_portal_access.create', 'patient_portal_access', id, { approved: true, patientId: a.patientId });
    return row;
  }
}
