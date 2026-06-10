import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@hms/db';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { OperationsService } from './operations.service';

const OPERATION_PERMISSIONS = [
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.STAFF_READ,
  PERMISSIONS.PATIENT_READ,
  PERMISSIONS.PATIENT_TIMELINE_READ,
  PERMISSIONS.APPOINTMENT_READ,
  PERMISSIONS.QUEUE_READ,
  PERMISSIONS.ENCOUNTER_READ,
  PERMISSIONS.BILL_READ,
  PERMISSIONS.FINANCE_READ,
  PERMISSIONS.FINANCE_CASHIER,
  PERMISSIONS.FINANCE_DAY_CLOSE,
  PERMISSIONS.FINANCE_APPROVAL_MANAGE,
  PERMISSIONS.LAB_READ,
  PERMISSIONS.PHARMACY_READ,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.INVENTORY_REPORTS_READ,
  PERMISSIONS.IPD_READ,
  PERMISSIONS.NURSING_READ,
  PERMISSIONS.INSURANCE_READ,
  PERMISSIONS.REPORTS_READ,
];

@Controller('operations')
export class OperationsController {
  constructor(private readonly svc: OperationsService) {}

  @Get('work-queue')
  @RequirePermission(...OPERATION_PERMISSIONS)
  workQueue(@Ctx() ctx: RequestContext) {
    return this.svc.workQueue(ctx);
  }

  @Get('work-queue/summary')
  @RequirePermission(...OPERATION_PERMISSIONS)
  workQueueSummary(@Ctx() ctx: RequestContext) {
    return this.svc.summary(ctx);
  }

  @Get('blockers')
  @RequirePermission(...OPERATION_PERMISSIONS)
  blockers(@Ctx() ctx: RequestContext) {
    return this.svc.blockers(ctx);
  }

  @Get('recent-activity')
  @RequirePermission(...OPERATION_PERMISSIONS)
  recentActivity(@Ctx() ctx: RequestContext) {
    return this.svc.recentActivity(ctx);
  }
}
