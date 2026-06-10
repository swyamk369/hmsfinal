import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StaffService } from './staff.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { PERMISSIONS } from '@hms/db';
import { DeactivateStaffDto, InviteStaffDto, UpdateRolesDto, UpdateStaffDto } from './dto';

/**
 * Staff lifecycle. No @RequireModule — staff management is always available to
 * Hospital Admins regardless of the subscription plan.
 */
@Controller('staff')
export class StaffController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @RequirePermission(PERMISSIONS.STAFF_READ)
  list(@Ctx() ctx: RequestContext) {
    return this.svc.list(ctx);
  }

  @Post()
  @RequirePermission(PERMISSIONS.STAFF_INVITE)
  invite(@Ctx() ctx: RequestContext, @Body() dto: InviteStaffDto) {
    return this.svc.invite(ctx, dto);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.STAFF_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getById(ctx, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.STAFF_UPDATE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.svc.update(ctx, id, dto);
  }

  @Patch(':id/roles')
  @RequirePermission(PERMISSIONS.STAFF_UPDATE)
  updateRoles(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateRolesDto) {
    return this.svc.updateRoles(ctx, id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission(PERMISSIONS.STAFF_DEACTIVATE)
  deactivate(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: DeactivateStaffDto) {
    return this.svc.deactivate(ctx, id, dto.reason);
  }

  @Post(':id/reactivate')
  @RequirePermission(PERMISSIONS.STAFF_DEACTIVATE)
  reactivate(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.reactivate(ctx, id);
  }

  // Hits Firebase and emails a reset link — keep it tightly rate-limited.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/reset-password')
  @RequirePermission(PERMISSIONS.STAFF_RESET_PASSWORD)
  resetPassword(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.resetPassword(ctx, id);
  }
}
