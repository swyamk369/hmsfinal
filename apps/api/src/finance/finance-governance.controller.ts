import { Controller, Get, Post, Body, Param, Put, Query } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { FinanceGovernanceService } from './finance-governance.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/governance')
@RequireModule(MODULES.BILLING)
export class FinanceGovernanceController {
  constructor(private readonly svc: FinanceGovernanceService) {}

  @Post('requests')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE, PERMISSIONS.FINANCE_WRITE_OFF)
  requestApproval(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.svc.requestApproval(ctx, body);
  }

  @Get('requests/pending')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE)
  listPending(@Ctx() ctx: RequestContext) {
    return this.svc.listPendingApprovals(ctx);
  }

  @Put('requests/:id/resolve')
  @RequirePermission(PERMISSIONS.FINANCE_APPROVAL_MANAGE)
  resolve(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.svc.resolveApproval(ctx, id, body.status, body.decisionReason);
  }

  @Get('thresholds/check')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ)
  checkThresholds(@Ctx() ctx: RequestContext, @Query('type') type: any, @Query('amount') amount: string) {
    return this.svc.checkThresholds(ctx, type, parseInt(amount, 10) || 0);
  }
}
