# Architecture

## Monorepo (pnpm workspaces)

| Package | Role |
|---|---|
| `packages/shared` | **Single source of truth** for the product contract: modules, plans, permissions, roles, role→permission map, route maps, screen catalog, shared API types. No runtime deps. |
| `packages/db` | Prisma schema, RLS SQL, tenant-scoped clients, seed. Re-exports `@hms/shared`. |
| `apps/api` | NestJS REST API. |
| `apps/web` | Next.js App Router + Tailwind frontend. Consumes `@hms/shared`. |
| `docs`, `infra` | Documentation and infrastructure notes. |

## Auth (Firebase only)

- Web: Firebase Web SDK → ID token. API client sends `Authorization: Bearer <token>` and `X-Tenant-Id`.
- API: `firebase-admin` verifies the ID token in `AuthMiddleware`; resolves the app user by `firebaseUid`.
- There is **no** dev auth, fake headers, quick-login, or impersonation. The first Super Admin is created by `bootstrap:superadmin`.

## Request context

`AuthMiddleware` populates `req.ctx`: `{ userId, isPlatform, tenantId, tenantStatus, roles, permissions, modules, providerId, membershipExists, membershipActive, db }`. `db` is the RLS-scoped Prisma client (`forTenant`).

## Global guard chain (order)

`AuthGuard` → `TenantGuard` (active membership + active tenant status) → `PermissionsGuard` (`@RequirePermission`) → `ModuleGuard` (`@RequireModule`). Platform controllers add `@UseGuards(PlatformGuard)`.

Every tenant endpoint therefore enforces: authenticated Firebase user → active tenant membership → active tenant status → permission → module entitlement → RLS-scoped DB access.

## Tenant isolation (PostgreSQL RLS)

Two Prisma clients: `platformDb` (owner, bypasses RLS — auth/platform only) and the `hms_app` role (non-owner → `FORCE ROW LEVEL SECURITY`). `forTenant(tenantId)` wraps every query in a transaction that sets `app.current_tenant_id`; policies in `packages/db/sql/rls.sql` filter by it. The `audit_log` table is append-only (trigger blocks UPDATE/DELETE).

## Money

Stored in minor units (paise/cents). Divide by 100 to display.
