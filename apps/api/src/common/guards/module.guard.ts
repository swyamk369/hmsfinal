import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MODULE_KEY } from '../decorators';
import type { RequestContext } from '../types';

/** Enforces @RequireModule against the active tenant's entitlements. Platform users bypass. */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const code = this.reflector.getAllAndOverride<string>(MODULE_KEY, [context.getHandler(), context.getClass()]);
    if (!code) return true;

    const ctx: RequestContext = context.switchToHttp().getRequest().ctx;
    if (ctx?.isPlatform) return true;
    if (!ctx?.tenantId) throw new ForbiddenException('Tenant context required');
    if (!ctx.modules.has(code)) throw new ForbiddenException(`Module ${code} not enabled`);
    return true;
  }
}
