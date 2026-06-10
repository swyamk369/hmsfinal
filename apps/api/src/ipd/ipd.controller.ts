import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IpdService } from './ipd.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { ChargeDto, CreateAdmissionDto, CreateBedDto, CreateWardDto, DischargeDto, RoundDto, TransferDto, UpdateBedDto, UpdateWardDto } from './dto';

@Controller('ipd')
@RequireModule(MODULES.IPD)
export class IpdController {
  constructor(private readonly svc: IpdService) {}

  // Wards
  @Get('wards')
  @RequirePermission(PERMISSIONS.IPD_READ)
  listWards(@Ctx() ctx: RequestContext) {
    return this.svc.listWards(ctx);
  }

  @Post('wards')
  @RequirePermission(PERMISSIONS.WARD_MANAGE)
  createWard(@Ctx() ctx: RequestContext, @Body() dto: CreateWardDto) {
    return this.svc.createWard(ctx, dto);
  }

  @Patch('wards/:id')
  @RequirePermission(PERMISSIONS.WARD_MANAGE)
  updateWard(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.svc.updateWard(ctx, id, dto);
  }

  // Beds
  @Get('beds')
  @RequirePermission(PERMISSIONS.IPD_READ)
  listBeds(@Ctx() ctx: RequestContext, @Query('wardId') wardId?: string) {
    return this.svc.listBeds(ctx, wardId);
  }

  @Post('beds')
  @RequirePermission(PERMISSIONS.BED_MANAGE)
  createBed(@Ctx() ctx: RequestContext, @Body() dto: CreateBedDto) {
    return this.svc.createBed(ctx, dto);
  }

  @Patch('beds/:id')
  @RequirePermission(PERMISSIONS.BED_MANAGE)
  updateBed(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.svc.updateBed(ctx, id, dto);
  }

  // Occupancy
  @Get('occupancy')
  @RequirePermission(PERMISSIONS.IPD_READ)
  occupancy(@Ctx() ctx: RequestContext) {
    return this.svc.occupancy(ctx);
  }

  // Admissions
  @Get('admissions')
  @RequirePermission(PERMISSIONS.IPD_READ)
  listAdmissions(@Ctx() ctx: RequestContext, @Query('status') status?: string, @Query('wardId') wardId?: string, @Query('q') q?: string) {
    return this.svc.listAdmissions(ctx, { status, wardId, q });
  }

  @Post('admissions')
  @RequirePermission(PERMISSIONS.IPD_ADMIT)
  admit(@Ctx() ctx: RequestContext, @Body() dto: CreateAdmissionDto) {
    return this.svc.admit(ctx, dto);
  }

  @Get('admissions/:id')
  @RequirePermission(PERMISSIONS.IPD_READ)
  getAdmission(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getAdmission(ctx, id);
  }

  @Get('admissions/:id/summary')
  @RequirePermission(PERMISSIONS.IPD_READ)
  summary(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.summary(ctx, id);
  }

  @Post('admissions/:id/transfer')
  @RequirePermission(PERMISSIONS.IPD_TRANSFER)
  transfer(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: TransferDto) {
    return this.svc.transfer(ctx, id, dto);
  }

  @Post('admissions/:id/rounds')
  @RequirePermission(PERMISSIONS.IPD_ROUND_WRITE)
  addRound(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: RoundDto) {
    return this.svc.addRound(ctx, id, dto);
  }

  @Post('admissions/:id/charges')
  @RequirePermission(PERMISSIONS.IPD_CHARGE_WRITE)
  addCharge(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ChargeDto) {
    return this.svc.addCharge(ctx, id, dto);
  }

  @Post('admissions/:id/discharge')
  @RequirePermission(PERMISSIONS.IPD_DISCHARGE)
  discharge(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: DischargeDto) {
    return this.svc.discharge(ctx, id, dto);
  }
}
