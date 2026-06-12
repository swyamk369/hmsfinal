import { Injectable } from '@nestjs/common';
import { platformDb } from '@hms/db';

/**
 * Platform support staff get a deliberately NON-PHI, read-only access picture
 * for any tenant: enough to triage configuration/role/module issues without
 * default access to clinical, financial, or pharmacy records. Anything more
 * requires the hospital admin to grant a real (temporary) membership.
 */
export const SUPPORT_TENANT_PERMISSIONS: readonly string[] = [
  'settings.read',
  'facility.read',
  'department.read',
  'role.read',
  'staff.read',
  'public_profile.read',
];

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

    const user = await platformDb.user.findUnique({ where: { id: userId } });

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
    const hasActiveMembership = Boolean(membership?.active);
    const supportTriage = Boolean(user?.isSupport && !hasActiveMembership);

    if (supportTriage) {
      // Support staff triage with a restricted, read-only, NON-PHI permission
      // set - never blanket access to clinical/financial records. A real
      // active membership (granted by the hospital admin) takes precedence below.
      roles.push('PLATFORM_SUPPORT');
      for (const p of SUPPORT_TENANT_PERMISSIONS) perms.add(p);
    } else if (membership) {
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
      membershipActive: supportTriage || hasActiveMembership,
      membershipExists: supportTriage || Boolean(membership),
    };
  }
}
