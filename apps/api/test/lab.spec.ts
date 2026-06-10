import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LabService } from '../src/lab/lab.service';
import { PatientService } from '../src/patient/patient.service';
import { LabController } from '../src/lab/lab.controller';
import { EncounterLabController } from '../src/lab/encounter-lab.controller';
import { AuditService } from '../src/common/audit.service';
import { CreateLabOrderDto, EnterResultsDto } from '../src/lab/dto';
import { emptyContext, type RequestContext } from '../src/common/types';
import { MODULE_KEY, PERMISSION_KEY } from '../src/common/decorators';
import { PERMISSIONS } from '@hms/db';

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}

function model() {
  return {
    create: jest.fn().mockResolvedValue({ id: 'new' }),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    count: jest.fn().mockResolvedValue(0),
  };
}

function mockDb(): Record<string, any> {
  return {
    patient: model(),
    encounter: model(),
    tenant: model(),
    hospitalSettings: model(),
    labTestCatalog: model(),
    labOrder: model(),
    labOrderItem: model(),
    labSample: model(),
    labResult: model(),
    serviceCatalog: model(),
    bill: model(),
    billItem: model(),
    billableCharge: model(),
    appointment: model(),
    consent: model(),
    allergy: model(),
    medicalHistory: model(),
    patientDocument: model(),
    prescription: model(),
  };
}

function ctx(db: Record<string, any>): RequestContext {
  return { ...emptyContext(), userId: 'tech1', tenantId: 't1', db: db as any };
}

const asAudit = (a: any) => a as unknown as AuditService;

let db: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
let svc: LabService;
beforeEach(() => {
  db = mockDb();
  audit = mockAudit();
  svc = new LabService(asAudit(audit));
});

describe('Lab module gating', () => {
  it('both lab controllers require the LAB module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, LabController)).toBe('LAB');
    expect(Reflect.getMetadata(MODULE_KEY, EncounterLabController)).toBe('LAB');
  });

  it('allows lab report detail for clinical readers as well as print users', () => {
    const required = Reflect.getMetadata(PERMISSION_KEY, LabController.prototype.report);
    expect(required).toContain(PERMISSIONS.LAB_READ);
    expect(required).toContain(PERMISSIONS.LAB_REPORT_PRINT);
  });
});

