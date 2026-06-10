import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

let mockTx: Record<string, any>;
const mockTenantTransaction = jest.fn((_tid: string, fn: (tx: any) => any) => fn(mockTx));
jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), tenantTransaction: mockTenantTransaction }));

import { InsuranceController } from '../src/insurance/insurance.controller';
import { InsuranceService } from '../src/insurance/insurance.service';
import { CancelClaimDto, RejectClaimDto } from '../src/insurance/dto';
import { AuditService } from '../src/common/audit.service';
import { MODULE_KEY } from '../src/common/decorators';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}

function db(): Record<string, any> {
  return {
    insuranceProvider: model(),
    patientInsurancePolicy: model(),
    insuranceClaim: model(),
    claimSettlement: model(),
    patient: model(),
    bill: model(),
    payment: model(),
    auditLog: model(),
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

const bill = {
  id: 'bill1',
  patientId: 'pat1',
  billNumber: 'INV-1',
  netAmount: 10000,
  status: 'UNPAID',
  claims: [],
  payments: [],
  refunds: [],
};
const policy = {
  id: 'pol1',
  patientId: 'pat1',
  providerId: 'prov1',
  policyNumber: 'POL-1',
  active: true,
  coverageDetails: JSON.stringify({ coverageLimit: 8000, patientSharePercent: 20 }),
  provider: { id: 'prov1', name: 'TPA' },
};
const claim = {
  id: 'claim1',
  billId: 'bill1',
  patientPolicyId: 'pol1',
  providerId: 'prov1',
  claimAmount: 8000,
  approvedAmount: null,
  patientShare: 2000,
  status: 'SUBMITTED',
  notes: null,
  settlements: [],
};

let d: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
let svc: InsuranceService;

beforeEach(() => {
  d = db();
  mockTx = db();
  mockTenantTransaction.mockClear();
  audit = mockAudit();
  svc = new InsuranceService(asAudit(audit));
});

describe('Insurance module and permission gates', () => {
  it('controller requires the INSURANCE module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, InsuranceController)).toBe('INSURANCE');
  });

  it('insurance disabled tenant returns 403 at the module guard', () => {
    const guard = new ModuleGuard(reflector('INSURANCE'));
    expect(() => guard.canActivate(execFor({ tenantId: 't1', modules: new Set(['BILLING']) }))).toThrow(ForbiddenException);
  });

  it('missing insurance permission returns 403 at permission guard', () => {
    const guard = new PermissionsGuard(reflector(['insurance.claim.create']));
    expect(() => guard.canActivate(execFor({ userId: 'u1', permissions: new Set(['bill.read']) }))).toThrow(ForbiddenException);
  });
});

describe('Insurance policy and claim lifecycle', () => {
  it('creates a patient policy and audits it', async () => {
    d.patient.findFirst.mockResolvedValue({ id: 'pat1' });
    d.insuranceProvider.findFirst.mockResolvedValue({ id: 'prov1', name: 'TPA' });
    d.patientInsurancePolicy.findFirst.mockResolvedValue(null);
    d.patientInsurancePolicy.create.mockResolvedValue({ ...policy, patient: { id: 'pat1' }, _count: { claims: 0 } });

    const out = await svc.createPolicy(ctx(d), {
      patientId: 'pat1',
      providerId: 'prov1',
      policyNumber: 'POL-1',
      coverageLimit: 8000,
      patientSharePercent: 20,
    });

    expect(out.coverage.coverageLimit).toBe(8000);
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'insurance.policy.create' }));
  });

  it('creates claim from bill, calculates patient share, and audits it', async () => {
    d.bill.findFirst.mockResolvedValue({ ...bill });
    d.patientInsurancePolicy.findFirst.mockResolvedValue({ ...policy });
    d.insuranceClaim.create.mockResolvedValue({ ...claim });
    d.insuranceClaim.findFirst.mockResolvedValue({
      ...claim,
      bill,
      patientPolicy: { ...policy, patient: { id: 'pat1' } },
      settlements: [],
    });

    const out = await svc.createClaim(ctx(d), { billId: 'bill1', patientPolicyId: 'pol1', submit: true });

    expect(d.insuranceClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ claimAmount: 8000, patientShare: 2000, status: 'SUBMITTED' }),
      }),
    );
    expect(out.id).toBe('claim1');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'insurance.claim.create' }));
  });

  it('blocks claim creation when policy does not belong to billed patient', async () => {
    d.bill.findFirst.mockResolvedValue({ ...bill });
    d.patientInsurancePolicy.findFirst.mockResolvedValue({ ...policy, patientId: 'other' });
    await expect(svc.createClaim(ctx(d), { billId: 'bill1', patientPolicyId: 'pol1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks duplicate active claim for the same bill and policy', async () => {
    d.bill.findFirst.mockResolvedValue({ ...bill, claims: [{ patientPolicyId: 'pol1', status: 'SUBMITTED' }] });
    d.patientInsurancePolicy.findFirst.mockResolvedValue({ ...policy });
    await expect(svc.createClaim(ctx(d), { billId: 'bill1', patientPolicyId: 'pol1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reject and cancel require reasons by DTO validation', async () => {
    expect((await validate(plainToInstance(RejectClaimDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CancelClaimDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(RejectClaimDto, { reason: 'Not covered' }))).length).toBe(0);
  });

  it('approves claim and writes audit', async () => {
    d.insuranceClaim.findFirst
      .mockResolvedValueOnce({ ...claim, status: 'UNDER_REVIEW', bill })
      .mockResolvedValueOnce({
        ...claim,
        status: 'APPROVED',
        approvedAmount: 7500,
        bill,
        patientPolicy: { ...policy },
        settlements: [],
      });

    await svc.approve(ctx(d), 'claim1', { approvedAmount: 7500, patientShare: 2500 });

    expect(d.insuranceClaim.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIALLY_APPROVED', approvedAmount: 7500 }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'insurance.claim.approve' }));
  });

  it('settlement is atomic, creates payment/settlement, updates bill and claim, then audits', async () => {
    d.insuranceClaim.findFirst.mockResolvedValue({
      ...claim,
      status: 'APPROVED',
      approvedAmount: 8000,
      bill,
      settlements: [],
    });
    mockTx.insuranceClaim.findFirst.mockResolvedValue({
      ...claim,
      status: 'APPROVED',
      approvedAmount: 8000,
      bill,
      settlements: [],
    });
    mockTx.payment.create.mockResolvedValue({ id: 'pay1', amount: 8000 });
    d.insuranceClaim.findFirst.mockResolvedValueOnce({
      ...claim,
      status: 'APPROVED',
      approvedAmount: 8000,
      bill,
      settlements: [],
    });
    d.insuranceClaim.findFirst.mockResolvedValueOnce({
      ...claim,
      status: 'SETTLED',
      approvedAmount: 8000,
      bill: { ...bill, payments: [{ amount: 8000 }], refunds: [] },
      patientPolicy: { ...policy },
      settlements: [{ id: 'set1', amount: 8000, settledAt: new Date() }],
    });

    await svc.settle(ctx(d), 'claim1', { amount: 8000, transactionId: 'EFT-1' });

    expect(mockTenantTransaction).toHaveBeenCalled();
    expect(mockTx.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ method: 'INSURANCE', amount: 8000 }) }));
    expect(mockTx.claimSettlement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentId: 'pay1' }) }));
    expect(mockTx.bill.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'PARTIAL' } }));
    expect(mockTx.insuranceClaim.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SETTLED' }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'insurance.claim.settle' }));
  });

  it('duplicate settlement is blocked', async () => {
    d.insuranceClaim.findFirst.mockResolvedValue({
      ...claim,
      status: 'APPROVED',
      approvedAmount: 8000,
      bill,
      settlements: [{ id: 'set1', amount: 8000 }],
    });
    await expect(svc.settle(ctx(d), 'claim1', {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cross-tenant claim access returns not found through scoped db', async () => {
    await expect(svc.getClaim(ctx(d), 'other-claim')).rejects.toBeInstanceOf(NotFoundException);
  });
});
