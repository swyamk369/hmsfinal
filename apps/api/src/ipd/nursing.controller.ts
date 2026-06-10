import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { NursingService } from './nursing.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { MedAdminDto, NursingNoteDto, NursingVitalsDto, UpdateMedAdminDto } from './dto';

@Controller('nursing')
@RequireModule(MODULES.IPD)
export class NursingController {
  constructor(private readonly svc: NursingService) {}

  @Get('dashboard')
  @RequirePermission(PERMISSIONS.NURSING_READ)
  dashboard(@Ctx() ctx: RequestContext) {
    return this.svc.dashboard(ctx);
  }

  @Get('admissions/:id')
  @RequirePermission(PERMISSIONS.NURSING_READ)
  getAdmission(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getAdmission(ctx, id);
  }

  @Post('admissions/:id/vitals')
  @RequirePermission(PERMISSIONS.VITALS_WRITE)
  addVitals(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: NursingVitalsDto) {
    return this.svc.addVitals(ctx, id, dto);
  }

  @Post('admissions/:id/notes')
  @RequirePermission(PERMISSIONS.NURSING_NOTE_WRITE)
  addNote(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: NursingNoteDto) {
    return this.svc.addNote(ctx, id, dto);
  }

  @Get('admissions/:id/medications')
  @RequirePermission(PERMISSIONS.NURSING_READ)
  listMedications(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.listMedications(ctx, id);
  }

  @Post('admissions/:id/medications')
  @RequirePermission(PERMISSIONS.MEDICATION_ADMINISTER)
  addMedication(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: MedAdminDto) {
    return this.svc.addMedication(ctx, id, dto);
  }

  @Patch('medications/:id')
  @RequirePermission(PERMISSIONS.MEDICATION_ADMINISTER)
  updateMedication(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateMedAdminDto) {
    return this.svc.updateMedication(ctx, id, dto);
  }
}
