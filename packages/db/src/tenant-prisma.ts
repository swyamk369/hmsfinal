import { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Two Prisma clients enforce tenant isolation at the database layer.
//
//  • platformBase  → connects as the DB OWNER (DATABASE_URL).
//                    Bypasses RLS. Use ONLY in auth + platform code
//                    that legitimately spans tenants.
//
//  • appBase       → connects as a NON-OWNER role (APP_DATABASE_URL),
//                    so Postgres FORCE ROW LEVEL SECURITY applies to
//                    every query. Never used directly — always through
//                    forTenant(), which sets app.current_tenant_id.
//
// If both used the owner role, RLS would never enforce. See sql/rls.sql.
// ─────────────────────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  __hmsPlatformBase?: PrismaClient;
  __hmsAppBase?: PrismaClient;
};

const APP_URL = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

export const platformBase: PrismaClient =
  globalForPrisma.__hmsPlatformBase ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  });

const appBase: PrismaClient =
  globalForPrisma.__hmsAppBase ??
  new PrismaClient({
    datasources: { db: { url: APP_URL } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__hmsPlatformBase = platformBase;
  globalForPrisma.__hmsAppBase = appBase;
}

// Cross-tenant clients. Only auth.service.ts and platform services may use these.
export const platformDb = platformBase;
export const rawPrisma = platformBase;

export type TenantClient = ReturnType<typeof buildTenantClient>;

const tenantClientCache = new Map<string, TenantClient>();

function buildTenantClient(tenantId: string) {
  // Every operation runs inside a transaction that first sets
  // app.current_tenant_id (locally), so RLS policies can read it.
  return appBase.$extends({
    query: {
      async $allOperations({ args, query }) {
        const [, result] = await appBase.$transaction([
          appBase.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, TRUE)`,
          query(args),
        ]);
        return result;
      },
    },
  });
}

/**
 * Returns a Prisma client scoped to a single tenant. Every query it runs is
 * wrapped in a transaction that sets `app.current_tenant_id = <tenantId>`,
 * which the RLS policies use to filter rows. Cached per tenant.
 */
export function forTenant(tenantId: string): TenantClient {
  if (!tenantId) {
    throw new Error('forTenant() called without a tenantId');
  }
  let client = tenantClientCache.get(tenantId);
  if (!client) {
    client = buildTenantClient(tenantId);
    tenantClientCache.set(tenantId, client);
  }
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  await Promise.all([platformBase.$disconnect(), appBase.$disconnect()]);
}
