import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction } from '@hms/db';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { AdjustStockDto, CreateItemDto, StockInDto, UpdateItemDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

interface BatchLike {
  quantity: number;
  expiryDate: Date | string | null;
}

const EXPIRY_WINDOW_DAYS = 30;

/** Total stock + earliest expiry + a status label for an item's batches. */
export function stockStatus(batches: BatchLike[], lowStockThreshold: number) {
  const totalStock = batches.reduce((s, b) => s + b.quantity, 0);
  const withQty = batches.filter((b) => b.quantity > 0 && b.expiryDate);
  const earliestExpiry = withQty.length
    ? withQty
        .map((b) => new Date(b.expiryDate as any))
        .sort((a, b) => a.getTime() - b.getTime())[0]
        .toISOString()
    : null;
  const status = totalStock === 0 ? 'OUT' : totalStock <= lowStockThreshold ? 'LOW' : 'OPTIMAL';
  return { totalStock, earliestExpiry, status };
}

@Injectable()
export class InventoryService {
  constructor(private readonly audit: AuditService, private readonly notifications?: NotificationsService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private async notifyStockRisk(ctx: RequestContext, s: Scope, itemId: string, batchId?: string | null) {
    const item = await s.db.inventoryItem.findFirst({ where: { id: itemId }, include: { batches: true } });
    if (!item) return;
    const batches = item.batches ?? [];
    const status = stockStatus(batches, item.lowStockThreshold);
    if (status.status !== 'OPTIMAL') {
      await this.notifications?.safeNotify(ctx, {
        category: 'INVENTORY',
        type: 'inventory.low_stock',
        severity: status.status === 'OUT' ? 'CRITICAL' : 'WARNING',
        title: status.status === 'OUT' ? 'Inventory item out of stock' : 'Low-stock inventory item',
        message: 'An inventory item needs replenishment review.',
        actionUrl: `/inventory/items?itemId=${item.id}`,
        metadata: { itemId: item.id, totalStock: status.totalStock, threshold: item.lowStockThreshold },
        roleCodes: ['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN'],
      });
    }
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      const horizon = new Date(Date.now() + EXPIRY_WINDOW_DAYS * 86400000);
      if (batch?.expiryDate && batch.quantity > 0 && new Date(batch.expiryDate) <= horizon) {
        await this.notifications?.safeNotify(ctx, {
          category: 'INVENTORY',
          type: 'inventory.batch_expiring',
          severity: new Date(batch.expiryDate) < new Date() ? 'CRITICAL' : 'WARNING',
          title: 'Inventory batch nearing expiry',
          message: 'A stock batch is expired or nearing expiry and needs review.',
          actionUrl: '/inventory/transactions',
          metadata: { itemId: item.id, batchId: batch.id, expiryDate: batch.expiryDate },
          roleCodes: ['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN'],
        });
      }
    }
  }

  // ── Items ─────────────────────────────────────────────────────
  async listItems(ctx: RequestContext, q?: string) {
    const { db } = this.scope(ctx);
    const items = await db.inventoryItem.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      include: { batches: { orderBy: { expiryDate: 'asc' } } },
      take: 300,
    });
    return items.map((it) => ({ ...it, ...stockStatus(it.batches, it.lowStockThreshold) }));
  }

  async createItem(ctx: RequestContext, dto: CreateItemDto) {
    const s = this.scope(ctx);
    if (dto.sku) await this.assertSkuFree(s, dto.sku);
    const item = await s.db.inventoryItem.create({
      data: {
        tenantId: s.tenantId,
        name: dto.name,
        type: (dto.type ?? 'DRUG') as any,
        unit: dto.unit ?? 'unit',
        sku: dto.sku,
        lowStockThreshold: dto.lowStockThreshold ?? 10,
      },
    });
    await this.record(s, 'inventory.item.create', 'inventory_item', item.id, { name: item.name });
    return item;
  }

  private async assertSkuFree(s: Scope, sku: string, excludeId?: string) {
    const dup = await s.db.inventoryItem.findFirst({
      where: { sku: { equals: sku, mode: 'insensitive' }, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (dup) throw new ConflictException('An item with that SKU already exists');
  }

  async getItem(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    const item = await db.inventoryItem.findFirst({
      where: { id },
      include: { batches: { orderBy: { expiryDate: 'asc' } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    return { ...item, ...stockStatus(item.batches, item.lowStockThreshold) };
  }

  async updateItem(ctx: RequestContext, id: string, dto: UpdateItemDto) {
    const s = this.scope(ctx);
    const existing = await s.db.inventoryItem.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Item not found');
    if (dto.sku) await this.assertSkuFree(s, dto.sku, id);
    const item = await s.db.inventoryItem.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type as any,
        unit: dto.unit,
        sku: dto.sku,
        lowStockThreshold: dto.lowStockThreshold,
        active: dto.active,
      },
    });
    const action = dto.active === false ? 'inventory.item.deactivate' : 'inventory.item.update';
    await this.record(s, action, 'inventory_item', id, { changes: dto });
    return item;
  }

  async stats(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const horizon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86400000);
    const [items, pendingPurchases, movementsToday, expiringBatches] = await Promise.all([
      db.inventoryItem.findMany({
        where: { active: true },
        include: { batches: { select: { quantity: true, salePrice: true } } },
      }),
      db.purchaseOrder.count({ where: { status: { in: ['DRAFT', 'ORDERED'] } } }),
      db.inventoryTransaction.count({ where: { createdAt: { gte: startOfDay } } }),
      db.inventoryBatch.count({ where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: horizon } } }),
    ]);
    let stockValue = 0;
    let lowStockCount = 0;
    for (const it of items) {
      const total = it.batches.reduce((a, b) => a + b.quantity, 0);
      stockValue += it.batches.reduce((a, b) => a + b.quantity * b.salePrice, 0);
      if (total <= it.lowStockThreshold) lowStockCount++;
    }
    return { itemCount: items.length, stockValue, lowStockCount, expiringBatches, pendingPurchases, movementsToday };
  }

  // ── Batches / stock-in ────────────────────────────────────────
  listBatches(ctx: RequestContext, itemId?: string) {
    const { db } = this.scope(ctx);
    return db.inventoryBatch.findMany({
      where: itemId ? { itemId } : {},
      orderBy: { expiryDate: 'asc' },
      include: { item: { select: { name: true, unit: true } }, supplier: { select: { name: true } } },
      take: 300,
    });
  }

  async stockIn(ctx: RequestContext, dto: StockInDto) {
    const s = this.scope(ctx);
    const item = await s.db.inventoryItem.findFirst({ where: { id: dto.itemId }, select: { id: true } });
    if (!item) throw new BadRequestException('Item not found');

    const batch = await tenantTransaction(s.tenantId, async (tx) => {
      const created = await tx.inventoryBatch.create({
        data: {
          tenantId: s.tenantId,
          itemId: dto.itemId,
          supplierId: dto.supplierId,
          batchNumber: dto.batchNumber,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          quantity: dto.quantity,
          unitCost: dto.unitCost ?? 0,
          salePrice: dto.salePrice,
        },
      });
      await tx.inventoryTransaction.create({
        data: {
          tenantId: s.tenantId,
          itemId: dto.itemId,
          batchId: created.id,
          type: 'STOCK_IN',
          quantity: dto.quantity,
          reason: `Stock-in batch ${dto.batchNumber}`,
          actorId: s.actorId,
        },
      });
      return created;
    });

    await this.record(s, 'inventory.stock_in', 'inventory_batch', batch.id, {
      itemId: dto.itemId,
      quantity: dto.quantity,
      batchNumber: dto.batchNumber,
    });
    await this.notifyStockRisk(ctx, s, dto.itemId, batch.id);
    return batch;
  }

  async adjust(ctx: RequestContext, dto: AdjustStockDto) {
    const s = this.scope(ctx);
    const batch = await s.db.inventoryBatch.findFirst({ where: { id: dto.batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    const newQty = batch.quantity + dto.delta;
    if (newQty < 0) throw new BadRequestException('Adjustment would drive stock negative');

    await tenantTransaction(s.tenantId, async (tx) => {
      await tx.inventoryBatch.update({ where: { id: dto.batchId }, data: { quantity: newQty } });
      await tx.inventoryTransaction.create({
        data: {
          tenantId: s.tenantId,
          itemId: batch.itemId,
          batchId: batch.id,
          type: 'ADJUSTMENT',
          quantity: dto.delta,
          reason: dto.reason,
          actorId: s.actorId,
        },
      });
    });

    await this.record(s, 'inventory.adjust', 'inventory_batch', batch.id, { delta: dto.delta, reason: dto.reason });
    await this.notifyStockRisk(ctx, s, batch.itemId, batch.id);
    return { id: batch.id, quantity: newQty };
  }

  // ── Alerts + ledger ───────────────────────────────────────────
  async alerts(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const items = await db.inventoryItem.findMany({
      where: { active: true },
      include: { batches: true },
    });
    const lowStock = items
      .map((it) => ({
        id: it.id,
        name: it.name,
        ...stockStatus(it.batches, it.lowStockThreshold),
        threshold: it.lowStockThreshold,
      }))
      .filter((it) => it.status !== 'OPTIMAL');

    const now = new Date();
    const horizon = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 86400000);
    const expiring = await db.inventoryBatch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { not: null, lte: horizon } },
      orderBy: { expiryDate: 'asc' },
      include: { item: { select: { name: true } } },
      take: 100,
    });
    const expiringBatches = expiring.map((b) => ({
      id: b.id,
      itemName: b.item.name,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantity: b.quantity,
      expired: b.expiryDate ? new Date(b.expiryDate) < now : false,
    }));

    return { lowStock, expiringBatches };
  }

  transactions(ctx: RequestContext, filters: { itemId?: string; batchId?: string; type?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.itemId) where.itemId = filters.itemId;
    if (filters.batchId) where.batchId = filters.batchId;
    if (filters.type) where.type = filters.type;
    return db.inventoryTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
  }
}