describe('Lab catalog', () => {
  it('creates a catalog test and audits lab.catalog.create', async () => {
    db.labTestCatalog.findFirst.mockResolvedValue(null);
    db.labTestCatalog.create.mockResolvedValue({ id: 'c1', code: 'CBC' });
    await svc.createCatalog(ctx(db), { code: 'CBC', name: 'Complete Blood Count', price: 30000 });
    expect(db.labTestCatalog.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.catalog.create' }));
  });

  it('rejects a duplicate catalog code', async () => {
    db.labTestCatalog.findFirst.mockResolvedValue({ id: 'c1', code: 'CBC' });
    await expect(svc.createCatalog(ctx(db), { code: 'CBC', name: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates a catalog test and audits lab.catalog.update', async () => {
    db.labTestCatalog.findFirst.mockResolvedValue({ id: 'c1' });
    db.labTestCatalog.update.mockResolvedValue({ id: 'c1' });
    await svc.updateCatalog(ctx(db), 'c1', { price: 40000 });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.catalog.update' }));
  });
});

describe('Lab orders + lifecycle', () => {
  const tests = [{ testId: 'c1', testName: 'CBC' }];

  it('creates a LabOrder with items and audits lab.order', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1' });
    db.labOrder.create.mockResolvedValue({ id: 'o1', encounterId: null, items: [{ id: 'i1' }] });
    const out = await svc.create(ctx(db), { patientId: 'p1', tests });
    const data = db.labOrder.create.mock.calls[0][0].data;
    expect(data.status).toBe('ORDERED');
    expect(data.items.create).toHaveLength(1);
    expect(out.billing).toEqual({ posted: false, reason: 'no_catalog_match' });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.order' }));
  });

  it('doctor creates a lab order from an in-progress encounter', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', patientId: 'p1', providerId: 'dr1', status: 'IN_PROGRESS' });
    db.labOrder.create.mockResolvedValue({ id: 'o1', encounterId: 'e1', items: [{ id: 'i1' }] });
    db.bill.findFirst.mockResolvedValue(null);
    await svc.createFromEncounter(ctx(db), 'e1', { tests });
    expect(db.labOrder.create.mock.calls[0][0].data.patientId).toBe('p1');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.order' }));
  });

  it('bills lab charges from the lab test catalog price (by testId), not a name match', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', patientId: 'p1', providerId: 'dr1', status: 'IN_PROGRESS' });
    db.labOrder.create.mockResolvedValue({ id: 'o1', encounterId: 'e1', items: [{ id: 'i1' }] });
    db.labTestCatalog.findFirst.mockResolvedValue({ id: 'c1', name: 'CBC', price: 400000, active: true });
    const out = await svc.createFromEncounter(ctx(db), 'e1', { tests });
    expect(db.serviceCatalog.findFirst).not.toHaveBeenCalled(); // the lab test price short-circuits the fallback
    expect(db.billableCharge.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ sourceModule: 'LAB', sourceType: 'LAB_ORDER', name: 'CBC', total: 400000, catalogId: 'c1' })],
      }),
    );
    expect(out.billing).toMatchObject({ posted: true, items: 1, amount: 400000 });
  });

  it('billing integration falls back to a ServiceCatalog LAB entry when the test has no price', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', patientId: 'p1', providerId: 'dr1', status: 'IN_PROGRESS' });
    db.labOrder.create.mockResolvedValue({ id: 'o1', encounterId: 'e1', items: [{ id: 'i1' }] });
    db.serviceCatalog.findFirst.mockResolvedValue({ id: 's1', name: 'CBC', price: 30000 });
    const out = await svc.createFromEncounter(ctx(db), 'e1', { tests });
    expect(db.billableCharge.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            patientId: 'p1',
            encounterId: 'e1',
            sourceModule: 'LAB',
            sourceType: 'LAB_ORDER',
            name: 'CBC',
            total: 30000,
          }),
        ],
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'charge.create' }));
    expect(out.billing).toMatchObject({ posted: true, items: 1, amount: 30000 });
  });

  it('lab order still succeeds (no crash) when no billing catalog matches', async () => {
    db.encounter.findFirst.mockResolvedValue({ id: 'e1', patientId: 'p1', providerId: null, status: 'IN_PROGRESS' });
    db.labOrder.create.mockResolvedValue({ id: 'o1', encounterId: 'e1', items: [{ id: 'i1' }] });
    db.serviceCatalog.findFirst.mockResolvedValue(null);
    const out = await svc.createFromEncounter(ctx(db), 'e1', { tests });
    expect(db.billableCharge.createMany).not.toHaveBeenCalled();
    expect(out.billing).toEqual({ posted: false, reason: 'no_catalog_match' });
  });

  it('ORDERED → SAMPLE_COLLECTED via sample collection, audits lab.sample.collect', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'ORDERED', items: [{ id: 'i1' }] });
    await svc.collectSample(ctx(db), 'o1', {});
    expect(db.labSample.createMany).toHaveBeenCalled();
    expect(db.labOrderItem.updateMany.mock.calls[0][0].data.status).toBe('SAMPLE_COLLECTED');
    expect(db.labOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'SAMPLE_COLLECTED' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.sample.collect' }));
  });

  it('SAMPLE_COLLECTED → PROCESSING via status update, audits lab.status.update', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'SAMPLE_COLLECTED', items: [{ id: 'i1' }] });
    await svc.updateStatus(ctx(db), 'o1', { status: 'PROCESSING' });
    expect(db.labOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PROCESSING' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.status.update' }));
  });

  it('rejects the illegal ORDERED → COMPLETED jump', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'ORDERED', items: [] });
    await expect(svc.updateStatus(ctx(db), 'o1', { status: 'COMPLETED' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot move a CANCELLED order forward', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'CANCELLED', items: [] });
    await expect(svc.updateStatus(ctx(db), 'o1', { status: 'PROCESSING' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Lab results', () => {
  it('enters a result on a PROCESSING order, persists the abnormal flag, audits lab.result.enter', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'PROCESSING', items: [{ id: 'i1', testName: 'Hb' }] });
    db.labResult.findFirst.mockResolvedValue(null);
    await svc.enterResults(ctx(db), 'o1', {
      results: [{ labOrderItemId: 'i1', value: '17.5', unit: 'g/dL', abnormalFlag: 'CRITICAL' }],
    });
    expect(db.labResult.create.mock.calls[0][0].data.abnormalFlag).toBe('CRITICAL');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.result.enter' }));
  });

  it('blocks result editing on a COMPLETED (locked) order', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'COMPLETED', items: [{ id: 'i1' }] });
    await expect(
      svc.enterResults(ctx(db), 'o1', { results: [{ labOrderItemId: 'i1', value: '1' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifies a result, completes the item + order, audits lab.result.verify', async () => {
    db.labResult.findFirst.mockResolvedValue({ id: 'r1', labOrderItemId: 'i1', isVerified: false });
    db.labResult.update.mockResolvedValue({ id: 'r1', isVerified: true });
    db.labOrderItem.findFirst.mockResolvedValue({ labOrderId: 'o1' });
    db.labOrderItem.count.mockResolvedValue(0); // no remaining unfinished items
    const out = await svc.verifyResult(ctx(db), 'r1');
    expect(db.labResult.update.mock.calls[0][0].data.isVerified).toBe(true);
    expect(db.labResult.update.mock.calls[0][0].data.verifiedById).toBe('tech1');
    expect(db.labOrderItem.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'COMPLETED' } }));
    expect(db.labOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'COMPLETED' } }));
    expect(out.orderId).toBe('o1');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.result.verify' }));
  });

  it('does not complete the order while items remain unverified', async () => {
    db.labResult.findFirst.mockResolvedValue({ id: 'r1', labOrderItemId: 'i1', isVerified: false });
    db.labOrderItem.findFirst.mockResolvedValue({ labOrderId: 'o1' });
    db.labOrderItem.count.mockResolvedValue(1); // one still pending
    await svc.verifyResult(ctx(db), 'r1');
    expect(db.labOrder.update).not.toHaveBeenCalled();
  });

  it('rejects re-verifying an already verified result', async () => {
    db.labResult.findFirst.mockResolvedValue({ id: 'r1', labOrderItemId: 'i1', isVerified: true });
    await expect(svc.verifyResult(ctx(db), 'r1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyAll batch-verifies every unverified result and completes the order in one step', async () => {
    db.labOrder.findFirst
      .mockResolvedValueOnce({
        id: 'o1',
        status: 'PROCESSING',
        providerId: null,
        items: [
          { id: 'i1', results: [{ id: 'r1', labOrderItemId: 'i1', isVerified: false, abnormalFlag: 'NORMAL' }] },
          { id: 'i2', results: [{ id: 'r2', labOrderItemId: 'i2', isVerified: false, abnormalFlag: 'HIGH' }] },
        ],
      })
      .mockResolvedValueOnce({ id: 'o1', status: 'COMPLETED', items: [] });
    db.labOrderItem.count.mockResolvedValue(0);

    await svc.verifyAll(ctx(db), 'o1');

    expect(db.labResult.update).toHaveBeenCalledTimes(2);
    expect(db.labOrderItem.update).toHaveBeenCalledTimes(2);
    expect(db.labOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'COMPLETED' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.result.verify' }));
  });

  it('verifyAll rejects when no results have been entered yet', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'SAMPLE_COLLECTED', items: [{ id: 'i1', results: [] }] });
    await expect(svc.verifyAll(ctx(db), 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyAll leaves the order open while items still lack results', async () => {
    db.labOrder.findFirst
      .mockResolvedValueOnce({
        id: 'o1',
        status: 'PROCESSING',
        providerId: null,
        items: [{ id: 'i1', results: [{ id: 'r1', labOrderItemId: 'i1', isVerified: false, abnormalFlag: 'NORMAL' }] }],
      })
      .mockResolvedValueOnce({ id: 'o1', status: 'PROCESSING', items: [] });
    db.labOrderItem.count.mockResolvedValue(1); // a second item has no result yet

    await svc.verifyAll(ctx(db), 'o1');

    expect(db.labOrder.update).not.toHaveBeenCalled();
  });
});

describe('Lab report + isolation', () => {
  it('returns structured printable report data and audits lab.report.print', async () => {
    db.labOrder.findFirst.mockResolvedValue({ id: 'o1', status: 'COMPLETED', items: [] });
    db.tenant.findUnique.mockResolvedValue({ id: 't1', name: 'Demo Hospital' });
    db.hospitalSettings.findUnique.mockResolvedValue({ currency: 'INR' });
    const out = await svc.report(ctx(db), 'o1');
    expect(out.order.id).toBe('o1');
    expect(out.hospital.name).toBe('Demo Hospital');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'lab.report.print' }));
  });

  it('returns 404 for a cross-tenant / unknown order id (no leak)', async () => {
    db.labOrder.findFirst.mockResolvedValue(null);
    await expect(svc.getOrder(ctx(db), 'other-tenant-order')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Patient timeline includes lab results', () => {
  it('timeline query pulls lab orders with their results', async () => {
    db.patient.findFirst.mockResolvedValue({ id: 'p1' });
    const patientSvc = new PatientService(asAudit(audit));
    const out = await patientSvc.timeline(ctx(db), 'p1');
    expect(out).toHaveProperty('labOrders');
    const labCall = db.labOrder.findMany.mock.calls[0][0];
    expect(labCall.include.items.include.results).toBeDefined();
  });
});

describe('Lab DTO validation', () => {
  it('requires at least one test on a lab order', async () => {
    const errs = await validate(plainToInstance(CreateLabOrderDto, { patientId: 'x', tests: [] }));
    expect(errs.length).toBeGreaterThan(0);
  });

  it('requires at least one result row on result entry', async () => {
    const errs = await validate(plainToInstance(EnterResultsDto, { results: [] }));
    expect(errs.length).toBeGreaterThan(0);
  });
});
