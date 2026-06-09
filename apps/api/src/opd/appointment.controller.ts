import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CreateAppointmentDto, ReasonDto, RescheduleDto, UpdateAppointmentDto } from './dto';

@Controller('appointments')
@RequireModule(MODULES.OPD)
export class AppointmentController {
  constructor(private readonly svc: AppointmentService) {}

  @Get()
  @RequirePermission(PERMISSIONS.APPOINTMENT_READ)
  list(
    @Ctx() ctx: RequestContext,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('providerId') providerId?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.svc.list(ctx, { date, status, providerId, patientId });
  }

  @Post()
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateAppointmentDto) {
    return this.svc.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.APPOINTMENT_WRITE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.svc.update(ctx, id, dto);
  }

  @Post(':id/reschedule')
  @RequirePermission(PERMISSIONS.APPOINTMENT_RESCHEDULE)
  reschedule(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.svc.reschedule(ctx, id, dto.scheduledAt, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.APPOINTMENT_CANCEL)
  cancel(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.svc.cancel(ctx, id, dto.reason);
  }
}
