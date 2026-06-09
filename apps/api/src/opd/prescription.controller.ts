import { Controller, Get, Param, Post } from '@nestjs/common';
import { EncounterService } from './encounter.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';

@Controller('prescriptions')
@RequireModule(MODULES.OPD)
export class PrescriptionController {
  constructor(private readonly svc: EncounterService) {}

  @Get(':id')
  @RequirePermission(PERMISSIONS.PRESCRIPTION_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getPrescription(ctx, id);
  }

  @Post(':id/finalize')
  @RequirePermission(PERMISSIONS.PRESCRIPTION_FINALIZE)
  finalize(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.finalizePrescription(ctx, id);
  }
}
