import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { AdjustStockDto, CreateItemDto, StockInDto, UpdateItemDto } from './dto';

@Controller('inventory')
@RequireModule(MODULES.INVENTORY)
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('items')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  listItems(@Ctx() ctx: RequestContext, @Query('q') q?: string) {
    return this.svc.listItems(ctx, q);
  }

  @Post('items')
  @RequirePermission(PERMISSIONS.INVENTORY_ITEM_WRITE)
  createItem(@Ctx() ctx: RequestContext, @Body() dto: CreateItemDto) {
    return this.svc.createItem(ctx, dto);
  }

  @Get('stats')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  stats(@Ctx() ctx: RequestContext) {
    return this.svc.stats(ctx);
  }

  @Get('items/:id')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  getItem(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getItem(ctx, id);
  }

  @Patch('items/:id')
  @RequirePermission(PERMISSIONS.INVENTORY_ITEM_WRITE)
  updateItem(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateItemDto) {
    return this.svc.updateItem(ctx, id, dto);
  }

  @Get('batches')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  listBatches(@Ctx() ctx: RequestContext, @Query('itemId') itemId?: string) {
    return this.svc.listBatches(ctx, itemId);
  }

  @Post('batches')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_IN)
  addBatch(@Ctx() ctx: RequestContext, @Body() dto: StockInDto) {
    return this.svc.stockIn(ctx, dto);
  }

  @Post('stock-in')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_IN)
  stockIn(@Ctx() ctx: RequestContext, @Body() dto: StockInDto) {
    return this.svc.stockIn(ctx, dto);
  }

  @Post('adjustments')
  @RequirePermission(PERMISSIONS.INVENTORY_ADJUST)
  adjust(@Ctx() ctx: RequestContext, @Body() dto: AdjustStockDto) {
    return this.svc.adjust(ctx, dto);
  }

  @Get('alerts')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  alerts(@Ctx() ctx: RequestContext) {
    return this.svc.alerts(ctx);
  }

  @Get('transactions')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  transactions(
    @Ctx() ctx: RequestContext,
    @Query('itemId') itemId?: string,
    @Query('batchId') batchId?: string,
    @Query('type') type?: string,
  ) {
    return this.svc.transactions(ctx, { itemId, batchId, type });
  }
}
