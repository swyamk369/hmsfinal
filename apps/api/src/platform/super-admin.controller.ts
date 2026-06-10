import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SuperAdminService } from './super-admin.service';
import { PlatformGuard } from '../common/guards/platform.guard';
import { Ctx } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { CreateTenantDto, InviteAdminDto, ReasonDto, ToggleModuleDto } from './dto';

@Controller('platform')
@UseGuards(PlatformGuard)
export class SuperAdminController {
  constructor(private readonly svc: SuperAdminService) {}

  @Get('tenants')
  list() {
    return this.svc.listTenants();
  }

  @Post('tenants')
  create(@Ctx() ctx: RequestContext, @Body() dto: CreateTenantDto) {
    return this.svc.createTenant(ctx.userId!, dto);
  }

  @Get('plans')
  plans() {
    return this.svc.listPlans();
  }

  @Get('audit')
  audit(
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('actorId') actorId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listAudit({
      limit: limit ? Number(limit) : 100,
      action,
      entity,
      actorId,
      tenantId,
      from,
      to,
    });
  }

  @Get('tenants/:id')
  detail(@Param('id') id: string) {
    return this.svc.getTenant(id);
  }

  @Get('tenants/:id/modules')
  modules(@Param('id') id: string) {
    return this.svc.getModules(id);
  }

  @Post('tenants/:id/modules')
  setModule(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ToggleModuleDto) {
    return this.svc.setModule(ctx.userId!, id, dto.moduleCode, dto.enabled);
  }

  @Post('tenants/:id/suspend')
  suspend(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: ReasonDto) {
    return this.svc.suspendTenant(ctx.userId!, id, dto.reason);
  }

  @Post('tenants/:id/activate')
  activate(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.activateTenant(ctx.userId!, id);
  }

  // Creates Firebase users — keep it tightly rate-limited.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('tenants/:id/invite-admin')
  inviteAdmin(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: InviteAdminDto) {
    return this.svc.inviteAdmin(ctx.userId!, id, dto);
  }
}
