import { Controller, Get, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Ctx, Public } from '../common/decorators';
import type { RequestContext } from '../common/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Current user's full access picture: memberships, roles, permissions, modules. */
  @Get('me')
  me(@Ctx() ctx: RequestContext) {
    if (!ctx.userId) throw new UnauthorizedException();
    return this.auth.me(ctx.userId);
  }

  @Post('logout')
  @Public()
  logout() {
    // Firebase sessions are client-side; nothing to clear server-side yet.
    return { ok: true };
  }
}
