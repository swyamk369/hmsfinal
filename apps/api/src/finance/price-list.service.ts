import { Injectable, NotFoundException } from '@nestjs/common';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';

@Injectable()
export class PriceListService {
  async create(ctx: RequestContext, data: { name: string; description?: string; active?: boolean }) {
    const db = requireDb(ctx);
    return db.priceList.create({
      data: {
        tenantId: ctx.tenantId!,
        ...data,
      },
    });
  }

  async findAll(ctx: RequestContext) {
    const db = requireDb(ctx);
    return db.priceList.findMany({
      where: { tenantId: ctx.tenantId! },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  }

  async findOne(ctx: RequestContext, id: string) {
    const db = requireDb(ctx);
    const list = await db.priceList.findUnique({
      where: { id, tenantId: ctx.tenantId! },
      include: {
        items: {
          include: {
            catalogItem: true,
          },
        },
      },
    });
    if (!list) throw new NotFoundException('Price list not found');
    return list;
  }

  async update(ctx: RequestContext, id: string, data: { name?: string; description?: string; active?: boolean }) {
    const db = requireDb(ctx);
    return db.priceList.update({
      where: { id, tenantId: ctx.tenantId! },
      data,
    });
  }

  async setItem(ctx: RequestContext, priceListId: string, data: { catalogId: string; price: number }) {
    const db = requireDb(ctx);
    await this.findOne(ctx, priceListId);
    
    return db.priceListItem.upsert({
      where: {
        tenantId_priceListId_catalogId: {
          tenantId: ctx.tenantId!,
          priceListId,
          catalogId: data.catalogId,
        },
      },
      create: {
        tenantId: ctx.tenantId!,
        priceListId,
        catalogId: data.catalogId,
        price: data.price,
      },
      update: {
        price: data.price,
      },
    });
  }

  async deleteItem(ctx: RequestContext, priceListId: string, catalogId: string) {
    const db = requireDb(ctx);
    return db.priceListItem.delete({
      where: {
        tenantId_priceListId_catalogId: {
          tenantId: ctx.tenantId!,
          priceListId,
          catalogId,
        },
      },
    });
  }
}
