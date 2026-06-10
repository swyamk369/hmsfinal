import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators';
import type { RequestContext } from '../types';

/**
 * Enforces @RequirePermission. Platform users do NOT bypass: a Super Admin has
 * no tenant permissions, so every permission-gated tenant route returns 403.
 * Platform-only routes are gated by PlatformGuard and carry no
 * @RequirePermission. (Spec rule 13: no casual tenant clinical access.)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const ctx: RequestContext = context.switchToHttp().getRequest().ctx;
    if (!ctx?.userId) throw new UnauthorizedException('Authentication required');

    const ok = required.some((p) => ctx.permissions.has(p));
    if (!ok) {
      throw new ForbiddenException(`Missing permission: ${required.join(' or ')}`);
    }
    return true;
  }
}
