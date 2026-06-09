import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { platformDb, forTenant } from '@hms/db';
import { FirebaseService } from './firebase.service';
import { AccessService } from './access.service';
import { emptyContext, RequestContext } from './types';

/**
 * Resolves req.ctx for every request. Identity comes ONLY from a verified
 * Firebase ID token (Authorization: Bearer <token>). Active tenant comes from
 * X-Tenant-Id. Never throws — the guards enforce access.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly access: AccessService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const ctx: RequestContext = emptyContext();
    (req as any).ctx = ctx;

    const authz = req.header('authorization');
    if (!authz?.startsWith('Bearer ')) return next();

    const verified = await this.firebase.verifyIdToken(authz.slice(7));
    if (!verified) return next();

    const user = await platformDb.user.findUnique({ where: { firebaseUid: verified.uid } });
    if (!user || user.disabledAt) return next();

    ctx.userId = user.id;
    ctx.user = { id: user.id, email: user.email, fullName: user.fullName };
    ctx.isPlatform = user.isPlatform;

    const tenantId = req.header('x-tenant-id') || null;
    if (tenantId) {
      ctx.tenantId = tenantId;
      ctx.db = forTenant(tenantId);
      const active = await this.access.resolveActive(user.id, tenantId);
      ctx.tenantStatus = active.tenantStatus;
      ctx.roles = active.roles;
      ctx.permissions = new Set(active.permissions);
      ctx.modules = new Set(active.modules);
      ctx.providerId = active.providerId;
      ctx.membershipExists = active.membershipExists;
      ctx.membershipActive = active.membershipActive;
    }

    return next();
  }
}
