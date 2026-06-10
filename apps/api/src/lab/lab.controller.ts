import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { LabService } from './lab.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import {
  CollectSampleDto,
  CreateLabCatalogDto,
  CreateLabOrderDto,
  EnterResultsDto,
  UpdateLabCatalogDto,
  UpdateLabStatusDto,
} from './dto';

@Controller('lab')
@RequireModule(MODULES.LAB)
export class LabController {
  constructor(private readonly svc: LabService) {}

  // ── Catalog ───────────────────────────────────────────────────
  @Get('catalog')
  @RequirePermission(PERMISSIONS.LAB_READ)
  catalog(@Ctx() ctx: RequestContext) {
    return this.svc.catalog(ctx);
  }

  @Post('catalog')
  @RequirePermission(PERMISSIONS.LAB_CATALOG_MANAGE)
  createCatalog(@Ctx() ctx: RequestContext, @Body() dto: CreateLabCatalogDto) {
    return this.svc.createCatalog(ctx, dto);
  }

  @Patch('catalog/:id')
  @RequirePermission(PERMISSIONS.LAB_CATALOG_MANAGE)
  updateCatalog(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateLabCatalogDto) {
    return this.svc.updateCatalog(ctx, id, dto);
  }

  // ── Dashboard ─────────────────────────────────────────────────
  @Get('stats')
  @RequirePermission(PERMISSIONS.LAB_READ)
  stats(@Ctx() ctx: RequestContext) {
    return this.svc.stats(ctx);
  }

  // ── Orders ────────────────────────────────────────────────────
  @Get('orders')
  @RequirePermission(PERMISSIONS.LAB_READ)
  orders(
    @Ctx() ctx: RequestContext,
    @Query('status') status?: string,
    @Query('patientId') patientId?: string,
    @Query('q') q?: string,
    @Query('today') today?: string,
  ) {
    return this.svc.listOrders(ctx, { status, patientId, q, today: today === '1' || today === 'true' });
  }

  @Post('orders')
  @RequirePermission(PERMISSIONS.LAB_ORDER)
  createOrder(@Ctx() ctx: RequestContext, @Body() dto: CreateLabOrderDto) {
    return this.svc.create(ctx, dto);
  }

  @Get('orders/:id')
  @RequirePermission(PERMISSIONS.LAB_READ)
  getOrder(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getOrder(ctx, id);
  }

  @Post('orders/:id/sample')
  @RequirePermission(PERMISSIONS.LAB_SAMPLE_COLLECT)
  collectSample(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CollectSampleDto) {
    return this.svc.collectSample(ctx, id, dto);
  }

  @Patch('orders/:id/status')
  @RequirePermission(PERMISSIONS.LAB_RESULT_ENTER)
  updateStatus(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateLabStatusDto) {
    return this.svc.updateStatus(ctx, id, dto);
  }

  @Post('orders/:id/results')
  @RequirePermission(PERMISSIONS.LAB_RESULT_ENTER)
  enterResults(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: EnterResultsDto) {
    return this.svc.enterResults(ctx, id, dto);
  }

  @Post('results/:id/verify')
  @RequirePermission(PERMISSIONS.LAB_RESULT_VERIFY)
  verifyResult(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.verifyResult(ctx, id);
  }

  @Get('reports/:id')
  @RequirePermission(PERMISSIONS.LAB_REPORT_PRINT, PERMISSIONS.LAB_READ)
  report(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.report(ctx, id);
  }
}
