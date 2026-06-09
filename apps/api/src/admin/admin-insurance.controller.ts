import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CreateInsuranceProviderDto, UpdateInsuranceProviderDto } from './dto';

/**
 * Insurance payer directory setup. Module-aware: gated on INSURANCE, so a tenant
 * without the entitlement gets 403 (page routed to /module-disabled).
 */
@Controller('admin/insurance-providers')
@RequireModule(MODULES.INSURANCE)
export class AdminInsuranceController {
  constructor(private readonly svc: AdminService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INSURANCE_READ)
  list(@Ctx() ctx: RequestContext) {
    return this.svc.listInsuranceProviders(ctx);
  }

  @Post()
  @RequirePermission(PERMISSIONS.INSURANCE_PROVIDER_MANAGE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateInsuranceProviderDto) {
    return this.svc.createInsuranceProvider(ctx, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.INSURANCE_PROVIDER_MANAGE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateInsuranceProviderDto) {
    return this.svc.updateInsuranceProvider(ctx, id, dto);
  }
}
