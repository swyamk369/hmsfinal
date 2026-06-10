import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

let mockTx: Record<string, any>;
const mockTenantTransaction = jest.fn((_tid: string, fn: (tx: any) => any) => fn(mockTx));
jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), tenantTransaction: mockTenantTransaction }));

import { IpdController } from '../src/ipd/ipd.controller';
import { NursingController } from '../src/ipd/nursing.controller';
import { IpdService } from '../src/ipd/ipd.service';
import { NursingService } from '../src/ipd/nursing.service';
import { DischargeDto, TransferDto } from '../src/ipd/dto';
import { AuditService } from '../src/common/audit.service';
import { MODULE_KEY } from '../src/common/decorators';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    upsert: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}

function db(): Record<string, any> {
  return {
    ward: model(),
    bed: model(),
    admission: model(),
    bedTransfer: model(),
    ipdRound: model(),
    ipdCharge: model(),
    dischargeSummary: model(),
    patient: model(),
    encounter: model(),
    provider: model(),
    nursingNote: model(),
    medicationAdministration: model(),
    vitals: model(),
    labOrder: model(),
    bill: model(),
    billItem: model(),
    hospitalSettings: model(),
    tenant: model(),
    diagnosis: model(),
  };
}

function ctx(d: Record<string, any>): RequestContext {
  return {
    ...emptyContext(),
    userId: 'u1',
    tenantId: 't1',
    tenantStatus: 'ACTIVE',
    membershipExists: true,
    membershipActive: true,
    providerId: 'prov1',
    db: d as any,
  };
}

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}

function execFor(context: Partial<RequestContext>): any {
  const full = { ...emptyContext(), ...context };
  return {
    switchToHttp: () => ({ getRequest: () => ({ ctx: full }) }),
    getHandler: () => function handler() {},
    getClass: () => class Cls {},
  };
}

function reflector(value: unknown): any {
  return { getAllAndOverride: () => value };
}

const asAudit = (a: any) => a as unknown as AuditService;

const admitted = {
  id: 'adm1',
  tenantId: 't1',
  patientId: 'pat1',
  bedId: 'bed1',
  encounterId: 'enc1',
  providerId: 'prov1',
  status: 'ADMITTED',
  admittedAt: new Date().toISOString(),
  dischargedAt: null,
  expectedDischargeAt: null,
  dischargeReason: null,
  dischargeNotes: null,
};

function admissionDetail(over: Record<string, any> = {}) {
  return {
    ...admitted,
    patient: { id: 'pat1', fullName: 'Jane Patient', mrn: 'MRN-1', allergies: [] },
    bed: { id: over.bedId ?? 'bed1', bedNumber: '101', ward: { id: 'ward1', name: 'Ward A', type: 'GENERAL' } },
    rounds: [],
    charges: [],
    transfers: [],
    ...over,
  };
}

let d: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
let ipd: IpdService;
let nursing: NursingService;

beforeEach(() => {
  d = db();
  audit = mockAudit();
  mockTx = db();
  mockTenantTransaction.mockClear();
  d.hospitalSettings.findUnique.mockResolvedValue({ invoicePrefix: 'INV', mrnPrefix: 'MRN' });
  ipd = new IpdService(asAudit(audit));
  nursing = new NursingService(asAudit(audit), ipd);
});

describe('IPD/Nursing module and permission gates', () => {
  it('IPD and Nursing controllers require the IPD module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, IpdController)).toBe('IPD');
    expect(Reflect.getMetadata(MODULE_KEY, NursingController)).toBe('IPD');
  });

  it('IPD disabled tenant returns 403 at the module guard', () => {
    const guard = new ModuleGuard(reflector('IPD'));
    expect(() => guard.canActivate(execFor({ tenantId: 't1', modules: new Set(['PATIENT', 'OPD']) }))).toThrow(ForbiddenException);
  });

  it('non-IPD/nursing roles without permissions get 403', () => {
    const guard = new PermissionsGuard(reflector(['ipd.admit']));
    expect(() => guard.canActivate(execFor({ userId: 'u1', permissions: new Set(['patient.read']) }))).toThrow(ForbiddenException);
  });
});

