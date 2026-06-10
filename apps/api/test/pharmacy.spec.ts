import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// Mock @hms/db so tenantTransaction runs synchronously against an in-memory tx mock.
let mockTx: Record<string, any>;
const mockTenantTransaction = jest.fn((_tid: string, fn: (tx: any) => any) => fn(mockTx));
jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), tenantTransaction: mockTenantTransaction }));

import { PharmacyService, fefoAllocate, isExpired } from '../src/pharmacy/pharmacy.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { ReturnDto } from '../src/pharmacy/dto';
import { AdjustStockDto } from '../src/inventory/dto';
import { AuditService } from '../src/common/audit.service';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}
function db(): Record<string, any> {
  return {
    prescription: model(),
    inventoryItem: model(),
    inventoryBatch: model(),
    inventoryTransaction: model(),
    dispenseRecord: model(),
    dispenseItem: model(),
    bill: model(),
    billItem: model(),
    patient: model(),
    hospitalSettings: model(),
  };
}
function ctx(d: Record<string, any>): RequestContext {
  return { ...emptyContext(), userId: 'u1', tenantId: 't1', db: d as any };
}
function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}
const asAudit = (a: any) => a as unknown as AuditService;

const FUTURE = new Date(Date.now() + 365 * 86400000);
const PAST = new Date(Date.now() - 86400000);

let d: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
beforeEach(() => {
  d = db();
  audit = mockAudit();
  mockTx = db();
  mockTenantTransaction.mockClear();
  d.hospitalSettings.findUnique.mockResolvedValue({ invoicePrefix: 'INV', mrnPrefix: 'MRN' });
});

describe('FEFO allocation', () => {
  it('consumes earliest-expiry batches first and excludes expired ones', () => {
    const now = new Date();
    const batches = [
      { id: 'late', quantity: 100, expiryDate: new Date(Date.now() + 200 * 86400000), salePrice: 10 },
      { id: 'soon', quantity: 20, expiryDate: new Date(Date.now() + 10 * 86400000), salePrice: 10 },
      { id: 'expired', quantity: 999, expiryDate: PAST, salePrice: 10 },
    ];
    const { allocations, remaining } = fefoAllocate(batches, 30, now);
    expect(remaining).toBe(0);
    expect(allocations[0]).toMatchObject({ batchId: 'soon', quantity: 20 });
    expect(allocations[1]).toMatchObject({ batchId: 'late', quantity: 10 });
    expect(allocations.find((a) => a.batchId === 'expired')).toBeUndefined();
  });

  it('reports a shortfall when stock is insufficient', () => {
    const { remaining } = fefoAllocate([{ id: 'b', quantity: 5, expiryDate: FUTURE, salePrice: 1 }], 20);
    expect(remaining).toBe(15);
  });

  it('isExpired flags past-dated batches only', () => {
    expect(isExpired(PAST)).toBe(true);
    expect(isExpired(FUTURE)).toBe(false);
    expect(isExpired(null)).toBe(false);
  });
});

