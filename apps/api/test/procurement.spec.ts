import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// Mock @hms/db so tenantTransaction runs against an in-memory tx mock.
let mockTx: Record<string, any>;
const mockTenantTransaction = jest.fn((_tid: string, fn: (tx: any) => any) => fn(mockTx));
jest.mock('@hms/db', () => ({ ...jest.requireActual('@hms/db'), tenantTransaction: mockTenantTransaction }));

import { SupplierService } from '../src/inventory/supplier.service';
import { PurchaseService } from '../src/inventory/purchase.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { CancelPurchaseDto } from '../src/inventory/dto';
import { AuditService } from '../src/common/audit.service';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
  };
}
function db(): Record<string, any> {
  return {
    supplier: model(),
    inventoryItem: model(),
    inventoryBatch: model(),
    inventoryTransaction: model(),
    purchaseOrder: model(),
    purchaseOrderItem: model(),
  };
}
function ctx(d: Record<string, any>): RequestContext {
  return { ...emptyContext(), userId: 'u1', tenantId: 't1', db: d as any };
}
function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}
const asAudit = (a: any) => a as unknown as AuditService;
const FUTURE = new Date(Date.now() + 365 * 86400000).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();

let d: Record<string, any>;
let audit: ReturnType<typeof mockAudit>;
beforeEach(() => {
  d = db();
  audit = mockAudit();
  mockTx = db();
  mockTenantTransaction.mockClear();
});

describe('SupplierService', () => {
  it('creates a supplier and audits inventory.supplier.create', async () => {
    d.supplier.findFirst.mockResolvedValue(null);
    d.supplier.create.mockResolvedValue({ id: 'sup1', name: 'MediCorp' });
    await new SupplierService(asAudit(audit)).create(ctx(d), { name: 'MediCorp' });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.supplier.create' }));
  });

  it('rejects a duplicate active supplier name', async () => {
    d.supplier.findFirst.mockResolvedValue({ id: 'dup' });
    await expect(new SupplierService(asAudit(audit)).create(ctx(d), { name: 'MediCorp' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('audits inventory.supplier.deactivate when active=false', async () => {
    d.supplier.findFirst.mockResolvedValueOnce({ id: 'sup1' }); // load
    d.supplier.update.mockResolvedValue({ id: 'sup1', active: false });
    await new SupplierService(asAudit(audit)).update(ctx(d), 'sup1', { active: false });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.supplier.deactivate' }));
  });
});

describe('PurchaseService', () => {
  function orderedPo(items: any[] = [{ id: 'poi1', itemId: 'i1', quantity: 50, unitCost: 100 }]) {
    d.purchaseOrder.findFirst.mockResolvedValue({ id: 'po1', supplierId: 'sup1', status: 'ORDERED', items });
  }

  it('creates a PO with items and audits inventory.purchase.create', async () => {
    d.supplier.findFirst.mockResolvedValue({ id: 'sup1' });
    d.inventoryItem.findFirst.mockResolvedValue({ id: 'i1' });
    d.purchaseOrder.create.mockResolvedValue({ id: 'po1', items: [] });
    await new PurchaseService(asAudit(audit)).create(ctx(d), { supplierId: 'sup1', items: [{ itemId: 'i1', quantity: 50, unitCost: 100 }] });
    expect(d.purchaseOrder.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.purchase.create' }));
  });

  it('receiving creates batches + STOCK_IN, marks RECEIVED, audits receive+stock_in', async () => {
    orderedPo();
    d.inventoryItem.findMany.mockResolvedValue([]); // for get() name resolution
    mockTx.inventoryBatch.create.mockResolvedValue({ id: 'batch1' });
    // get() at end:
    d.purchaseOrder.findFirst.mockResolvedValueOnce({ id: 'po1', supplierId: 'sup1', status: 'ORDERED', items: [{ id: 'poi1', itemId: 'i1', quantity: 50, unitCost: 100 }] });

    await new PurchaseService(asAudit(audit)).receive(ctx(d), 'po1', {
      lines: [{ purchaseOrderItemId: 'poi1', receivedQuantity: 50, batchNumber: 'B-1', expiryDate: FUTURE, salePrice: 150 }],
    });

    expect(mockTx.inventoryBatch.create).toHaveBeenCalled();
    expect(mockTx.inventoryTransaction.create.mock.calls[0][0].data.type).toBe('STOCK_IN');
    expect(mockTx.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'RECEIVED' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.purchase.receive' }));
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.stock_in' }));
  });

  it('rejects receiving an expired batch (no mutation)', async () => {
    orderedPo();
    await expect(
      new PurchaseService(asAudit(audit)).receive(ctx(d), 'po1', {
        lines: [{ purchaseOrderItemId: 'poi1', receivedQuantity: 50, batchNumber: 'B-1', expiryDate: PAST, salePrice: 150 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTenantTransaction).not.toHaveBeenCalled();
  });

  it('cannot receive an already-received PO', async () => {
    d.purchaseOrder.findFirst.mockResolvedValue({ id: 'po1', status: 'RECEIVED', items: [] });
    await expect(
      new PurchaseService(asAudit(audit)).receive(ctx(d), 'po1', { lines: [{ purchaseOrderItemId: 'x', receivedQuantity: 1, batchNumber: 'B', salePrice: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cannot cancel a received PO; cancels an ordered PO with audit', async () => {
    d.purchaseOrder.findFirst.mockResolvedValue({ id: 'po1', status: 'RECEIVED', items: [] });
    await expect(new PurchaseService(asAudit(audit)).cancel(ctx(d), 'po1', 'nope')).rejects.toBeInstanceOf(BadRequestException);

    d.purchaseOrder.findFirst.mockResolvedValue({ id: 'po1', status: 'ORDERED', items: [] });
    d.inventoryItem.findMany.mockResolvedValue([]);
    await new PurchaseService(asAudit(audit)).cancel(ctx(d), 'po1', 'Vendor delay');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.purchase.cancel' }));
  });
});

describe('InventoryService item SKU + deactivate', () => {
  it('rejects a duplicate SKU on create', async () => {
    d.inventoryItem.findFirst.mockResolvedValue({ id: 'dup' });
    await expect(new InventoryService(asAudit(audit)).createItem(ctx(d), { name: 'Saline', sku: 'SAL-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('audits inventory.item.deactivate when active=false', async () => {
    d.inventoryItem.findFirst.mockResolvedValue({ id: 'it1' });
    d.inventoryItem.update.mockResolvedValue({ id: 'it1', active: false });
    await new InventoryService(asAudit(audit)).updateItem(ctx(d), 'it1', { active: false });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'inventory.item.deactivate' }));
  });
});

describe('reason enforcement (DTO)', () => {
  it('requires a reason to cancel a purchase order', async () => {
    expect((await validate(plainToInstance(CancelPurchaseDto, { reason: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CancelPurchaseDto, { reason: 'ok' }))).length).toBe(0);
  });
});
