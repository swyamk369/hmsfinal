import { Injectable, NotFoundException } from '@nestjs/common';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';

@Injectable()
export class ServicePackageService {
  async create(ctx: RequestContext, data: { code: string; name: string; description?: string; fixedPrice: number; active?: boolean }) {
    const db = requireDb(ctx);
    return db.servicePackage.create({
      data: {
        tenantId: ctx.tenantId!,
        ...data,
      },
    });
  }

  async findAll(ctx: RequestContext) {
    const db = requireDb(ctx);
    return db.servicePackage.findMany({
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
    const pkg = await db.servicePackage.findUnique({
      where: { id, tenantId: ctx.tenantId! },
      include: {
        items: {
          include: {
            catalog: true,
          },
        },
      },
    });
    if (!pkg) throw new NotFoundException('Service package not found');
    return pkg;
  }

  async update(ctx: RequestContext, id: string, data: { name?: string; description?: string; fixedPrice?: number; active?: boolean }) {
    const db = requireDb(ctx);
    return db.servicePackage.update({
      where: { id, tenantId: ctx.tenantId! },
      data,
    });
  }

  async setItem(ctx: RequestContext, packageId: string, data: { catalogId: string }) {
    const db = requireDb(ctx);
    await this.findOne(ctx, packageId);
    
    return db.servicePackageItem.upsert({
      where: {
        tenantId_packageId_catalogId: {
          tenantId: ctx.tenantId!,
          packageId,
          catalogId: data.catalogId,
        },
      },
      create: {
        tenantId: ctx.tenantId!,
        packageId,
        catalogId: data.catalogId,
      },
      update: {},
    });
  }

  async deleteItem(ctx: RequestContext, packageId: string, catalogId: string) {
    const db = requireDb(ctx);
    return db.servicePackageItem.delete({
      where: {
        tenantId_packageId_catalogId: {
          tenantId: ctx.tenantId!,
          packageId,
          catalogId,
        },
      },
    });
  }
}
