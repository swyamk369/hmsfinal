import type { TenantClient } from '@hms/db';

/**
 * Per-request context attached to `req.ctx` by AuthMiddleware and consumed by
 * the guards, controllers, and services. Resolved once per request.
 */
export interface RequestContext {
  userId: string | null;
  isPlatform: boolean;
  isSupport: boolean;
  tenantId: string | null;
  tenantStatus: string | null;
  roles: string[];
  permissions: Set<string>;
  modules: Set<string>;
  providerId: string | null;
  /** True when the user has a membership row for the active tenant. */
  membershipExists: boolean;
  /** True when that membership is active (not deactivated). */
  membershipActive: boolean;
  /** Tenant-scoped Prisma client (RLS). Null when no tenant in context. */
  db: TenantClient | null;
  user: { id: string; email: string; fullName: string } | null;
}

export function emptyContext(): RequestContext {
  return {
    userId: null,
    isPlatform: false,
    isSupport: false,
    tenantId: null,
    tenantStatus: null,
    roles: [],
    permissions: new Set<string>(),
    modules: new Set<string>(),
    providerId: null,
    membershipExists: false,
    membershipActive: false,
    db: null,
    user: null,
  };
}
