import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PharmacyService } from './pharmacy.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { DispenseDto, ReturnDto } from './dto';

@Controller('pharmacy')
@RequireModule(MODULES.PHARMACY)
export class PharmacyController {
  constructor(private readonly svc: PharmacyService) {}

  @Get('prescriptions')
  @RequirePermission(PERMISSIONS.PHARMACY_READ)
  listPrescriptions(@Ctx() ctx: RequestContext, @Query('status') status?: string, @Query('q') q?: string) {
    return this.svc.listPrescriptions(ctx, { status, q });
  }

  @Get('stats')
  @RequirePermission(PERMISSIONS.PHARMACY_READ)
  stats(@Ctx() ctx: RequestContext) {
    return this.svc.stats(ctx);
  }

  @Get('dispenses')
  @RequirePermission(PERMISSIONS.PHARMACY_READ)
  listDispenses(@Ctx() ctx: RequestContext) {
    return this.svc.listDispenses(ctx);
  }

  @Get('dispenses/:id')
  @RequirePermission(PERMISSIONS.PHARMACY_READ)
  getDispense(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getDispense(ctx, id);
  }

  @Get('prescriptions/:id')
  @RequirePermission(PERMISSIONS.PHARMACY_READ)
  getPrescription(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getPrescription(ctx, id);
  }

  @Get('prescriptions/:id/availability')
  @RequirePermission(PERMISSIONS.PHARMACY_READ)
  availability(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.availability(ctx, id);
  }

  @Post('prescriptions/:id/dispense')
  @RequirePermission(PERMISSIONS.PHARMACY_DISPENSE)
  dispense(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: DispenseDto) {
    return this.svc.dispense(ctx, id, dto);
  }

  @Post('returns')
  @RequirePermission(PERMISSIONS.PHARMACY_RETURN)
  returns(@Ctx() ctx: RequestContext, @Body() dto: ReturnDto) {
    return this.svc.returns(ctx, dto);
  }
}
