import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { AdvanceDepositService } from './advance-deposit.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/advance-deposits')
@RequireModule(MODULES.BILLING)
export class AdvanceDepositController {
  constructor(private readonly advanceDepositService: AdvanceDepositService) {}

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_CASHIER, PERMISSIONS.PAYMENT_COLLECT, PERMISSIONS.BILL_WRITE)
  collect(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.advanceDepositService.collectDeposit(ctx, body);
  }

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_PATIENT_ACCOUNT_READ, PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ)
  findByPatient(@Ctx() ctx: RequestContext, @Query('patientId') patientId: string) {
    return this.advanceDepositService.findByPatient(ctx, patientId);
  }

  @Post(':id/consume')
  @RequirePermission(PERMISSIONS.FINANCE_CASHIER, PERMISSIONS.PAYMENT_COLLECT, PERMISSIONS.BILL_WRITE)
  consume(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.advanceDepositService.consumeDeposit(ctx, id, body.amount);
  }

  @Post(':id/refund')
  @RequirePermission(PERMISSIONS.PAYMENT_REFUND, PERMISSIONS.FINANCE_RECONCILE)
  refund(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.advanceDepositService.refundDeposit(ctx, id, body.remarks);
  }
}
