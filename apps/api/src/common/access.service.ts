import { Injectable } from '@nestjs/common';
import { platformDb } from '@hms/db';

export interface ActiveAccess {
  roles: string[];
  permissions: string[];
  modules: string[];
  providerId: string | null;
  tenantStatus: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  membershipActive: boolean;
  membershipExists: boolean;
}

/**
 * Resolves a user's access picture for one tenant. Uses platformDb (owner,
 * RLS-bypassing) deliberately: access resolution is a cross-tenant concern and
 * must work before any tenant scope is set.
 */
@Injectable()
export class AccessService {
  async resolveActive(userId: string, tenantId: string): Promise<ActiveAccess> {
    const tenant = await platformDb.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return {
        roles: [],
        permissions: [],
        modules: [],
        providerId: null,
        tenantStatus: null,
        tenantName: null,
        tenantSlug: null,
        membershipActive: false,
        membershipExists: false,
      };
    }

    const membership = await platformDb.tenantUser.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    const roles: string[] = [];
    const perms = new Set<string>();
    if (membership) {
      for (const ur of membership.roles) {
        roles.push(ur.role.code);
        for (const rp of ur.role.permissions) perms.add(rp.permission.key);
      }
    }

    const [ents, provider] = await Promise.all([
      platformDb.moduleEntitlement.findMany({ where: { tenantId, enabled: true } }),
      platformDb.provider.findFirst({ where: { tenantId, userId } }),
    ]);

    return {
      roles,
      permissions: [...perms],
      modules: ents.map((e) => e.moduleCode),
      providerId: provider?.id ?? null,
      tenantStatus: tenant.status,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      membershipActive: membership?.active ?? false,
      membershipExists: Boolean(membership),
    };
  }
}
