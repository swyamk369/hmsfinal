import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_KEY } from '../decorators';
import type { RequestContext } from '../types';

/** Ensures the request carries a valid authenticated user (Firebase). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const ctx: RequestContext = context.switchToHttp().getRequest().ctx;
    if (!ctx?.userId) throw new UnauthorizedException('Authentication required');
    return true;
  }
}
