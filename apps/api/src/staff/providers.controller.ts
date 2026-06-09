import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { StaffService } from './staff.service';
import { Ctx, RequirePermission } from '../common/decorators';
import type { RequestContext } from '../common/types';
import { PERMISSIONS } from '@hms/db';
import { UpdateProviderDto } from './dto';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly svc: StaffService) {}

  // `me` must be declared before `:id` so it is not captured as an id param.
  // No permission gate: any authenticated tenant member may read their own provider.
  @Get('me')
  me(@Ctx() ctx: RequestContext) {
    return this.svc.myProvider(ctx);
  }

  @Get()
  @RequirePermission(PERMISSIONS.STAFF_READ)
  list(@Ctx() ctx: RequestContext) {
    return this.svc.listProviders(ctx);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.STAFF_READ)
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.svc.getProvider(ctx, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.STAFF_UPDATE)
  update(@Ctx() ctx: RequestContext, @Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.svc.updateProvider(ctx, id, dto);
  }
}
