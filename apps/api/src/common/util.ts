import { BadRequestException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import type { RequestContext } from './types';

/** Returns the tenant-scoped client or throws if no tenant is in context. */
export function requireDb(ctx: RequestContext): TenantClient {
  if (!ctx.db || !ctx.tenantId) {
    throw new BadRequestException('Tenant context required (missing X-Tenant-Id).');
  }
  return ctx.db;
}
