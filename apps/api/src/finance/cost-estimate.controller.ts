import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { CostEstimateService } from './cost-estimate.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/estimates')
export class CostEstimateController {
  constructor(private readonly svc: CostEstimateService) {}

  @Post()
  @RequirePermission('MANAGE_FINANCE')
  create(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.svc.createEstimate(ctx, body);
  }

  @Get()
  @RequirePermission('VIEW_FINANCE')
  list(@Ctx() ctx: RequestContext, @Query('patientId') patientId?: string) {
    return this.svc.listEstimates(ctx, patientId);
  }

  @Get(':id')
  @RequirePermission('VIEW_FINANCE')
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getEstimate(ctx, id);
  }

  @Put(':id/status')
  @RequirePermission('MANAGE_FINANCE')
  updateStatus(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body('status') status: any) {
    return this.svc.updateStatus(ctx, id, status);
  }
}
