import { Injectable, NotFoundException } from '@nestjs/common';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';

@Injectable()
export class CostEstimateService {
  async createEstimate(
    ctx: RequestContext,
    data: { patientId: string; notes?: string; validUntil?: Date; items: any[] },
  ) {
    const db = requireDb(ctx);
    let totalAmount = 0;
    let totalTax = 0;

    data.items.forEach((i) => {
      i.total = i.quantity * i.unitPrice;
      totalAmount += i.total;
      totalTax += Math.round((i.total * i.taxRate) / 10000); // taxRate is in basis points
    });

    const netAmount = totalAmount + totalTax;

    return db.costEstimate.create({
      data: {
        tenantId: ctx.tenantId!,
        patientId: data.patientId,
        notes: data.notes,
        validUntil: data.validUntil,
        status: 'DRAFT',
        totalAmount,
        totalTax,
        netAmount,
        createdById: ctx.userId,
        items: {
          create: data.items.map((i) => ({
            tenantId: ctx.tenantId!,
            catalogId: i.catalogId,
            packageId: i.packageId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            total: i.total,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async listEstimates(ctx: RequestContext, patientId?: string) {
    const db = requireDb(ctx);
    return db.costEstimate.findMany({
      where: {
        tenantId: ctx.tenantId!,
        ...(patientId ? { patientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { patient: true },
    });
  }

  async getEstimate(ctx: RequestContext, id: string) {
    const db = requireDb(ctx);
    const estimate = await db.costEstimate.findFirst({
      where: { id, tenantId: ctx.tenantId! },
      include: { items: true, patient: true },
    });
    if (!estimate) throw new NotFoundException('Cost Estimate not found');
    return estimate;
  }

  async updateStatus(ctx: RequestContext, id: string, status: 'ISSUED' | 'EXPIRED' | 'CONVERTED' | 'CANCELLED') {
    const db = requireDb(ctx);
    return db.costEstimate.update({
      where: { id, tenantId: ctx.tenantId! },
      data: { status },
    });
  }
}
