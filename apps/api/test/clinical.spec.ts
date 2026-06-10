import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatientService } from '../src/patient/patient.service';
import { AppointmentService } from '../src/opd/appointment.service';
import { EncounterService } from '../src/opd/encounter.service';
import { BillingService } from '../src/billing/billing.service';
import { AuditService } from '../src/common/audit.service';
import { ArchivePatientDto } from '../src/patient/dto';
import { CancelBillDto, RefundDto } from '../src/billing/dto';
import { emptyContext, type RequestContext } from '../src/common/types';

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}

function model() {
  return {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  };
}

function mockDb(): Record<string, any> {
  return {
    patient: model(),
    consent: model(),
    allergy: model(),
    medicalHistory: model(),
    patientDocument: model(),
    hospitalSettings: model(),
    tenant: model(),
    encounter: model(),
    appointment: model(),
    vitals: model(),
    diagnosis: model(),
    clinicalNote: model(),
    prescription: model(),
    serviceCatalog: model(),
    bill: model(),
    payment: model(),
    refund: model(),
    labOrder: model(),
  };
}

function ctx(db: Record<string, any>): RequestContext {
  return { ...emptyContext(), userId: 'u1', tenantId: 't1', db: db as any };
}

let db: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
beforeEach(() => {
  db = mockDb();
  audit = mockAudit();
  db.hospitalSettings.findUnique.mockResolvedValue({ mrnPrefix: 'MRN', invoicePrefix: 'INV', currency: 'INR' });
});

const asAudit = () => audit as unknown as AuditService;

describe('PatientService', () => {
  it('registers a patient with an MRN and audits patient.create', async () => {
    db.patient.findFirst.mockResolvedValue(null);
    db.patient.create.mockResolvedValue({ id: 'p1', fullName: 'Jane', mrn: 'MRN-2026-00001' });
    const svc = new PatientService(asAudit());
    await svc.register(ctx(db), { fullName: 'Jane' });
    expect(db.patient.create).toHaveBeenCalledTimes(1);
    expect(db.patient.create.mock.calls[0][0].data.mrn).toMatch(/^MRN-/);
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'patient.create' }));
  });

  it('archives softly (no hard delete) and audits patient.archive', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1', deletedAt: null });
    db.patient.update.mockResolvedValue({ id: 'p1', deletedAt: new Date() });
    const svc = new PatientService(asAudit());
    await svc.archive(ctx(db), 'p1', 'Duplicate record');
    expect(db.patient.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(db.patient.delete).toBeUndefined();
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'patient.archive' }));
  });

  it('blocks archiving an already-archived patient', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1', deletedAt: new Date() });
    await expect(new PatientService(asAudit()).archive(ctx(db), 'p1', 'x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('attaches an external patient document and audits it', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'MRN-1', fullName: 'Jane' });
    db.patientDocument.create.mockResolvedValue({
      id: 'doc1',
      patientId: 'p1',
      category: 'LAB',
      source: 'EXTERNAL',
      mimeType: 'application/pdf',
      fileName: 'outside-report.pdf',
    });
    const svc = new PatientService(asAudit());

    await svc.attachDocument(ctx(db), 'p1', {
      title: 'Outside lab report',
      category: 'LAB',
      mimeType: 'application/pdf',
      fileName: 'outside-report.pdf',
      documentUrl: 'https://secure.example/report.pdf',
    });

    expect(db.patientDocument.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        tenantId: 't1',
        patientId: 'p1',
        title: 'Outside lab report',
        source: 'EXTERNAL',
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'patient.document.attach' }),
    );
  });

  it('rejects unsafe patient document URLs', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1', mrn: 'MRN-1', fullName: 'Jane' });
    const svc = new PatientService(asAudit());
    await expect(
      svc.attachDocument(ctx(db), 'p1', {
        title: 'Bad doc',
        documentUrl: 'javascript:alert(1)',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates a patient summary document and audits it', async () => {
    db.patient.findFirst.mockResolvedValue({
      id: 'p1',
      mrn: 'MRN-1',
      fullName: 'Jane',
      dob: null,
      sex: 'FEMALE',
      phone: null,
      email: null,
    });
    db.encounter.findMany.mockResolvedValue([{ id: 'e1', status: 'COMPLETED', type: 'OPD', chiefComplaint: 'Fever', createdAt: new Date() }]);
    db.patientDocument.create.mockResolvedValue({ id: 'doc2', category: 'GENERATED_REPORT', source: 'GENERATED' });
    const svc = new PatientService(asAudit());

    await svc.generateSummaryDocument(ctx(db), 'p1', {});

    const data = db.patientDocument.create.mock.calls[0][0].data;
    expect(data.category).toBe('GENERATED_REPORT');
    expect(data.source).toBe('GENERATED');
    expect(data.documentUrl).toMatch(/^data:text\/html;base64,/);
    expect(audit.log).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'patient.document.generate_summary' }),
    );
  });
});

