import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { StaffService } from './staff.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { PERMISSIONS } from '@hms/db';
import { UpdateRolePermissionsDto } from './dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLE_READ)
  list(@Ctx() ctx: RequestContext) {
    return this.svc.listRoles(ctx);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ROLE_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getRole(ctx, id);
  }

  @Patch(':id/permissions')
  @RequirePermission(PERMISSIONS.ROLE_WRITE)
  updatePermissions(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateRolePermissionsDto) {
    return this.svc.updateRolePermissions(ctx, id, dto);
  }
}

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLE_READ)
  list() {
    return this.svc.listPermissions();
  }
}
