import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { LabService } from './lab.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { EncounterLabOrderDto } from './dto';

/**
 * Clinical integration surface: ordering and reviewing lab work from within an
 * encounter. Gated by the LAB module (not OPD) since it is a lab capability —
 * a tenant without LAB cannot order tests even from the consult screen.
 */
@Controller('encounters')
@RequireModule(MODULES.LAB)
export class EncounterLabController {
  constructor(private readonly svc: LabService) {}

  @Get(':id/lab-orders')
  @RequirePermission(PERMISSIONS.LAB_READ)
  list(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.listForEncounter(ctx, id);
  }

  @Post(':id/lab-orders')
  @RequirePermission(PERMISSIONS.LAB_ORDER)
  create(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: EncounterLabOrderDto) {
    return this.svc.createFromEncounter(ctx, id, dto);
  }
}