describe('AppointmentService', () => {
  it('cancels a scheduled appointment and audits appointment.cancel', async () => {
    db.appointment.findFirst.mockResolvedValue({ id: 'a1', status: 'SCHEDULED' });
    db.appointment.update.mockResolvedValue({ id: 'a1' });
    await new AppointmentService(asAudit()).cancel(ctx(db), 'a1', 'Patient no longer needs it');
    expect(db.appointment.update.mock.calls[0][0].data.status).toBe('CANCELLED');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'appointment.cancel' }));
  });

  it('cannot reschedule a completed appointment', async () => {
    db.appointment.findFirst.mockResolvedValue({ id: 'a1', status: 'COMPLETED' });
    await expect(
      new AppointmentService(asAudit()).reschedule(ctx(db), 'a1', new Date().toISOString(), 'x'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('EncounterService', () => {
  it('creates a walk-in checked-in with a token and audits encounter.create', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1' });
    db.encounter.count.mockResolvedValue(2);
    db.encounter.create.mockResolvedValue({ id: 'e1', tokenNumber: 3, status: 'CHECKED_IN' });
    await new EncounterService(asAudit()).create(ctx(db), { patientId: 'p1', type: 'WALK_IN' });
    const data = db.encounter.create.mock.calls[0][0].data;
    expect(data.status).toBe('CHECKED_IN');
    expect(data.tokenNumber).toBe(3);
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'encounter.create' }));
  });

  it('allows CHECKED_IN → IN_PROGRESS (start) and audits encounter.start', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', status: 'CHECKED_IN' });
    await new EncounterService(asAudit()).start(ctx(db), 'e1');
    expect(db.encounter.update.mock.calls[0][0].data.status).toBe('IN_PROGRESS');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'encounter.start' }));
  });

  it('rejects an invalid transition (start from SCHEDULED)', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', status: 'SCHEDULED' });
    await expect(new EncounterService(asAudit()).start(ctx(db), 'e1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks clinical writes on a completed encounter', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', status: 'COMPLETED' });
    await expect(new EncounterService(asAudit()).addVitals(ctx(db), 'e1', { pulse: 80 } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('finalizes a draft prescription and audits prescription.finalize', async () => {
    db.prescription.findFirst.mockResolvedValue({ id: 'rx1', status: 'DRAFT' });
    db.prescription.update.mockResolvedValue({ id: 'rx1', status: 'FINALIZED', items: [] });
    await new EncounterService(asAudit()).finalizePrescription(ctx(db), 'rx1');
    expect(db.prescription.update.mock.calls[0][0].data.status).toBe('FINALIZED');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'prescription.finalize' }));
  });

  it('protects an already-finalized prescription from re-finalizing', async () => {
    db.prescription.findFirst.mockResolvedValue({ id: 'rx1', status: 'FINALIZED' });
    await expect(new EncounterService(asAudit()).finalizePrescription(ctx(db), 'rx1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('BillingService', () => {
  it('creates a bill computing net = total - discount and audits bill.create', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1' });
    db.bill.findFirst.mockResolvedValue(null);
    db.bill.create.mockResolvedValue({ id: 'b1', billNumber: 'INV-2026-00001' });
    await new BillingService(asAudit()).create(ctx(db), {
      patientId: 'p1',
      discount: 5000,
      items: [{ name: 'Consult', quantity: 2, unitPrice: 50000 }],
    });
    const data = db.bill.create.mock.calls[0][0].data;
    expect(data.totalAmount).toBe(100000);
    expect(data.netAmount).toBe(95000);
    expect(data.status).toBe('UNPAID');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bill.create' }));
  });

  it('recomputes to PARTIAL after a partial payment and audits payment.collect', async () => {
    const bill = { id: 'b1', netAmount: 100000, status: 'UNPAID', payments: [], refunds: [] };
    db.bill.findFirst.mockResolvedValue(bill);
    db.payment.create.mockResolvedValue({ id: 'pay1' });
    await new BillingService(asAudit()).addPayment(ctx(db), 'b1', { amount: 40000, method: 'CASH' });
    expect(db.bill.update.mock.calls[0][0].data.status).toBe('PARTIAL');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'payment.collect' }));
  });

  it('rejects a payment that exceeds the outstanding balance', async () => {
    db.bill.findFirst.mockResolvedValue({ id: 'b1', netAmount: 100000, status: 'UNPAID', payments: [], refunds: [] });
    await expect(
      new BillingService(asAudit()).addPayment(ctx(db), 'b1', { amount: 200000, method: 'CASH' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot collect payment on a cancelled bill', async () => {
    db.bill.findFirst.mockResolvedValue({ id: 'b1', netAmount: 100000, status: 'CANCELLED', payments: [], refunds: [] });
    await expect(
      new BillingService(asAudit()).addPayment(ctx(db), 'b1', { amount: 1000, method: 'CASH' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot cancel a bill with collected payments', async () => {
    db.bill.findFirst.mockResolvedValue({
      id: 'b1',
      netAmount: 100000,
      status: 'PARTIAL',
      payments: [{ amount: 40000 }],
      refunds: [],
    });
    await expect(new BillingService(asAudit()).cancel(ctx(db), 'b1', 'oops')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refund cannot exceed collected payments', async () => {
    db.bill.findFirst.mockResolvedValue({
      id: 'b1',
      netAmount: 100000,
      status: 'PARTIAL',
      payments: [{ amount: 50000 }],
      refunds: [],
    });
    await expect(new BillingService(asAudit()).refund(ctx(db), 'b1', 80000, 'too much')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('records a valid refund and audits payment.refund', async () => {
    db.bill.findFirst.mockResolvedValue({
      id: 'b1',
      netAmount: 100000,
      status: 'PAID',
      payments: [{ amount: 50000 }],
      refunds: [],
    });
    db.refund.create.mockResolvedValue({ id: 'r1' });
    await new BillingService(asAudit()).refund(ctx(db), 'b1', 50000, 'Patient overcharged');
    expect(db.refund.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'payment.refund' }));
  });
});

describe('reason DTO enforcement', () => {
  it('rejects archive / cancel / refund without a reason', async () => {
    expect((await validate(plainToInstance(ArchivePatientDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CancelBillDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(RefundDto, { amount: 100, reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(RefundDto, { amount: 100, reason: 'ok' }))).length).toBe(0);
  });
});
