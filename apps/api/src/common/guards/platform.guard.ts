import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { RequestContext } from '../types';

/** Restricts a route/controller to platform (Super Admin) users. */
@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx: RequestContext = context.switchToHttp().getRequest().ctx;
    if (!ctx?.userId) throw new UnauthorizedException('Authentication required');
    if (!ctx.isPlatform) throw new ForbiddenException('Platform access required');
    return true;
  }
}
