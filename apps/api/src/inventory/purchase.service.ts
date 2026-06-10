import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { tenantTransaction } from '@hms/db';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePurchaseDto, ReceiveDto, UpdatePurchaseDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const SUPPLIER_SELECT = { select: { id: true, name: true, contact: true } };

function totals(items: { quantity: number; unitCost: number }[]) {
  return {
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    totalValue: items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
  };
}

@Injectable()
export class PurchaseService {
  constructor(private readonly audit: AuditService, private readonly notifications?: NotificationsService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  /** Attaches inventory item names (no Prisma relation on PurchaseOrderItem). */
  private async withItemNames(db: TenantClient, items: { itemId: string }[]) {
    const ids = [...new Set(items.map((i) => i.itemId))];
    const inv = await db.inventoryItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, unit: true, sku: true },
    });
    const byId = new Map(inv.map((i) => [i.id, i]));
    return (i: any) => byId.get(i.itemId) ?? null;
  }

  async list(ctx: RequestContext, filters: { status?: string; supplierId?: string }) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.supplierId) where.supplierId = filters.supplierId;
    const orders = await db.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { supplier: SUPPLIER_SELECT, items: true },
    });
    return orders.map((o) => ({ ...o, ...totals(o.items) }));
  }

  async get(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    const order = await db.purchaseOrder.findFirst({
      where: { id },
      include: { supplier: SUPPLIER_SELECT, items: true },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    const nameOf = await this.withItemNames(db, order.items);
    return { ...order, ...totals(order.items), items: order.items.map((i) => ({ ...i, item: nameOf(i) })) };
  }

  async create(ctx: RequestContext, dto: CreatePurchaseDto) {
    const s = this.scope(ctx);
    const supplier = await s.db.supplier.findFirst({
      where: { id: dto.supplierId, active: true },
      select: { id: true },
    });
    if (!supplier) throw new BadRequestException('Supplier not found or inactive');
    for (const line of dto.items) {
      const item = await s.db.inventoryItem.findFirst({ where: { id: line.itemId }, select: { id: true } });
      if (!item) throw new BadRequestException(`Inventory item ${line.itemId} not found`);
    }
    const order = await s.db.purchaseOrder.create({
      data: {
        tenantId: s.tenantId,
        supplierId: dto.supplierId,
        invoiceRef: dto.invoiceRef,
        status: (dto.status ?? 'ORDERED') as any,
        items: {
          create: dto.items.map((l) => ({
            tenantId: s.tenantId,
            itemId: l.itemId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        },
      },
      include: { items: true, supplier: SUPPLIER_SELECT },
    });
    await this.record(s, 'inventory.purchase.create', 'purchase_order', order.id, {
      supplierId: dto.supplierId,
      lines: dto.items.length,
    });
    return order;
  }

  private async load(s: Scope, id: string) {
    const order = await s.db.purchaseOrder.findFirst({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async update(ctx: RequestContext, id: string, dto: UpdatePurchaseDto) {
    const s = this.scope(ctx);
    const order = await this.load(s, id);
    if (['RECEIVED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException(`Cannot edit a ${order.status.toLowerCase()} purchase order`);
    }
    if (dto.items) {
      await s.db.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await s.db.purchaseOrderItem.createMany({
        data: dto.items.map((l) => ({
          tenantId: s.tenantId,
          purchaseOrderId: id,
          itemId: l.itemId,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      });
    }
    await s.db.purchaseOrder.update({ where: { id }, data: { invoiceRef: dto.invoiceRef, status: dto.status as any } });
    await this.record(s, 'inventory.purchase.update', 'purchase_order', id, {
      changes: { invoiceRef: dto.invoiceRef, status: dto.status, lines: dto.items?.length },
    });
    return this.get(ctx, id);
  }

  async cancel(ctx: RequestContext, id: string, reason: string) {
    const s = this.scope(ctx);
    const order = await this.load(s, id);
    if (order.status === 'RECEIVED') throw new BadRequestException('Cannot cancel a received purchase order');
    if (order.status === 'CANCELLED') throw new BadRequestException('Purchase order is already cancelled');
    await s.db.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await this.record(s, 'inventory.purchase.cancel', 'purchase_order', id, { reason });
    return this.get(ctx, id);
  }

  async receive(ctx: RequestContext, id: string, dto: ReceiveDto) {
    const s = this.scope(ctx);
    const order = await this.load(s, id);
    if (['RECEIVED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestException(`Cannot receive a ${order.status.toLowerCase()} purchase order`);
    }
    const now = new Date();
    // Validate up-front (no mutation on failure).
    const plan = dto.lines
      .filter((l) => l.receivedQuantity > 0)
      .map((l) => {
        const poItem = order.items.find((i) => i.id === l.purchaseOrderItemId);
        if (!poItem) throw new BadRequestException('Receiving line does not belong to this purchase order');
        if (l.expiryDate && new Date(l.expiryDate) < now) {
          throw new BadRequestException(`Cannot receive expired batch ${l.batchNumber}`);
        }
        return { line: l, poItem };
      });
    if (plan.length === 0) throw new BadRequestException('No received quantities provided');

    await tenantTransaction(s.tenantId, async (tx) => {
      for (const { line, poItem } of plan) {
        const batch = await tx.inventoryBatch.create({
          data: {
            tenantId: s.tenantId,
            itemId: poItem.itemId,
            supplierId: order.supplierId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            quantity: line.receivedQuantity,
            unitCost: poItem.unitCost,
            salePrice: line.salePrice,
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            tenantId: s.tenantId,
            itemId: poItem.itemId,
            batchId: batch.id,
            type: 'STOCK_IN',
            quantity: line.receivedQuantity,
            reason: `GRN ${id}`,
            actorId: s.actorId,
          },
        });
        await tx.purchaseOrderItem.update({ where: { id: poItem.id }, data: { batchId: batch.id } });
      }
      await tx.purchaseOrder.update({ where: { id }, data: { status: 'RECEIVED' } });
    });

    await this.record(s, 'inventory.purchase.receive', 'purchase_order', id, { lines: plan.length });
    await this.record(s, 'inventory.stock_in', 'purchase_order', id, { source: 'grn', lines: plan.length });
    await this.notifications?.safeNotify(ctx, {
      category: 'INVENTORY',
      type: 'purchase.received',
      severity: 'SUCCESS',
      title: 'Purchase order received',
      message: 'A purchase order has been received and stock was updated.',
      actionUrl: `/inventory/purchases/${id}`,
      metadata: { purchaseOrderId: id, lines: plan.length },
      roleCodes: ['INVENTORY_MGR', 'HOSPITAL_ADMIN'],
    });
    return this.get(ctx, id);
  }
}
