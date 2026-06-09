import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestContext } from '../types';

/**
 * When a tenant is in context (X-Tenant-Id) for a non-platform user, requires an
 * active membership AND an active tenant. Platform users and tenant-less routes
 * (e.g. /auth/me, /platform/*) pass through.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx: RequestContext = context.switchToHttp().getRequest().ctx;
    if (ctx?.isPlatform) return true;
    if (!ctx?.tenantId) return true;

    if (!ctx.membershipExists || !ctx.membershipActive) {
      throw new ForbiddenException('No active membership for this tenant');
    }
    if (ctx.tenantStatus && ctx.tenantStatus !== 'ACTIVE') {
      throw new ForbiddenException(`Tenant is ${ctx.tenantStatus.toLowerCase()}`);
    }
    return true;
  }
}
