import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { ServicePackageService } from './service-package.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/service-packages')
@RequireModule(MODULES.BILLING)
export class ServicePackageController {
  constructor(private readonly servicePackageService: ServicePackageService) {}

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  create(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.servicePackageService.create(ctx, body);
  }

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ, PERMISSIONS.SETTINGS_READ)
  findAll(@Ctx() ctx: RequestContext) {
    return this.servicePackageService.findAll(ctx);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ, PERMISSIONS.SETTINGS_READ)
  findOne(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.servicePackageService.findOne(ctx, id);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.servicePackageService.update(ctx, id, body);
  }

  @Post(':id/items')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  setItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.servicePackageService.setItem(ctx, id, body);
  }

  @Delete(':id/items/:catalogId')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  deleteItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Param('catalogId') catalogId: string) {
    return this.servicePackageService.deleteItem(ctx, id, catalogId);
  }
}
