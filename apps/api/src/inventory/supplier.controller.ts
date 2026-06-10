import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SupplierService } from './supplier.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@Controller('inventory/suppliers')
@RequireModule(MODULES.INVENTORY)
export class SupplierController {
  constructor(private readonly svc: SupplierService) {}

  @Get()
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  list(@Ctx() ctx: RequestContext, @Query('q') q?: string) {
    return this.svc.list(ctx, q);
  }

  @Post()
  @RequirePermission(PERMISSIONS.INVENTORY_SUPPLIER_MANAGE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateSupplierDto) {
    return this.svc.create(ctx, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.get(ctx, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.INVENTORY_SUPPLIER_MANAGE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.svc.update(ctx, id, dto);
  }
}
