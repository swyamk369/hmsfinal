import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

let mockTx: Record<string, any>;
const mockTenantTransaction = jest.fn((_tid: string, fn: (tx: any) => any) => fn(mockTx));
jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), tenantTransaction: mockTenantTransaction }));

import { MODULES, PERMISSIONS } from '@hms/db';
import { FinanceController } from '../src/finance/finance.controller';
import { FinanceService } from '../src/finance/finance.service';
import { CancelChargeDto, FinanceCancelBillDto, FinanceRefundDto } from '../src/finance/dto';
import { MODULE_KEY, PERMISSION_KEY } from '../src/common/decorators';
import { AuditService } from '../src/common/audit.service';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}

function db(): Record<string, any> {
  return {
    patient: model(),
    billableCharge: model(),
    bill: model(),
    billItem: model(),
    payment: model(),
    refund: model(),
    insuranceClaim: model(),
    financeDayClose: model(),
    financeApproval: model(),
    patientDocument: model(),
    hospitalSettings: model(),
    auditLog: model(),
    labOrder: model(),
    dispenseRecord: model(),
    encounter: model(),
    admission: model(),
    bed: model(),
  };
}

function ctx(d: Record<string, any>, over: Partial<RequestContext> = {}): RequestContext {
  return {
    ...emptyContext(),
    userId: 'u1',
    tenantId: 't1',
    tenantStatus: 'ACTIVE',
    membershipExists: true,
    membershipActive: true,
    permissions: new Set([PERMISSIONS.FINANCE_READ]),
    modules: new Set([MODULES.BILLING]),
    db: d as any,
    ...over,
  };
}

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}

function mockBilling() {
  return {
    list: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue({ id: 'bill1', billNumber: 'INV-2026-00001', items: [], payments: [], refunds: [] }),
    addPayment: jest.fn().mockResolvedValue({ id: 'bill1', status: 'PAID' }),
    refund: jest.fn().mockResolvedValue({ id: 'bill1', status: 'REFUNDED' }),
    cancel: jest.fn().mockResolvedValue({ id: 'bill1', status: 'CANCELLED' }),
  };
}

const asAudit = (a: any) => a as unknown as AuditService;

let d: Record<string, any>;
let tx: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
let billing: ReturnType<typeof mockBilling>;
let svc: FinanceService;

beforeEach(() => {
  d = db();
  tx = db();
  mockTx = tx;
  mockTenantTransaction.mockClear();
  audit = mockAudit();
  billing = mockBilling();
  svc = new FinanceService(asAudit(audit), billing as any);
  d.hospitalSettings.findUnique.mockResolvedValue({ invoicePrefix: 'INV' });
});

