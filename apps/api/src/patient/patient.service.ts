import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import { nextMrn } from '../common/sequences';
import type { RequestContext } from '../common/types';
import {
  AllergyDto,
  AttachPatientDocumentDto,
  ConsentDto,
  CreatePatientDto,
  GeneratePatientSummaryDto,
  HistoryDto,
  UpdatePatientDto,
} from './dto';

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
      include: {
        allergies: true,
        histories: true,
        consents: { orderBy: { grantedAt: 'desc' } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
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

    const [encounters, appointments, bills, prescriptions, labOrders, allergies, histories, consents, documents] =
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
        s.db.labOrder.findMany({
          where: { patientId: id },
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { items: { include: { results: { orderBy: { recordedAt: 'desc' } } } } },
        }),
        s.db.allergy.findMany({ where: { patientId: id } }),
        s.db.medicalHistory.findMany({ where: { patientId: id }, orderBy: { recordedAt: 'desc' } }),
        s.db.consent.findMany({ where: { patientId: id }, orderBy: { grantedAt: 'desc' } }),
        s.db.patientDocument.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      ]);

    return {
      patient,
      encounters,
      appointments,
      bills,
      prescriptions,
      labOrders,
      allergies,
      histories,
      consents,
      documents,
    };
  }

  async journey(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const patient = await this.assertPatient(s, id);
    const now = new Date();

    const [
      activeAppointment,
      activeEncounter,
      activeAdmission,
      pendingLabOrders,
      pendingPrescriptions,
      pendingCharges,
      openBills,
      activeClaim,
      documentCount,
    ] = await Promise.all([
      s.db.appointment.findFirst({
        where: {
          patientId: id,
          status: { in: ['SCHEDULED', 'CHECKED_IN'] as any },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
      s.db.encounter.findFirst({
        where: {
          patientId: id,
          status: { in: ['CHECKED_IN', 'IN_PROGRESS'] as any },
        },
        orderBy: { createdAt: 'desc' },
      }),
      s.db.admission.findFirst({
        where: { patientId: id, status: 'ADMITTED' as any },
        include: { bed: { include: { ward: true } } },
        orderBy: { admittedAt: 'desc' },
      }),
      s.db.labOrder.findMany({
        where: { patientId: id, status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING'] as any } },
        orderBy: { createdAt: 'asc' },
        take: 10,
        include: { items: true },
      }),
      s.db.prescription.findMany({
        where: { encounter: { patientId: id }, status: 'FINALIZED' as any },
        orderBy: { finalizedAt: 'asc' },
        take: 10,
        include: { items: true },
      }),
      s.db.billableCharge.findMany({
        where: { patientId: id, status: 'PENDING' as any },
        orderBy: { createdAt: 'asc' },
        take: 10,
      }),
      s.db.bill.findMany({
        where: { patientId: id, status: { in: ['UNPAID', 'PARTIAL'] as any } },
        orderBy: { createdAt: 'asc' },
        take: 10,
        include: { payments: true, refunds: true },
      }),
      s.db.insuranceClaim.findFirst({
        where: {
          bill: { patientId: id },
          status: { in: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'] as any },
        },
        include: { bill: true, patientPolicy: { include: { provider: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      s.db.patientDocument.count({ where: { patientId: id } }),
    ]);

    const blockers: Array<{ type: string; message: string; href: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' }> = [];
    if (pendingLabOrders.length > 0) {
      blockers.push({
        type: 'LAB',
        message: `${pendingLabOrders.length} lab order${pendingLabOrders.length === 1 ? '' : 's'} still in progress`,
        href: '/lab',
        priority: 'HIGH',
      });
    }
    if (pendingPrescriptions.length > 0) {
      blockers.push({
        type: 'PHARMACY',
        message: `${pendingPrescriptions.length} finalized prescription${pendingPrescriptions.length === 1 ? '' : 's'} awaiting pharmacy follow-up`,
        href: '/pharmacy',
        priority: 'NORMAL',
      });
    }
    if (openBills.length > 0) {
      blockers.push({
        type: 'BILLING',
        message: `${openBills.length} unpaid or partial bill${openBills.length === 1 ? '' : 's'} needs settlement`,
        href: `/finance/bills/${openBills[0].id}`,
        priority: 'HIGH',
      });
    }
    if (pendingCharges.length > 0) {
      blockers.push({
        type: 'FINANCE',
        message: `${pendingCharges.length} pending charge${pendingCharges.length === 1 ? '' : 's'} not billed yet`,
        href: `/finance/patient-accounts/${id}`,
        priority: 'HIGH',
      });
    }
    if (activeClaim?.status === 'REJECTED') {
      blockers.push({
        type: 'INSURANCE',
        message: activeClaim.rejectionReason || 'Insurance claim was rejected and needs correction',
        href: `/insurance/claims/${activeClaim.id}`,
        priority: 'HIGH',
      });
    }
    if (activeAdmission?.expectedDischargeAt && new Date(activeAdmission.expectedDischargeAt).getTime() < now.getTime()) {
      blockers.push({
        type: 'IPD',
        message: 'Expected discharge date has passed',
        href: `/ipd/admissions/${activeAdmission.id}`,
        priority: 'NORMAL',
      });
    }

    const current =
      activeAdmission
        ? {
            status: 'ADMITTED',
            module: 'IPD',
            location: `${activeAdmission.bed?.ward?.name ?? 'Ward'} / ${activeAdmission.bed?.bedNumber ?? 'Bed'}`,
            href: `/ipd/admissions/${activeAdmission.id}`,
            label: 'Patient is admitted',
          }
        : activeEncounter
          ? {
              status: activeEncounter.status,
              module: 'OPD',
              location: activeEncounter.status === 'IN_PROGRESS' ? 'Doctor consultation' : 'OPD queue',
              href: activeEncounter.status === 'IN_PROGRESS' ? `/doctor/consult/${activeEncounter.id}` : '/doctor',
              label: activeEncounter.status === 'IN_PROGRESS' ? 'Consultation in progress' : 'Waiting for consultation',
            }
          : activeAppointment
            ? {
                status: activeAppointment.status,
                module: 'SCHEDULING',
                location: activeAppointment.scheduledAt ? new Date(activeAppointment.scheduledAt).toISOString() : null,
                href: '/opd/appointments',
                label: activeAppointment.status === 'CHECKED_IN' ? 'Checked in for appointment' : 'Appointment scheduled',
              }
            : blockers.length > 0
              ? {
                  status: 'ATTENTION_NEEDED',
                  module: blockers[0].type,
                  location: null,
                  href: blockers[0].href,
                  label: blockers[0].message,
                }
              : {
                  status: 'STABLE',
                  module: 'PATIENT',
                  location: null,
                  href: `/patients/${id}`,
                  label: 'No active workflow blockers',
                };

    const nextRecommendedAction =
      blockers[0]
        ? { label: blockers[0].message, href: blockers[0].href, priority: blockers[0].priority }
        : activeAdmission
          ? { label: 'Continue IPD care plan', href: `/ipd/admissions/${activeAdmission.id}`, priority: 'NORMAL' as const }
          : activeEncounter
            ? { label: 'Continue OPD workflow', href: current.href, priority: 'NORMAL' as const }
            : activeAppointment
              ? { label: 'Check in or update appointment', href: '/opd/appointments', priority: 'NORMAL' as const }
              : { label: 'Review patient timeline', href: `/patients/${id}`, priority: 'LOW' as const };

    return {
      patientId: patient.id,
      patientName: patient.fullName,
      mrn: patient.mrn,
      current,
      nextRecommendedAction,
      blockers,
      activeAppointment,
      activeEncounter,
      activeAdmission: activeAdmission
        ? {
            id: activeAdmission.id,
            status: activeAdmission.status,
            admittedAt: activeAdmission.admittedAt,
            expectedDischargeAt: activeAdmission.expectedDischargeAt,
            bedId: activeAdmission.bedId,
            wardName: activeAdmission.bed?.ward?.name ?? null,
            bedNumber: activeAdmission.bed?.bedNumber ?? null,
          }
        : null,
      pendingLabOrders: pendingLabOrders.map((o: any) => ({
        id: o.id,
        status: o.status,
        createdAt: o.createdAt,
        tests: (o.items ?? []).map((i: any) => i.testName),
      })),
      pendingPrescriptions: pendingPrescriptions.map((rx: any) => ({
        id: rx.id,
        status: rx.status,
        finalizedAt: rx.finalizedAt,
        itemCount: rx.items?.length ?? 0,
      })),
      pendingCharges: pendingCharges.map((charge: any) => ({
        id: charge.id,
        sourceModule: charge.sourceModule,
        name: charge.name,
        total: charge.total,
        createdAt: charge.createdAt,
      })),
      openBills: openBills.map((bill: any) => {
        const paid = (bill.payments ?? []).reduce((sum: number, p: any) => sum + p.amount, 0);
        const refunded = (bill.refunds ?? []).reduce((sum: number, r: any) => sum + r.amount, 0);
        return {
          id: bill.id,
          billNumber: bill.billNumber,
          status: bill.status,
          netAmount: bill.netAmount,
          outstanding: Math.max(0, bill.netAmount - (paid - refunded)),
        };
      }),
      activeClaim: activeClaim
        ? {
            id: activeClaim.id,
            status: activeClaim.status,
            claimAmount: activeClaim.claimAmount,
            approvedAmount: activeClaim.approvedAmount,
            patientShare: activeClaim.patientShare,
            providerName: activeClaim.patientPolicy?.provider?.name ?? null,
            billNumber: activeClaim.bill?.billNumber ?? null,
            rejectionReason: activeClaim.rejectionReason,
          }
        : null,
      documentCount,
    };
  }

  private async assertPatient(s: Scope, patientId: string) {
    const p = await s.db.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { id: true, mrn: true, fullName: true, dob: true, sex: true, phone: true, email: true },
    });
    if (!p) throw new NotFoundException('Patient not found');
    return p;
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

  async listDocuments(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    await this.assertPatient(s, id);
    return s.db.patientDocument.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' } });
  }

  async attachDocument(ctx: RequestContext, id: string, dto: AttachPatientDocumentDto) {
    const s = this.scope(ctx);
    await this.assertPatient(s, id);
    const documentUrl = this.assertSafeDocumentUrl(dto.documentUrl);
    const source = documentUrl.toLowerCase().startsWith('data:') ? 'UPLOADED' : 'EXTERNAL';
    const document = await s.db.patientDocument.create({
      data: {
        tenantId: s.tenantId,
        patientId: id,
        title: dto.title.trim(),
        category: dto.category ?? 'OTHER',
        source,
        mimeType: dto.mimeType?.trim() || null,
        fileName: dto.fileName?.trim() || null,
        documentUrl,
        notes: dto.notes?.trim() || null,
        createdById: s.actorId,
      },
    });
    await this.record(s, 'patient.document.attach', 'patient_document', document.id, {
      patientId: id,
      category: document.category,
      source: document.source,
      mimeType: document.mimeType,
      fileName: document.fileName,
    });
    return document;
  }

  async generateSummaryDocument(ctx: RequestContext, id: string, dto: GeneratePatientSummaryDto) {
    const s = this.scope(ctx);
    const snapshot = await this.timeline(ctx, id);
    const html = this.renderPatientSummary(snapshot);
    const title = dto.title?.trim() || 'Patient summary';
    const document = await s.db.patientDocument.create({
      data: {
        tenantId: s.tenantId,
        patientId: id,
        title,
        category: 'GENERATED_REPORT',
        source: 'GENERATED',
        mimeType: 'text/html',
        fileName: `${snapshot.patient.mrn}-summary.html`,
        documentUrl: `data:text/html;base64,${Buffer.from(html, 'utf8').toString('base64')}`,
        notes: dto.notes?.trim() || null,
        createdById: s.actorId,
      },
    });
    await this.record(s, 'patient.document.generate_summary', 'patient_document', document.id, {
      patientId: id,
      title,
      encounters: snapshot.encounters.length,
      bills: snapshot.bills.length,
      labOrders: snapshot.labOrders.length,
    });
    return document;
  }

  private assertSafeDocumentUrl(raw: string) {
    const value = raw.trim();
    const lower = value.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://')) return value;
    if (lower.startsWith('data:')) {
      if (lower.startsWith('data:text/html')) {
        throw new BadRequestException('HTML documents must be generated by the system');
      }
      return value;
    }
    throw new BadRequestException('Document URL must be http(s) or a data URL');
  }

  private renderPatientSummary(snapshot: Awaited<ReturnType<PatientService['timeline']>>) {
    const p = snapshot.patient;
    const allergies = snapshot.allergies as any[];
    const histories = snapshot.histories as any[];
    const consents = snapshot.consents as any[];
    const rows = [
      ['MRN', p.mrn],
      ['Name', p.fullName],
      ['DOB', p.dob ? new Date(p.dob).toLocaleDateString() : '-'],
      ['Sex', p.sex ?? '-'],
      ['Phone', p.phone ?? '-'],
      ['Email', p.email ?? '-'],
    ];
    const section = (title: string, body: string) => `
      <section>
        <h2>${this.escapeHtml(title)}</h2>
        ${body || '<p class="muted">No records.</p>'}
      </section>`;
    const list = (items: string[]) => (items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : '');

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(p.fullName)} - Patient summary</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #14181f; margin: 32px; line-height: 1.45; }
    header { border-bottom: 1px solid #d8dee8; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { font-size: 28px; margin: 0 0 4px; }
    h2 { font-size: 18px; margin: 24px 0 8px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #d8dee8; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f6f8fb; width: 180px; }
    .muted { color: #6b7280; }
    li { margin: 4px 0; }
    @media print { body { margin: 20mm; } button { display: none; } }
  </style>
</head>
<body>
  <header>
    <button onclick="window.print()">Print</button>
    <h1>Patient Summary</h1>
    <div class="muted">Generated ${this.escapeHtml(new Date().toLocaleString())}</div>
  </header>
  <table>
    <tbody>
      ${rows
        .map(([label, value]) => `<tr><th>${this.escapeHtml(label)}</th><td>${this.escapeHtml(String(value))}</td></tr>`)
        .join('')}
    </tbody>
  </table>
  ${section(
    'Visits',
    list(
      snapshot.encounters.map(
        (e: any) =>
          `${this.escapeHtml(e.type ?? 'Encounter')} - ${this.escapeHtml(e.status ?? '')} - ${this.escapeHtml(
            e.chiefComplaint ?? 'Consultation',
          )} (${this.escapeHtml(new Date(e.createdAt).toLocaleString())})`,
      ),
    ),
  )}
  ${section(
    'Appointments',
    list(
      snapshot.appointments.map(
        (a: any) =>
          `${this.escapeHtml(a.reason ?? 'Appointment')} - ${this.escapeHtml(a.status ?? '')} (${this.escapeHtml(
            new Date(a.scheduledAt).toLocaleString(),
          )})`,
      ),
    ),
  )}
  ${section(
    'Lab Orders',
    list(
      snapshot.labOrders.map(
        (o: any) =>
          `${this.escapeHtml(o.status ?? 'ORDERED')} - ${this.escapeHtml(
            (o.items ?? []).map((i: any) => i.testName).join(', ') || 'Lab order',
          )}`,
      ),
    ),
  )}
  ${section(
    'Prescriptions',
    list(
      snapshot.prescriptions.map(
        (rx: any) =>
          `${this.escapeHtml(rx.status ?? 'DRAFT')} - ${this.escapeHtml(
            (rx.items ?? []).map((i: any) => i.drugName).join(', ') || 'Prescription',
          )}`,
      ),
    ),
  )}
  ${section(
    'Bills',
    list(
      snapshot.bills.map(
        (b: any) =>
          `${this.escapeHtml(b.billNumber ?? 'Bill')} - ${this.escapeHtml(b.status ?? '')} - ${this.escapeHtml(
            String(b.netAmount ?? 0),
          )}`,
      ),
    ),
  )}
  ${section(
    'Allergies',
    list(allergies.map((a: any) => `${this.escapeHtml(a.substance)} ${a.severity ? `(${this.escapeHtml(a.severity)})` : ''}`)),
  )}
  ${section('Medical History', list(histories.map((h: any) => `${this.escapeHtml(h.type)} - ${this.escapeHtml(h.description)}`)))}
  ${section('Consents', list(consents.map((c: any) => `${this.escapeHtml(c.purpose)} - ${this.escapeHtml(new Date(c.grantedAt).toLocaleDateString())}`)))}
</body>
</html>`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
