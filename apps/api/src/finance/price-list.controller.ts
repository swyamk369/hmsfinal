import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { PriceListService } from './price-list.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/price-lists')
@RequireModule(MODULES.BILLING)
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  create(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.priceListService.create(ctx, body);
  }

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ, PERMISSIONS.SETTINGS_READ)
  findAll(@Ctx() ctx: RequestContext) {
    return this.priceListService.findAll(ctx);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.FINANCE_READ, PERMISSIONS.BILL_READ, PERMISSIONS.SETTINGS_READ)
  findOne(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.priceListService.findOne(ctx, id);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.priceListService.update(ctx, id, body);
  }

  @Post(':id/items')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  setItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.priceListService.setItem(ctx, id, body);
  }

  @Delete(':id/items/:catalogId')
  @RequirePermission(PERMISSIONS.FINANCE_CHARGE_MANAGE, PERMISSIONS.BILL_WRITE, PERMISSIONS.SETTINGS_MANAGE)
  deleteItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Param('catalogId') catalogId: string) {
    return this.priceListService.deleteItem(ctx, id, catalogId);
  }
}