describe('Finance module gates', () => {
  it('requires BILLING module and finance/billing permissions', () => {
    expect(Reflect.getMetadata(MODULE_KEY, FinanceController)).toBe(MODULES.BILLING);
    expect(Reflect.getMetadata(PERMISSION_KEY, FinanceController.prototype.dashboard)).toEqual(
      expect.arrayContaining([PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ, PERMISSIONS.PAYMENT_COLLECT]),
    );
    expect(Reflect.getMetadata(PERMISSION_KEY, FinanceController.prototype.payment)).toEqual(
      expect.arrayContaining([PERMISSIONS.FINANCE_CASHIER, PERMISSIONS.PAYMENT_COLLECT]),
    );
  });

  it('requires reasons for destructive finance DTOs', async () => {
    expect((await validate(plainToInstance(CancelChargeDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(FinanceRefundDto, { amount: 100, reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(FinanceCancelBillDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CancelChargeDto, { reason: 'Duplicate charge' }))).length).toBe(0);
  });
});

describe('Finance revenue-leakage reconciliation (Phase 21.2)', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  it('flags a completed lab order that has no charge', async () => {
    d.labOrder.findMany.mockResolvedValue([{ id: 'lo1', patientId: 'p1', createdAt: new Date() }]);
    d.billableCharge.findMany.mockResolvedValue([]); // no LAB charge exists
    d.patient.findMany.mockResolvedValue([{ id: 'p1', fullName: 'Asha', mrn: 'MRN-1' }]);

    const out = await svc.leakage(ctx(d));
    const lab = out.categories.find((c: any) => c.key === 'LAB')!;
    expect(lab.count).toBe(1);
    expect(lab.rows[0]).toMatchObject({ sourceId: 'lo1', href: '/lab/orders/lo1' });
    expect(out.totalCount).toBeGreaterThanOrEqual(1);
  });

  it('clears the lab order once a LAB charge exists', async () => {
    d.labOrder.findMany.mockResolvedValue([{ id: 'lo1', patientId: 'p1', createdAt: new Date() }]);
    d.billableCharge.findMany.mockResolvedValue([{ sourceId: 'lo1' }]); // now billed
    const out = await svc.leakage(ctx(d));
    expect(out.categories.find((c: any) => c.key === 'LAB')!.count).toBe(0);
  });

  it('flags admitted bed-days not yet accrued and estimates the recoverable amount', async () => {
    d.admission.findMany.mockResolvedValue([{ id: 'adm1', patientId: 'p1', admittedAt: daysAgo(3), bedChargedThrough: null, bedId: 'bed1' }]);
    d.bed.findMany.mockResolvedValue([{ id: 'bed1', ward: { dailyRate: 100000 } }]);
    d.patient.findMany.mockResolvedValue([{ id: 'p1', fullName: 'Asha', mrn: 'MRN-1' }]);

    const out = await svc.leakage(ctx(d));
    const ipd = out.categories.find((c: any) => c.key === 'IPD')!;
    expect(ipd.count).toBe(1);
    expect(ipd.rows[0].estimated).toBeGreaterThan(0);
    expect(out.estimatedRecoverable).toBe(ipd.rows[0].estimated);
  });
});

describe('Finance charge and bill lifecycle', () => {
  it('creates a pending charge and audits charge.create', async () => {
    d.patient.findFirst.mockResolvedValue({ id: 'p1' });
    d.billableCharge.create.mockResolvedValue({ id: 'charge1', patientId: 'p1', total: 5000 });

    await svc.createCharge(ctx(d), {
      patientId: 'p1',
      sourceModule: 'OPD',
      sourceType: 'CONSULTATION',
      name: 'Consultation',
      quantity: 1,
      unitPrice: 5000,
    });

    expect(d.billableCharge.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 't1', total: 5000, sourceModule: 'OPD' }) }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'charge.create' }));
  });

  it('cancels only pending charges and requires an audit reason', async () => {
    d.billableCharge.findFirst.mockResolvedValue({ id: 'charge1', patientId: 'p1', status: 'PENDING' });
    d.billableCharge.update.mockResolvedValue({ id: 'charge1', status: 'CANCELLED' });

    await svc.cancelCharge(ctx(d), 'charge1', { reason: 'Duplicate service' });

    expect(d.billableCharge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED', cancellationReason: 'Duplicate service' } }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'charge.cancel' }));

    d.billableCharge.findFirst.mockResolvedValue({ id: 'charge2', status: 'BILLED' });
    await expect(svc.cancelCharge(ctx(d), 'charge2', { reason: 'Wrong' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a bill from selected charges and marks charges billed atomically', async () => {
    const charges = [
      {
        id: 'charge1',
        patientId: 'p1',
        encounterId: 'e1',
        admissionId: null,
        catalogId: 'cat1',
        sourceModule: 'OPD',
        sourceType: 'CONSULTATION',
        sourceId: 'e1',
        name: 'Consultation',
        quantity: 1,
        unitPrice: 5000,
        total: 5000,
        status: 'PENDING',
      },
    ];
    d.billableCharge.findMany.mockResolvedValue(charges);
    d.bill.count.mockResolvedValue(0);
    d.bill.findFirst.mockResolvedValue(null);
    tx.bill.create.mockResolvedValue({ id: 'bill1' });
    tx.billItem.create.mockResolvedValue({ id: 'item1' });

    await svc.billFromCharges(ctx(d), { chargeIds: ['charge1'], notes: 'OPD checkout' });

    expect(mockTenantTransaction).toHaveBeenCalledTimes(1);
    expect(tx.bill.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ patientId: 'p1', totalAmount: 5000 }) }));
    expect(tx.billableCharge.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'BILLED', billId: 'bill1', billItemId: 'item1' }) }));
    expect(billing.getById).toHaveBeenCalledWith(expect.anything(), 'bill1');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bill.from_charges' }));
  });

  it('does not allow mixed-patient charge billing', async () => {
    d.billableCharge.findMany.mockResolvedValue([
      { id: 'c1', patientId: 'p1', status: 'PENDING', total: 100 },
      { id: 'c2', patientId: 'p2', status: 'PENDING', total: 100 },
    ]);
    await expect(svc.billFromCharges(ctx(d), { chargeIds: ['c1', 'c2'] })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Finance collections, day close, and approvals', () => {
  it('lets reception/cashier collect payment without requiring Accountant role', async () => {
    await svc.addPayment(
      ctx(d, { roles: ['RECEPTION'], permissions: new Set([PERMISSIONS.FINANCE_CASHIER, PERMISSIONS.PAYMENT_COLLECT]) }),
      'bill1',
      { amount: 5000, method: 'CASH' },
    );
    expect(billing.addPayment).toHaveBeenCalledWith(expect.anything(), 'bill1', { amount: 5000, method: 'CASH' });
  });

  it('refund and bill cancellation write finance request/process audit entries', async () => {
    await svc.refund(ctx(d), 'bill1', { amount: 1000, reason: 'Patient overpaid' });
    await svc.cancelBill(ctx(d), 'bill1', { reason: 'Duplicate bill' });
    expect(billing.refund).toHaveBeenCalledWith(expect.anything(), 'bill1', 1000, 'Patient overpaid');
    expect(billing.cancel).toHaveBeenCalledWith(expect.anything(), 'bill1', 'Duplicate bill');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'refund.request' }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'refund.process' }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bill.cancel.request' }));
  });

  it('day close totals payments, refunds, cancellations, and net collection', async () => {
    d.payment.findMany.mockResolvedValue([
      { id: 'p1', amount: 10000, method: 'CASH' },
      { id: 'p2', amount: 5000, method: 'CARD' },
    ]);
    d.refund.findMany.mockResolvedValue([{ id: 'r1', amount: 2000 }]);
    d.bill.findMany.mockResolvedValue([{ id: 'b1', netAmount: 3000 }]);
    d.financeDayClose.findMany.mockResolvedValue([]);

    const out = await svc.dayClose(ctx(d), '2026-06-10');

    expect(out.grossCollection).toBe(15000);
    expect(out.refundTotal).toBe(2000);
    expect(out.cancellationTotal).toBe(3000);
    expect(out.netCollection).toBe(13000);
    expect(out.cashTotal).toBe(10000);
    expect(out.cardTotal).toBe(5000);
  });

  it('approval decisions require pending status and can reopen a day close', async () => {
    d.financeApproval.findFirst.mockResolvedValue({
      id: 'ap1',
      status: 'PENDING',
      type: 'DAY_CLOSE_REOPEN',
      entity: 'finance_day_close',
      entityId: 'close1',
    });
    d.financeApproval.update.mockResolvedValue({ id: 'ap1', status: 'APPROVED' });

    await svc.decideApproval(ctx(d), 'ap1', 'APPROVED', { reason: 'Cash mismatch corrected' });

    expect(d.financeApproval.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED' }) }));
    expect(d.financeDayClose.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'close1' }, data: expect.objectContaining({ status: 'REOPENED' }) }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'finance.day_close.reopen' }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'finance.approval.approve' }));
  });
});