describe('IPD admission lifecycle', () => {
  it('admit creates an admission and marks the bed occupied', async () => {
    d.patient.findFirst.mockResolvedValue({ id: 'pat1' });
    d.bed.findFirst.mockResolvedValue({ id: 'bed1', status: 'AVAILABLE' });
    mockTx.bed.findFirst.mockResolvedValue({ id: 'bed1', status: 'AVAILABLE' });
    mockTx.encounter.create.mockResolvedValue({ id: 'enc1' });
    mockTx.admission.create.mockResolvedValue({ ...admitted });
    d.admission.findFirst.mockResolvedValue(admissionDetail());

    const out = await ipd.admit(ctx(d), { patientId: 'pat1', bedId: 'bed1', reason: 'Observation' });

    expect(mockTx.encounter.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'IPD' }) }));
    expect(mockTx.admission.create).toHaveBeenCalled();
    expect(mockTx.bed.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bed1' }, data: { status: 'OCCUPIED' } }));
    expect(out.id).toBe('adm1');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ipd.admit' }));
  });

  it('admit to an occupied bed is blocked before mutation', async () => {
    d.patient.findFirst.mockResolvedValue({ id: 'pat1' });
    d.bed.findFirst.mockResolvedValue({ id: 'bed1', status: 'OCCUPIED' });
    await expect(ipd.admit(ctx(d), { patientId: 'pat1', bedId: 'bed1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTenantTransaction).not.toHaveBeenCalled();
  });

  it('transfer requires a reason by DTO validation', async () => {
    expect((await validate(plainToInstance(TransferDto, { toBedId: '11111111-1111-4111-8111-111111111111', reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(TransferDto, { toBedId: '11111111-1111-4111-8111-111111111111', reason: 'Clinical need' }))).length).toBe(0);
  });

  it('transfer frees old bed, occupies new bed, and audits', async () => {
    d.admission.findFirst.mockResolvedValueOnce({ ...admitted }).mockResolvedValueOnce(admissionDetail({ bedId: 'bed2' }));
    d.bed.findFirst.mockResolvedValue({ id: 'bed2', status: 'AVAILABLE' });
    mockTx.bed.findFirst.mockResolvedValue({ id: 'bed2', status: 'AVAILABLE' });

    await ipd.transfer(ctx(d), 'adm1', { toBedId: 'bed2', reason: 'Needs ICU observation' });

    expect(mockTx.bedTransfer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fromBedId: 'bed1', toBedId: 'bed2', reason: 'Needs ICU observation' }) }));
    expect(mockTx.bed.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bed1' }, data: { status: 'AVAILABLE' } }));
    expect(mockTx.bed.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bed2' }, data: { status: 'OCCUPIED' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ipd.transfer' }));
  });

  it('discharge requires reason and summary by DTO validation', async () => {
    expect((await validate(plainToInstance(DischargeDto, { reason: '', summary: 'Stable' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(DischargeDto, { reason: 'Recovered', summary: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(DischargeDto, { reason: 'Recovered', summary: 'Stable' }))).length).toBe(0);
  });

  it('discharge frees bed and upserts DischargeSummary', async () => {
    d.admission.findFirst.mockResolvedValueOnce({ ...admitted }).mockResolvedValueOnce(admissionDetail({ status: 'DISCHARGED', dischargedAt: new Date().toISOString() }));

    await ipd.discharge(ctx(d), 'adm1', { reason: 'Recovered', summary: 'Stable', instructions: 'Review in 7 days' });

    expect(mockTx.admission.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'adm1' }, data: expect.objectContaining({ status: 'DISCHARGED', dischargeReason: 'Recovered' }) }));
    expect(mockTx.bed.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bed1' }, data: { status: 'AVAILABLE' } }));
    expect(mockTx.dischargeSummary.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { admissionId: 'adm1' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ipd.discharge' }));
  });

  it('discharged admission cannot transfer or discharge again', async () => {
    d.admission.findFirst.mockResolvedValue({ ...admitted, status: 'DISCHARGED' });
    await expect(ipd.transfer(ctx(d), 'adm1', { toBedId: 'bed2', reason: 'no' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(ipd.discharge(ctx(d), 'adm1', { reason: 'again', summary: 'again' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('IPD rounds, charges, summary isolation', () => {
  it('add round audits ipd.round.write', async () => {
    d.admission.findFirst.mockResolvedValue({ ...admitted });
    d.ipdRound.create.mockResolvedValue({ id: 'round1', notes: 'Stable' });
    await ipd.addRound(ctx(d), 'adm1', { notes: 'Stable' });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ipd.round.write' }));
  });

  it('add charge creates IpdCharge and BillItem', async () => {
    d.admission.findFirst.mockResolvedValue({ ...admitted });
    d.bill.findFirst.mockResolvedValue(null);
    d.bill.count.mockResolvedValue(0);
    d.bill.create.mockResolvedValue({ id: 'bill1', totalAmount: 5000, discount: 0 });
    d.billItem.create.mockResolvedValue({ id: 'item1' });
    d.ipdCharge.create.mockResolvedValue({ id: 'charge1', description: 'Room', quantity: 1, unitPrice: 5000 });

    await ipd.addCharge(ctx(d), 'adm1', { description: 'Room', quantity: 1, unitPrice: 5000 });

    expect(d.billItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ billId: 'bill1', sourceType: 'IPD' }) }));
    expect(d.ipdCharge.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ billItemId: 'item1' }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ipd.charge.write' }));
  });

  it('cross-tenant admission/bed access returns not found or empty through scoped db', async () => {
    await expect(ipd.getAdmission(ctx(d), 'other-adm')).rejects.toBeInstanceOf(NotFoundException);
    d.ward.findMany.mockResolvedValue([]);
    await expect(ipd.occupancy(ctx(d))).resolves.toMatchObject({ wards: [] });
  });
});

describe('Nursing lifecycle', () => {
  it('dashboard returns vitals due counts', async () => {
    d.admission.findMany.mockResolvedValue([
      { ...admitted, encounterId: 'enc1', patient: { allergies: [] }, bed: { ward: { name: 'Ward A' } } },
      { ...admitted, id: 'adm2', encounterId: 'enc2', patient: { allergies: [{ id: 'al1' }] }, bed: { ward: { name: 'Ward A' } } },
    ]);
    d.vitals.findMany.mockResolvedValue([{ encounterId: 'enc1' }]);
    d.medicationAdministration.count.mockResolvedValue(1);
    d.nursingNote.count.mockResolvedValue(2);

    const out = await nursing.dashboard(ctx(d));

    expect(out.counts).toMatchObject({ admitted: 2, vitalsToday: 1, vitalsDue: 1, medsToday: 1, notesToday: 2, alerts: 1 });
  });

  it('nursing note audits nursing.note.write', async () => {
    d.admission.findFirst.mockResolvedValue({ ...admitted });
    d.nursingNote.create.mockResolvedValue({ id: 'note1', note: 'Observed' });
    await nursing.addNote(ctx(d), 'adm1', { note: 'Observed' });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'nursing.note.write' }));
  });

  it('medication administration audits medication.administer', async () => {
    d.admission.findFirst.mockResolvedValue({ ...admitted });
    d.medicationAdministration.create.mockResolvedValue({ id: 'med1', status: 'ADMINISTERED' });
    await nursing.addMedication(ctx(d), 'adm1', { status: 'ADMINISTERED', notes: 'Given' });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'medication.administer' }));
  });
});
