import { Controller, Get, Post, Body, Param, Put, Query } from '@nestjs/common';
import { FinanceGovernanceService } from './finance-governance.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/governance')
export class FinanceGovernanceController {
  constructor(private readonly svc: FinanceGovernanceService) {}

  @Post('requests')
  @RequirePermission('MANAGE_FINANCE')
  requestApproval(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.svc.requestApproval(ctx, body);
  }

  @Get('requests/pending')
  @RequirePermission('MANAGE_HOSPITAL') // usually managers or admins do approvals
  listPending(@Ctx() ctx: RequestContext) {
    return this.svc.listPendingApprovals(ctx);
  }

  @Put('requests/:id/resolve')
  @RequirePermission('MANAGE_HOSPITAL')
  resolve(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.resolveApproval(ctx, id, body.status, body.decisionReason);
  }

  @Get('thresholds/check')
  @RequirePermission('MANAGE_FINANCE')
  checkThresholds(@Ctx() ctx: RequestContext, @Query('type') type: any, @Query('amount') amount: string) {
    return this.svc.checkThresholds(ctx, type, parseInt(amount, 10) || 0);
  }
}
