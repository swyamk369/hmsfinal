import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { PriceListService } from './price-list.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('finance/price-lists')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  @Post()
  @RequirePermission('MANAGE_FINANCE')
  create(@Ctx() ctx: RequestContext, @Body() body: any) {
    return this.priceListService.create(ctx, body);
  }

  @Get()
  @RequirePermission('VIEW_FINANCE')
  findAll(@Ctx() ctx: RequestContext) {
    return this.priceListService.findAll(ctx);
  }

  @Get(':id')
  @RequirePermission('VIEW_FINANCE')
  findOne(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.priceListService.findOne(ctx, id);
  }

  @Put(':id')
  @RequirePermission('MANAGE_FINANCE')
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.priceListService.update(ctx, id, body);
  }

  @Post(':id/items')
  @RequirePermission('MANAGE_FINANCE')
  setItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() body: any) {
    return this.priceListService.setItem(ctx, id, body);
  }

  @Delete(':id/items/:catalogId')
  @RequirePermission('MANAGE_FINANCE')
  deleteItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Param('catalogId') catalogId: string) {
    return this.priceListService.deleteItem(ctx, id, catalogId);
  }
}
