import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';

@Injectable()
export class FinanceGovernanceService {
  async requestApproval(ctx: RequestContext, data: { type: any; amount?: number; entity: string; entityId?: string; reason: string; notes?: string }) {
    const db = requireDb(ctx);
    return db.financeApproval.create({
      data: {
        tenantId: ctx.tenantId!,
        type: data.type,
        amount: data.amount,
        entity: data.entity,
        entityId: data.entityId,
        reason: data.reason,
        notes: data.notes,
        requestedById: ctx.userId!,
        status: 'PENDING',
      },
    });
  }

  async listPendingApprovals(ctx: RequestContext) {
    const db = requireDb(ctx);
    return db.financeApproval.findMany({
      where: { tenantId: ctx.tenantId!, status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async resolveApproval(ctx: RequestContext, id: string, status: 'APPROVED' | 'REJECTED', decisionReason?: string) {
    const db = requireDb(ctx);
    const approval = await db.financeApproval.findFirst({
      where: { id, tenantId: ctx.tenantId! }
    });

    if (!approval) throw new NotFoundException('Finance Approval not found');
    if (approval.status !== 'PENDING') throw new BadRequestException('Approval is already resolved');

    return db.financeApproval.update({
      where: { id },
      data: {
        status,
        decidedById: ctx.userId!,
        decidedAt: new Date(),
        decisionReason,
      },
    });
  }

  async checkThresholds(ctx: RequestContext, type: 'DISCOUNT' | 'REFUND', amount: number): Promise<{ requiresApproval: boolean; threshold: number }> {
    const db = requireDb(ctx);
    const settings = await db.hospitalSettings.findFirst({ where: { tenantId: ctx.tenantId! } });
    if (!settings) return { requiresApproval: false, threshold: 0 };

    if (type === 'DISCOUNT') {
      return { 
        requiresApproval: amount > settings.discountApprovalThreshold,
        threshold: settings.discountApprovalThreshold 
      };
    }
    if (type === 'REFUND') {
      return { 
        requiresApproval: amount > settings.refundApprovalThreshold,
        threshold: settings.refundApprovalThreshold 
      };
    }
    return { requiresApproval: false, threshold: 0 };
  }
}
