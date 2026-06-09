import { Controller, Get } from '@nestjs/common';
import { Ctx, RequireModule, RequirePermission } from '../common/decorators';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { MODULES, PERMISSIONS } from '@hms/db';

/**
 * Foundation read endpoint. Its only job in Phase 1 is to prove the module
 * guard: a STARTER tenant (no LAB) gets 403; a GROWTH+ tenant gets 200.
 */
@Controller('lab')
@RequireModule(MODULES.LAB)
export class LabController {
  @Get('orders')
  @RequirePermission(PERMISSIONS.LAB_READ)
  orders(@Ctx() ctx: RequestContext) {
    const db = requireDb(ctx);
    return db.labOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  }
}
