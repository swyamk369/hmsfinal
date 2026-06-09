import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PatientService } from './patient.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { AllergyDto, ArchivePatientDto, ConsentDto, CreatePatientDto, HistoryDto, UpdatePatientDto } from './dto';

@Controller('patients')
@RequireModule(MODULES.PATIENT)
export class PatientController {
  constructor(private readonly svc: PatientService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PATIENT_READ)
  list(@Ctx() ctx: RequestContext, @Query('q') q?: string) {
    return this.svc.list(ctx, q);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PATIENT_WRITE)
  register(@Ctx() ctx: RequestContext, @Body() dto: CreatePatientDto) {
    return this.svc.register(ctx, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PATIENT_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getById(ctx, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PATIENT_WRITE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.svc.update(ctx, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PATIENT_ARCHIVE)
  archive(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ArchivePatientDto) {
    return this.svc.archive(ctx, id, dto.reason);
  }

  @Get(':id/timeline')
  @RequirePermission(PERMISSIONS.PATIENT_TIMELINE_READ)
  timeline(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.timeline(ctx, id);
  }

  @Post(':id/consents')
  @RequirePermission(PERMISSIONS.PATIENT_CONSENT_MANAGE)
  addConsent(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ConsentDto) {
    return this.svc.addConsent(ctx, id, dto);
  }

  @Post(':id/allergies')
  @RequirePermission(PERMISSIONS.PATIENT_WRITE)
  addAllergy(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: AllergyDto) {
    return this.svc.addAllergy(ctx, id, dto);
  }

  @Post(':id/history')
  @RequirePermission(PERMISSIONS.PATIENT_WRITE)
  addHistory(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: HistoryDto) {
    return this.svc.addHistory(ctx, id, dto);
  }
}
