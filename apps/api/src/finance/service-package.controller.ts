import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ServicePackageService } from './service-package.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/service-packages')
export class ServicePackageController {
  constructor(private readonly servicePackageService: ServicePackageService) {}

  @Post()
  @RequirePermission('MANAGE_FINANCE')
  create(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.servicePackageService.create(ctx, body);
  }

  @Get()
  @RequirePermission('VIEW_FINANCE')
  findAll(@Ctx() ctx: RequestContext) {
    return this.servicePackageService.findAll(ctx);
  }

  @Get(':id')
  @RequirePermission('VIEW_FINANCE')
  findOne(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.servicePackageService.findOne(ctx, id);
  }

  @Put(':id')
  @RequirePermission('MANAGE_FINANCE')
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.servicePackageService.update(ctx, id, body);
  }

  @Post(':id/items')
  @RequirePermission('MANAGE_FINANCE')
  setItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.servicePackageService.setItem(ctx, id, body);
  }

  @Delete(':id/items/:catalogId')
  @RequirePermission('MANAGE_FINANCE')
  deleteItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Param('catalogId') catalogId: string) {
    return this.servicePackageService.deleteItem(ctx, id, catalogId);
  }
}
