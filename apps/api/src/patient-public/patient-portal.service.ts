import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { platformDb, forTenant } from '@hms/db';
import { FirebaseService } from '../common/firebase.service';
import { AuditService } from '../common/audit.service';
import type { RequestAccessDto } from './dto';

/**
 * Phase 22.5 — Patient portal. A SEPARATE auth branch from staff: the patient logs in
 * with Firebase; we verify the token → uid → PatientAuthUser (register on first login) →
 * PatientPortalAccess (ACTIVE) for the requested tenant → that hospital's Patient record.
 * Tenant data is read via forTenant() (RLS) and filtered to the linked patientId.
 * Documents are filtered to visibleToPatient. Hospital A never sees Hospital B.
 */
@Injectable()
export class PatientPortalService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly audit: AuditService,
  ) {}

  /** Verify the bearer token → uid, and register/refresh the global PatientAuthUser. */
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

  /** Enforce uid ↔ tenant ↔ patient access. Throws 403 on any mismatch (URL tampering). */
  private async assertAccess(uid: string, tenantId: string): Promise<string> {
    if (!tenantId) throw new ForbiddenException('Select a hospital to continue.');
    const access = await platformDb.patientPortalAccess.findFirst({ where: { uid, tenantId, accessStatus: 'ACTIVE' as any } });
    if (!access) throw new ForbiddenException("You don't have access to this hospital's records.");
    return access.patientId;
  }

  async me(authHeader?: string) {
    const { uid } = await this.authUid(authHeader);
    const u = await platformDb.patientAuthUser.findUnique({ where: { uid } });
    return { uid, email: u?.email ?? null, displayName: u?.displayName ?? null, mobile: u?.mobile ?? null, profilePhotoUrl: u?.profilePhotoUrl ?? null };
  }

  async linkedHospitals(authHeader?: string) {
    const { uid } = await this.authUid(authHeader);
    const access = await platformDb.patientPortalAccess.findMany({ where: { uid, accessStatus: 'ACTIVE' as any } });
    const tenantIds = [...new Set(access.map((a) => a.tenantId))];
    const hps = tenantIds.length
      ? await platformDb.publicHospitalProfile.findMany({ where: { tenantId: { in: tenantIds } }, select: { tenantId: true, hospitalDisplayName: true, logoUrl: true, city: true } })
      : [];
    const byTenant = new Map(hps.map((h) => [h.tenantId, h]));
    return access.map((a) => ({
      tenantId: a.tenantId,
      patientId: a.patientId,
      hospitalName: byTenant.get(a.tenantId)?.hospitalDisplayName ?? a.hospitalDisplayName ?? 'Hospital',
      logoUrl: byTenant.get(a.tenantId)?.logoUrl ?? null,
      city: byTenant.get(a.tenantId)?.city ?? null,
    }));
  }

  async dashboard(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const now = new Date();
    const [patient, upcoming, recentBill, recentDoc, hp] = await Promise.all([
      db.patient.findFirst({ where: { id: patientId }, select: { fullName: true, mrn: true } }),
      db.appointment.findFirst({ where: { patientId, scheduledAt: { gte: now }, status: { notIn: ['CANCELLED'] as any } }, orderBy: { scheduledAt: 'asc' } }),
      db.bill.findFirst({ where: { patientId }, orderBy: { createdAt: 'desc' }, include: { payments: true } }),
      db.patientDocument.findFirst({ where: { patientId, visibleToPatient: true }, orderBy: { createdAt: 'desc' } }),
      platformDb.publicHospitalProfile.findFirst({ where: { tenantId } }),
    ]);
    return { hospitalName: hp?.hospitalDisplayName ?? 'Hospital', patient, upcoming, recentBill, recentDoc };
  }

  async appointments(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const appts = await db.appointment.findMany({ where: { patientId }, orderBy: { scheduledAt: 'desc' }, take: 100 });
    const docIds = [...new Set(appts.map((a: any) => a.providerId).filter(Boolean))];
    const docs = docIds.length ? await db.provider.findMany({ where: { id: { in: docIds } }, include: { user: { select: { fullName: true } } } }) : [];
    const byDoc = new Map(docs.map((d: any) => [d.id, d.user?.fullName ?? null]));
    return appts.map((a: any) => ({ id: a.id, scheduledAt: a.scheduledAt, status: a.status, reason: a.reason, consultationType: a.consultationType, source: a.source, doctorName: a.providerId ? byDoc.get(a.providerId) ?? null : null }));
  }

  async bills(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const bills = await db.bill.findMany({ where: { patientId }, include: { payments: true, items: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return bills.map((b: any) => {
      const paid = b.payments.reduce((s: number, p: any) => s + p.amount, 0);
      return { id: b.id, billNumber: b.billNumber, netAmount: b.netAmount, status: b.status, createdAt: b.createdAt, paid, due: Math.max(0, b.netAmount - paid), items: b.items.map((i: any) => ({ name: i.name, quantity: i.quantity, total: i.total })) };
    });
  }

  async documents(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const docs = await db.patientDocument.findMany({ where: { patientId, visibleToPatient: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return docs.map((d: any) => ({ id: d.id, title: d.title, category: d.category, fileName: d.fileName, documentUrl: d.documentUrl, mimeType: d.mimeType, publishedAt: d.publishedAt ?? d.createdAt }));
  }

  async reports(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const orders = await db.labOrder.findMany({
      where: { patientId, status: 'COMPLETED' as any },
      include: { items: { include: { results: { where: { isVerified: true }, orderBy: { recordedAt: 'desc' } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return orders.map((o: any) => ({
      id: o.id,
      createdAt: o.createdAt,
      tests: o.items.map((i: any) => ({ testName: i.testName, results: i.results.map((r: any) => ({ value: r.value, unit: r.unit, referenceRange: r.referenceRange, abnormalFlag: r.abnormalFlag })) })),
    }));
  }

  async profile(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const [login, patient] = await Promise.all([
      platformDb.patientAuthUser.findUnique({ where: { uid } }),
      forTenant(tenantId).patient.findFirst({ where: { id: patientId } }),
    ]);
    if (!patient) throw new NotFoundException('Patient record not found');
    return {
      login: { displayName: login?.displayName ?? null, email: login?.email ?? null, mobile: login?.mobile ?? null },
      hospital: {
        mrn: patient.mrn, fullName: patient.fullName, dob: patient.dob, sex: patient.sex, phone: patient.phone, email: patient.email, address: patient.address,
        emergencyContactName: patient.emergencyContactName, emergencyContactPhone: patient.emergencyContactPhone,
      },
    };
  }

  async prescriptions(authHeader: string | undefined, tenantId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const rx = await db.prescription.findMany({
      where: { encounter: { patientId }, status: { in: ['FINALIZED', 'DISPENSED'] as any } },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rx.map((p: any) => ({
      id: p.id,
      status: p.status,
      date: p.finalizedAt ?? p.createdAt,
      items: p.items.map((i: any) => ({ drugName: i.drugName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions })),
    }));
  }

  /** Record that the patient opened a document (audit + first-view timestamp). */
  async markDocumentViewed(authHeader: string | undefined, tenantId: string, docId: string) {
    const { uid } = await this.authUid(authHeader);
    const patientId = await this.assertAccess(uid, tenantId);
    const db = forTenant(tenantId);
    const doc = await db.patientDocument.findFirst({ where: { id: docId, patientId, visibleToPatient: true } });
    if (!doc) throw new NotFoundException('Document not found');
    if (!doc.patientViewedAt) await db.patientDocument.update({ where: { id: docId }, data: { patientViewedAt: new Date() } });
    await this.audit.log(db, { tenantId, actorId: null, action: 'patient.document_view', entity: 'patient_document', entityId: docId, metadata: { uid } });
    return { ok: true };
  }

  /** Patient asks a hospital to link their existing record (staff then approves). */
  async requestAccess(authHeader: string | undefined, dto: RequestAccessDto) {
    const { uid, email } = await this.authUid(authHeader);
    const portal = await platformDb.patientPortalSettings.findUnique({ where: { tenantId: dto.tenantId } });
    if (!portal?.enabled) throw new BadRequestException('This hospital does not offer a patient portal.');

    const db = forTenant(dto.tenantId);
    const ors: any[] = [];
    if (dto.mrn) ors.push({ mrn: dto.mrn.trim() });
    if (dto.phone) ors.push({ phone: dto.phone.trim() });
    if (email) ors.push({ email: { equals: email, mode: 'insensitive' } });
    if (!ors.length) throw new BadRequestException('Enter your MRN or the mobile number registered with the hospital.');

    let patient = await db.patient.findFirst({ where: { deletedAt: null, OR: ors } });
    if (patient && dto.dob && patient.dob && new Date(dto.dob).toISOString().slice(0, 10) !== new Date(patient.dob).toISOString().slice(0, 10)) patient = null;
    if (!patient) return { status: 'no_match' as const };

    const existing = await platformDb.patientPortalAccess.findFirst({ where: { tenantId: dto.tenantId, uid, patientId: patient.id } });
    if (existing?.accessStatus === 'ACTIVE') return { status: 'already_linked' as const };
    const hp = await platformDb.publicHospitalProfile.findFirst({ where: { tenantId: dto.tenantId }, select: { hospitalDisplayName: true } });
    if (existing) {
      await platformDb.patientPortalAccess.update({ where: { id: existing.id }, data: { accessStatus: 'PENDING', verificationStatus: 'PENDING', email: email ?? existing.email } });
    } else {
      await platformDb.patientPortalAccess.create({ data: { tenantId: dto.tenantId, uid, patientId: patient.id, email, hospitalDisplayName: hp?.hospitalDisplayName, accessStatus: 'PENDING', verificationStatus: 'PENDING' } });
    }
    await this.audit.log(db, { tenantId: dto.tenantId, actorId: null, action: 'patient_portal_access.requested', entity: 'patient_portal_access', entityId: patient.id, metadata: { uid } });
    return { status: 'requested' as const };
  }
}
