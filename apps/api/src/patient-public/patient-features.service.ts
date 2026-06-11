import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { platformDb, forTenant } from '@hms/db';
import { FirebaseService } from '../common/firebase.service';
import { AuditService } from '../common/audit.service';
import { PatientNotifyService } from './patient-notify.service';
import type {
  SaveProviderDto,
  SaveHospitalDto,
  FamilyMemberDto,
  UpdateProfileDto,
  NotificationPrefsDto,
  CreateRefillDto,
} from './dto';

/**
 * Phase 23 — patient-portal "extras": Care Team (saved providers/hospitals), Family, Notifications,
 * Settings, prescription refill requests, and clinical-record (lab report) detail.
 *
 * Same security model as PatientPortalService: @Public controller, verify the patient's OWN Firebase
 * token → uid. Global, uid-keyed data is scoped by the verified uid. Hospital-owned data (refills,
 * clinical records) goes through assertAccess(uid,tenantId) → forTenant() (RLS) — unlinked tenant 403.
 */
@Injectable()
export class PatientFeaturesService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly audit: AuditService,
    private readonly notify: PatientNotifyService,
  ) {}

  private async authUid(authHeader?: string): Promise<{ uid: string; email?: string }> {
    if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException('Please sign in to continue.');
    const v = await this.firebase.verifyIdToken(authHeader.slice(7));
    if (!v?.uid) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    await platformDb.patientAuthUser.upsert({
      where: { uid: v.uid },
      create: { uid: v.uid, email: v.email ?? null, status: 'ACTIVE', lastLoginAt: new Date() },
      update: { lastLoginAt: new Date(), email: v.email ?? undefined },
    });
    return v;
  }

  private async assertAccess(uid: string, tenantId: string): Promise<string> {
    if (!tenantId) throw new ForbiddenException('Select a hospital to continue.');
    const access = await platformDb.patientPortalAccess.findFirst({ where: { uid, tenantId, accessStatus: 'ACTIVE' as any } });
    if (!access) throw new ForbiddenException("You don't have access to this hospital's records.");
    return access.patientId;
  }

  // ── Care Team: saved providers ──────────────────────────────
  async listSavedProviders(auth?: string) {
    const { uid } = await this.authUid(auth);
    return platformDb.patientSavedProvider.findMany({ where: { uid }, orderBy: { createdAt: 'desc' } });
  }

  async saveProvider(auth: string | undefined, dto: SaveProviderDto) {
    const { uid } = await this.authUid(auth);
    return platformDb.patientSavedProvider.upsert({
      where: { uid_tenantId_doctorId: { uid, tenantId: dto.tenantId, doctorId: dto.doctorId } },
      create: {
        uid, tenantId: dto.tenantId, doctorId: dto.doctorId, doctorSlug: dto.doctorSlug ?? null,
        doctorName: dto.doctorName, specialty: dto.specialty ?? null, hospitalName: dto.hospitalName, photoUrl: dto.photoUrl ?? null,
      },
      update: { doctorName: dto.doctorName, specialty: dto.specialty ?? null, hospitalName: dto.hospitalName, photoUrl: dto.photoUrl ?? null },
    });
  }

  async removeSavedProvider(auth: string | undefined, id: string) {
    const { uid } = await this.authUid(auth);
    const row = await platformDb.patientSavedProvider.findFirst({ where: { id, uid } });
    if (!row) throw new NotFoundException('Saved doctor not found');
    await platformDb.patientSavedProvider.delete({ where: { id } });
    return { ok: true };
  }

  // ── Care Team: saved hospitals ──────────────────────────────
  async listSavedHospitals(auth?: string) {
    const { uid } = await this.authUid(auth);
    return platformDb.patientSavedHospital.findMany({ where: { uid }, orderBy: { createdAt: 'desc' } });
  }

  async saveHospital(auth: string | undefined, dto: SaveHospitalDto) {
    const { uid } = await this.authUid(auth);
    return platformDb.patientSavedHospital.upsert({
      where: { uid_tenantId: { uid, tenantId: dto.tenantId } },
      create: { uid, tenantId: dto.tenantId, hospitalSlug: dto.hospitalSlug ?? null, hospitalName: dto.hospitalName, city: dto.city ?? null, logoUrl: dto.logoUrl ?? null },
      update: { hospitalName: dto.hospitalName, city: dto.city ?? null, logoUrl: dto.logoUrl ?? null },
    });
  }

  async removeSavedHospital(auth: string | undefined, id: string) {
    const { uid } = await this.authUid(auth);
    const row = await platformDb.patientSavedHospital.findFirst({ where: { id, uid } });
    if (!row) throw new NotFoundException('Saved hospital not found');
    await platformDb.patientSavedHospital.delete({ where: { id } });
    return { ok: true };
  }

  // ── Family / dependents ─────────────────────────────────────
  async listFamily(auth?: string) {
    const { uid } = await this.authUid(auth);
    return platformDb.patientFamilyMember.findMany({ where: { uid }, orderBy: { createdAt: 'asc' } });
  }

  async addFamily(auth: string | undefined, dto: FamilyMemberDto) {
    const { uid } = await this.authUid(auth);
    return platformDb.patientFamilyMember.create({
      data: { uid, fullName: dto.fullName, relationship: dto.relationship, dob: dto.dob ? new Date(dto.dob) : null, sex: dto.sex ?? null, mobile: dto.mobile ?? null },
    });
  }

  async updateFamily(auth: string | undefined, id: string, dto: FamilyMemberDto) {
    const { uid } = await this.authUid(auth);
    const row = await platformDb.patientFamilyMember.findFirst({ where: { id, uid } });
    if (!row) throw new NotFoundException('Family member not found');
    return platformDb.patientFamilyMember.update({
      where: { id },
      data: { fullName: dto.fullName, relationship: dto.relationship, dob: dto.dob ? new Date(dto.dob) : null, sex: dto.sex ?? null, mobile: dto.mobile ?? null },
    });
  }

  async removeFamily(auth: string | undefined, id: string) {
    const { uid } = await this.authUid(auth);
    const row = await platformDb.patientFamilyMember.findFirst({ where: { id, uid } });
    if (!row) throw new NotFoundException('Family member not found');
    await platformDb.patientFamilyMember.delete({ where: { id } });
    return { ok: true };
  }

  // ── Notifications ───────────────────────────────────────────
  async listNotifications(auth?: string) {
    const { uid } = await this.authUid(auth);
    const items = await platformDb.patientNotification.findMany({ where: { uid }, orderBy: { createdAt: 'desc' }, take: 100 });
    const unread = items.filter((n) => !n.readAt).length;
    return { items, unread };
  }

  async markNotificationRead(auth: string | undefined, id: string) {
    const { uid } = await this.authUid(auth);
    const row = await platformDb.patientNotification.findFirst({ where: { id, uid } });
    if (!row) throw new NotFoundException('Notification not found');
    if (!row.readAt) await platformDb.patientNotification.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllNotificationsRead(auth?: string) {
    const { uid } = await this.authUid(auth);
    await platformDb.patientNotification.updateMany({ where: { uid, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  // ── Settings ────────────────────────────────────────────────
  async getSettings(auth?: string) {
    const { uid } = await this.authUid(auth);
    const u = await platformDb.patientAuthUser.findUnique({ where: { uid } });
    return {
      profile: { displayName: u?.displayName ?? null, email: u?.email ?? null, mobile: u?.mobile ?? null, profilePhotoUrl: u?.profilePhotoUrl ?? null },
      notifications: {
        notifyBookingUpdates: u?.notifyBookingUpdates ?? true,
        notifyDocuments: u?.notifyDocuments ?? true,
        notifyBilling: u?.notifyBilling ?? true,
        notifyByEmail: u?.notifyByEmail ?? true,
      },
    };
  }

  async updateProfile(auth: string | undefined, dto: UpdateProfileDto) {
    const { uid } = await this.authUid(auth);
    const u = await platformDb.patientAuthUser.update({
      where: { uid },
      data: { displayName: dto.displayName?.trim() || null, mobile: dto.mobile?.trim() || null },
    });
    return { displayName: u.displayName, mobile: u.mobile };
  }

  async updateNotificationPrefs(auth: string | undefined, dto: NotificationPrefsDto) {
    const { uid } = await this.authUid(auth);
    const u = await platformDb.patientAuthUser.update({
      where: { uid },
      data: {
        notifyBookingUpdates: dto.notifyBookingUpdates,
        notifyDocuments: dto.notifyDocuments,
        notifyBilling: dto.notifyBilling,
        notifyByEmail: dto.notifyByEmail,
      },
    });
    return { notifyBookingUpdates: u.notifyBookingUpdates, notifyDocuments: u.notifyDocuments, notifyBilling: u.notifyBilling, notifyByEmail: u.notifyByEmail };
  }

  // ── Prescription refill requests (tenant-scoped, RLS) ───────
  async listRefills(auth: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(auth);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    return db.prescriptionRefillRequest.findMany({ where: { patientId, uid }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async createRefill(auth: string | undefined, dto: CreateRefillDto) {
    const { uid } = await this.authUid(auth);
    const patientId = await this.assertAccess(uid, dto.tenantId);
    const db = forTenant(dto.tenantId);

    if (dto.prescriptionId) {
      // The prescription must belong to this patient (RLS scopes to tenant; verify ownership).
      const rx = await db.prescription.findFirst({ where: { id: dto.prescriptionId, encounter: { patientId } } });
      if (!rx) throw new NotFoundException('Prescription not found');
    }
    // Avoid duplicate open requests for the same prescription.
    const open = await db.prescriptionRefillRequest.findFirst({
      where: { patientId, prescriptionId: dto.prescriptionId ?? null, status: { in: ['REQUESTED', 'APPROVED'] as any } },
    });
    if (open) throw new BadRequestException('You already have an open refill request for this prescription.');

    const row = await db.prescriptionRefillRequest.create({
      data: { tenantId: dto.tenantId, patientId, prescriptionId: dto.prescriptionId ?? null, uid, note: dto.note?.trim() || null, status: 'REQUESTED' },
    });
    await this.audit.log(db, { tenantId: dto.tenantId, actorId: null, action: 'prescription_refill.request', entity: 'prescription_refill_request', entityId: row.id, metadata: { uid, prescriptionId: dto.prescriptionId ?? null } });
    await this.notify.notifyUid(uid, { category: 'REFILL', title: 'Refill request received', body: 'Your hospital has received your refill request and will review it.', actionUrl: '/patient/prescriptions', tenantId: dto.tenantId });
    return row;
  }

  // ── Clinical record / lab-result detail ─────────────────────
  /** Readable detail of one published (COMPLETED + verified) lab order for this patient. */
  async reportDetail(auth: string | undefined, tenantId: string, id: string) {
    const { uid } = await this.authUid(auth);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const o = await db.labOrder.findFirst({
      where: { id, patientId, status: 'COMPLETED' as any },
      include: { items: { include: { results: { where: { isVerified: true }, orderBy: { recordedAt: 'desc' } } } } },
    });
    if (!o) throw new NotFoundException('Report not found');
    return {
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      tests: o.items.map((i: any) => ({
        testName: i.testName,
        results: i.results.map((r: any) => ({ testName: r.testName, value: r.value, unit: r.unit, referenceRange: r.referenceRange, abnormalFlag: r.abnormalFlag, notes: r.notes, recordedAt: r.recordedAt })),
      })),
    };
  }
}
