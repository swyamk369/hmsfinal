import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import {
  CompleteEncounterDto,
  ConsultationChargeDto,
  CreateEncounterDto,
  CreatePrescriptionDto,
  DiagnosisDto,
  NoteDto,
  ReasonDto,
  VitalsDto,
} from './dto';

@Controller('encounters')
@RequireModule(MODULES.OPD)
export class EncounterController {
  constructor(private readonly svc: EncounterService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ENCOUNTER_READ)
  list(
    @Ctx() ctx: RequestContext,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('providerId') providerId?: string,
    @Query('today') today?: string,
  ) {
    return this.svc.list(ctx, { patientId, status, providerId, today: today === '1' || today === 'true' });
  }

  @Post()
  @RequirePermission(PERMISSIONS.ENCOUNTER_WRITE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateEncounterDto) {
    return this.svc.create(ctx, dto);
  }

  @Get('queue')
  @RequirePermission(PERMISSIONS.QUEUE_READ)
  queue(
    @Ctx() ctx: RequestContext,
    @Query('providerId') providerId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.svc.queue(ctx, { providerId, departmentId });
  }

  @Get(':id/detail')
  @RequirePermission(PERMISSIONS.ENCOUNTER_READ)
  detail(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.detail(ctx, id);
  }

  @Post(':id/checkin')
  @RequirePermission(PERMISSIONS.QUEUE_MANAGE)
  checkin(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.checkin(ctx, id);
  }

  @Post(':id/start')
  @RequirePermission(PERMISSIONS.CONSULTATION_WRITE)
  start(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.start(ctx, id);
  }

  @Post(':id/complete')
  @RequirePermission(PERMISSIONS.CONSULTATION_WRITE)
  complete(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CompleteEncounterDto) {
    return this.svc.complete(ctx, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.ENCOUNTER_WRITE)
  cancel(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.svc.cancel(ctx, id, dto.reason);
  }

  @Post(':id/consultation-charge')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE)
  chargeConsultation(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ConsultationChargeDto) {
    return this.svc.chargeConsultation(ctx, id, dto);
  }

  // Clinical
  @Get(':id/vitals')
  @RequirePermission(PERMISSIONS.VITALS_READ)
  getVitals(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getVitals(ctx, id);
  }

  @Post(':id/vitals')
  @RequirePermission(PERMISSIONS.VITALS_WRITE)
  addVitals(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: VitalsDto) {
    return this.svc.addVitals(ctx, id, dto);
  }

  @Get(':id/diagnoses')
  @RequirePermission(PERMISSIONS.ENCOUNTER_READ)
  getDiagnoses(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getDiagnoses(ctx, id);
  }

  @Post(':id/diagnoses')
  @RequirePermission(PERMISSIONS.DIAGNOSIS_WRITE)
  addDiagnosis(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: DiagnosisDto) {
    return this.svc.addDiagnosis(ctx, id, dto);
  }

  @Get(':id/notes')
  @RequirePermission(PERMISSIONS.CONSULTATION_READ)
  getNotes(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getNotes(ctx, id);
  }

  @Post(':id/notes')
  @RequirePermission(PERMISSIONS.CLINICAL_NOTE_WRITE)
  addNote(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.svc.addNote(ctx, id, dto);
  }

  // Prescriptions (under encounter)
  @Get(':id/prescriptions')
  @RequirePermission(PERMISSIONS.PRESCRIPTION_READ)
  listPrescriptions(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.listPrescriptions(ctx, id);
  }

  @Post(':id/prescriptions')
  @RequirePermission(PERMISSIONS.PRESCRIPTION_WRITE)
  createPrescription(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CreatePrescriptionDto) {
    return this.svc.createPrescription(ctx, id, dto);
  }
}
