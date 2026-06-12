import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { AdvanceDepositService } from './advance-deposit.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/advance-deposits')
export class AdvanceDepositController {
  constructor(private readonly advanceDepositService: AdvanceDepositService) {}

  @Post()
  @RequirePermission('MANAGE_FINANCE')
  collect(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.advanceDepositService.collectDeposit(ctx, body);
  }

  @Get()
  @RequirePermission('VIEW_FINANCE')
  findByPatient(@Ctx() ctx: RequestContext, @Query('patientId') patientId: string) {
    return this.advanceDepositService.findByPatient(ctx, patientId);
  }

  @Post(':id/consume')
  @RequirePermission('MANAGE_FINANCE')
  consume(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.advanceDepositService.consumeDeposit(ctx, id, body.amount);
  }

  @Post(':id/refund')
  @RequirePermission('MANAGE_FINANCE')
  refund(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.advanceDepositService.refundDeposit(ctx, id, body.remarks);
  }
}
