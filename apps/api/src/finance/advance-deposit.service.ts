import { Injectable, NotFoundException } from '@nestjs/common';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';

@Injectable()
export class AdvanceDepositService {
  async collectDeposit(ctx: RequestContext, data: { patientId: string; admissionId?: string; amount: number; paymentMethod: any; transactionId?: string; notes?: string }) {
    const db = requireDb(ctx);
    return db.advanceDeposit.create({
      data: {
        tenantId: ctx.tenantId!,
        patientId: data.patientId,
        admissionId: data.admissionId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        notes: data.notes,
        collectedById: ctx.userId!,
        status: 'COLLECTED',
      },
    });
  }

  async findByPatient(ctx: RequestContext, patientId: string) {
    const db = requireDb(ctx);
    return db.advanceDeposit.findMany({
      where: { tenantId: ctx.tenantId!, patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async consumeDeposit(ctx: RequestContext, id: string, amount: number) {
    const db = requireDb(ctx);
    return db.advanceDeposit.update({
      where: { id, tenantId: ctx.tenantId! },
      data: {
        status: 'CONSUMED',
      },
    });
  }

  async refundDeposit(ctx: RequestContext, id: string, notes?: string) {
    const db = requireDb(ctx);
    return db.advanceDeposit.update({
      where: { id, tenantId: ctx.tenantId! },
      data: {
        status: 'REFUNDED',
        notes,
      },
    });
  }
}
