import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';
import { CreateLabTestDto, UpdateLabTestDto } from './dto';

/**
 * Lab test catalog setup. Module-aware: gated on LAB, so a tenant without the
 * LAB entitlement gets 403 here (and the page is routed to /module-disabled).
 */
@Controller('admin/lab-catalog')
@RequireModule(MODULES.LAB)
export class AdminLabCatalogController {
  constructor(private readonly svc: AdminService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LAB_CATALOG_MANAGE)
  list(@Ctx() ctx: RequestContext) {
    return this.svc.listLabTests(ctx);
  }

  @Post()
  @RequirePermission(PERMISSIONS.LAB_CATALOG_MANAGE)
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateLabTestDto) {
    return this.svc.createLabTest(ctx, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.LAB_CATALOG_MANAGE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateLabTestDto) {
    return this.svc.updateLabTest(ctx, id, dto);
  }
}
