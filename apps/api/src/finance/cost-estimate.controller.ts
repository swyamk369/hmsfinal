import { Body, Controller, Get, Param, Put, Post, Query } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CostEstimateService } from './cost-estimate.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/estimates')
@RequireModule(MODULES.BILLING)
export class CostEstimateController {
  constructor(private readonly svc: CostEstimateService) {}

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE)
  create(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.svc.createEstimate(ctx, body);
  }

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ)
  list(@Ctx() ctx: RequestContext, @Query('patientId') patientId?: string) {
    return this.svc.listEstimates(ctx, patientId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getEstimate(ctx, id);
  }

  @Put(':id/status')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE)
  updateStatus(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body('status') status: any) {
    return this.svc.updateStatus(ctx, id, status);
  }
}
