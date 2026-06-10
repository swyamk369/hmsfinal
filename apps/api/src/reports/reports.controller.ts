import { Controller, Get, Query } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { ReportQueryDto } from './dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('dashboard')
  @RequirePermission(
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.QUEUE_READ,
    PERMISSIONS.BILL_READ,
    PERMISSIONS.LAB_READ,
    PERMISSIONS.PHARMACY_READ,
    PERMISSIONS.INVENTORY_READ,
    PERMISSIONS.IPD_READ,
    PERMISSIONS.NURSING_READ,
    PERMISSIONS.INSURANCE_READ,
  )
  dashboard(@Ctx() ctx: RequestContext) {
    return this.svc.dashboard(ctx);
  }

  @Get('manager')
  @RequireModule(MODULES.REPORTS)
  @RequirePermission(PERMISSIONS.REPORTS_READ, PERMISSIONS.REPORTS_OPERATIONAL_READ)
  manager(@Ctx() ctx: RequestContext) {
    return this.svc.manager(ctx);
  }

  @Get('operations')
  @RequireModule(MODULES.REPORTS)
  @RequirePermission(PERMISSIONS.REPORTS_READ, PERMISSIONS.REPORTS_OPERATIONAL_READ)
  operations(@Ctx() ctx: RequestContext, @Query() q: ReportQueryDto) {
    return this.svc.operations(ctx, q);
  }

  @Get('financial')
  @RequireModule(MODULES.REPORTS)
  @RequirePermission(PERMISSIONS.REPORTS_FINANCIAL_READ, PERMISSIONS.BILL_READ)
  financial(@Ctx() ctx: RequestContext, @Query() q: ReportQueryDto) {
    return this.svc.financial(ctx, q);
  }

  @Get('inventory')
  @RequireModule(MODULES.REPORTS)
  @RequirePermission(PERMISSIONS.REPORTS_INVENTORY_READ, PERMISSIONS.INVENTORY_REPORTS_READ, PERMISSIONS.INVENTORY_READ)
  inventory(@Ctx() ctx: RequestContext, @Query() q: ReportQueryDto) {
    return this.svc.inventory(ctx, q);
  }

  @Get('clinical')
  @RequireModule(MODULES.REPORTS)
  @RequirePermission(PERMISSIONS.REPORTS_CLINICAL_READ, PERMISSIONS.ENCOUNTER_READ, PERMISSIONS.LAB_READ)
  clinical(@Ctx() ctx: RequestContext, @Query() q: ReportQueryDto) {
    return this.svc.clinical(ctx, q);
  }
}
