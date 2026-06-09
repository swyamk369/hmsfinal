import { Controller, Get } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';

/** Read-only OPD pickers (doctors + departments) for reception/doctor scheduling. */
@Controller('opd')
@RequireModule(MODULES.OPD)
export class DirectoryController {
  constructor(private readonly svc: AppointmentService) {}

  @Get('doctors')
  @RequirePermission(PERMISSIONS.APPOINTMENT_READ)
  doctors(@Ctx() ctx: RequestContext) {
    return this.svc.doctors(ctx);
  }

  @Get('departments')
  @RequirePermission(PERMISSIONS.APPOINTMENT_READ)
  departments(@Ctx() ctx: RequestContext) {
    return this.svc.departments(ctx);
  }
}