describe('PharmacyService.dispense', () => {
  function finalizedRx() {
    d.prescription.findFirst.mockResolvedValue({ id: 'rx1', status: 'FINALIZED', encounterId: 'enc1', encounter: { patientId: 'pat1' } });
  }

  it('rejects an already-dispensed prescription without touching stock', async () => {
    d.prescription.findFirst.mockResolvedValue({ id: 'rx1', status: 'DISPENSED', encounter: { patientId: 'p1' } });
    await expect(
      new PharmacyService(asAudit(audit)).dispense(ctx(d), 'rx1', { items: [{ inventoryItemId: 'i1', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTenantTransaction).not.toHaveBeenCalled();
  });

  it('fails cleanly on insufficient stock with no mutation', async () => {
    finalizedRx();
    d.inventoryItem.findFirst.mockResolvedValue({ id: 'i1', name: 'Amox', unit: 'tab', batches: [{ id: 'b1', quantity: 5, expiryDate: FUTURE, salePrice: 100 }] });
    await expect(
      new PharmacyService(asAudit(audit)).dispense(ctx(d), 'rx1', { items: [{ inventoryItemId: 'i1', quantity: 30 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTenantTransaction).not.toHaveBeenCalled();
  });

  it('dispenses FEFO, deducts stock, bills, marks prescription DISPENSED and audits', async () => {
    finalizedRx();
    d.inventoryItem.findFirst.mockResolvedValue({ id: 'i1', name: 'Amox', unit: 'tab', batches: [{ id: 'b1', quantity: 100, expiryDate: FUTURE, salePrice: 500 }] });
    d.bill.findFirst.mockResolvedValue(null);
    mockTx.dispenseRecord.create.mockResolvedValue({ id: 'disp1' });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({ id: 'b1', itemId: 'i1', quantity: 100 });
    mockTx.bill.create.mockResolvedValue({ id: 'bill1' });
    d.dispenseRecord.findFirst.mockResolvedValue({ id: 'disp1', items: [], patientId: 'pat1' });
    d.patient.findFirst.mockResolvedValue({ id: 'pat1', fullName: 'Jane', mrn: 'MRN-1' });

    await new PharmacyService(asAudit(audit)).dispense(ctx(d), 'rx1', { items: [{ inventoryItemId: 'i1', quantity: 30 }] });

    expect(mockTenantTransaction).toHaveBeenCalledTimes(1);
    expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: 70 } }));
    expect(mockTx.inventoryTransaction.create.mock.calls[0][0].data.type).toBe('DISPENSE');
    expect(mockTx.dispenseItem.create).toHaveBeenCalled();
    expect(mockTx.bill.create).toHaveBeenCalled();
    expect(mockTx.bill.create.mock.calls[0][0].data.netAmount).toBe(15000);
    expect(mockTx.prescription.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'DISPENSED' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'pharmacy.dispense' }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'bill.create' }));
  });
});

describe('PharmacyService.returns', () => {
  it('restocks batches, writes a RETURN transaction and audits pharmacy.return', async () => {
    d.dispenseRecord.findFirst.mockResolvedValue({
      id: 'disp1',
      status: 'DISPENSED',
      items: [{ id: 'di1', batchId: 'b1', inventoryItemId: 'i1', quantity: 10 }],
    });
    mockTx.inventoryBatch.findFirst.mockResolvedValue({ id: 'b1', quantity: 5 });
    d.patient.findFirst.mockResolvedValue({ id: 'pat1' });

    await new PharmacyService(asAudit(audit)).returns(ctx(d), { dispenseRecordId: 'disp1', reason: 'Wrong drug' });

    expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: 15 } }));
    expect(mockTx.inventoryTransaction.create.mock.calls[0][0].data.type).toBe('RETURN');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'pharmacy.return' }));
  });
});

describe('InventoryService', () => {
  it('creates an item and audits inventory.item.create', async () => {
    d.inventoryItem.create.mockResolvedValue({ id: 'it1', name: 'Saline' });
    await new InventoryService(asAudit(audit)).createItem(ctx(d), { name: 'Saline' });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.item.create' }));
  });

  it('stock-in writes a batch + STOCK_IN transaction and audits inventory.stock_in', async () => {
    d.inventoryItem.findFirst.mockResolvedValue({ id: 'it1' });
    mockTx.inventoryBatch.create.mockResolvedValue({ id: 'bat1' });
    await new InventoryService(asAudit(audit)).stockIn(ctx(d), { itemId: 'it1', batchNumber: 'B1', quantity: 50, salePrice: 100 });
    expect(mockTx.inventoryTransaction.create.mock.calls[0][0].data.type).toBe('STOCK_IN');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.stock_in' }));
  });

  it('rejects an adjustment that would drive stock negative (no mutation)', async () => {
    d.inventoryBatch.findFirst.mockResolvedValue({ id: 'b1', itemId: 'i1', quantity: 5 });
    await expect(
      new InventoryService(asAudit(audit)).adjust(ctx(d), { batchId: 'b1', delta: -10, reason: 'audit' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTenantTransaction).not.toHaveBeenCalled();
  });

  it('applies a valid adjustment with an ADJUSTMENT transaction and audits inventory.adjust', async () => {
    d.inventoryBatch.findFirst.mockResolvedValue({ id: 'b1', itemId: 'i1', quantity: 20 });
    await new InventoryService(asAudit(audit)).adjust(ctx(d), { batchId: 'b1', delta: -5, reason: 'spoilage' });
    expect(mockTx.inventoryBatch.update).toHaveBeenCalledWith(expect.objectContaining({ data: { quantity: 15 } }));
    expect(mockTx.inventoryTransaction.create.mock.calls[0][0].data.type).toBe('ADJUSTMENT');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.adjust' }));
  });
});

describe('reason enforcement (DTOs)', () => {
  it('requires a reason on return and adjustment', async () => {
    expect((await validate(plainToInstance(ReturnDto, { dispenseRecordId: '11111111-1111-4111-8111-111111111111', reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(AdjustStockDto, { batchId: '11111111-1111-4111-8111-111111111111', delta: -1, reason: '' }))).length).toBeGreaterThan(0);
    expect(
      (await validate(plainToInstance(AdjustStockDto, { batchId: '11111111-1111-4111-8111-111111111111', delta: -1, reason: 'ok' }))).length,
    ).toBe(0);
  });
});
