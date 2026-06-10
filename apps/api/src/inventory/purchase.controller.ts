import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CancelPurchaseDto, CreatePurchaseDto, ReceiveDto, UpdatePurchaseDto } from './dto';

@Controller('inventory/purchases')
@RequireModule(MODULES.INVENTORY)
export class PurchaseController {
  constructor(private readonly svc: PurchaseService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  list(@Ctx() ctx: RequestContext, @Query('status') status?: string, @Query('supplierId') supplierId?: string) {
    return this.svc.list(ctx, { status, supplierId });
  }

  @Post()
  @RequirePermission(PERMISSIONS.INVENTORY_PURCHASE_MANAGE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreatePurchaseDto) {
    return this.svc.create(ctx, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.get(ctx, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_PURCHASE_MANAGE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdatePurchaseDto) {
    return this.svc.update(ctx, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.INVENTORY_PURCHASE_MANAGE)
  cancel(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: CancelPurchaseDto) {
    return this.svc.cancel(ctx, id, dto.reason);
  }

  @Post(':id/receive')
  @RequirePermission(PERMISSIONS.INVENTORY_STOCK_IN)
  receive(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ReceiveDto) {
    return this.svc.receive(ctx, id, dto);
  }
}
