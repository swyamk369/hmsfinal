# HMS SaaS — Multi-tenant Hospital Management System

A production-oriented, multi-tenant hospital operating system. pnpm monorepo:
Next.js 14 (web) + NestJS (api) + Prisma + PostgreSQL with **Row-Level-Security
tenant isolation**, **Firebase-only auth**, RBAC, module entitlements, and audit
logging.

> Built per `PROJECT_IMPLEMENTATION_PLAN.md` (18-phase plan) and the NEW_APP spec.
> **Status: Foundation (DB/RLS, auth, guards, app shell) complete. Next: Phase 4
> — platform tenant provisioning.**

## Ports (chosen to avoid an older app already running on 3000/3001/5432/6379)

| Service  | URL                       |
|----------|---------------------------|
| Web      | http://localhost:4001     |
| API      | http://localhost:4000     |
| Postgres | localhost:5433 (db `hms`) |
| Redis    | localhost:6380            |

## Auth model

Firebase is the **only** authentication mechanism — there is no dev/header
bypass. The app DB is the source of truth for authorization (tenants, roles,
permissions, modules, providers, memberships). You must provide Firebase config
before the app will run.

## First-time setup

```bash
pnpm install
pnpm services:up                       # Postgres + Redis (docker)
pnpm --filter @hms/db build            # prisma generate + compile
pnpm --filter @hms/db migrate:deploy   # apply migrations
pnpm --filter @hms/db rls              # create hms_app role + RLS policies + audit trigger
pnpm --filter @hms/db seed             # canonical plans + permissions ONLY (no users)

# Configure Firebase (required):
#   apps/api/.env       → FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
#   apps/web/.env.local → NEXT_PUBLIC_FIREBASE_* (web SDK config)

# Create the first platform Super Admin (Firebase user + isPlatform app user):
SUPERADMIN_EMAIL=you@co.com SUPERADMIN_PASSWORD=secret \
  pnpm --filter @hms/api bootstrap:superadmin
```

After bootstrap, sign in at `/login` with that email/password. The Super Admin
creates hospital tenants and invites Hospital Admins (Phase 4) — every other user
enters the system through Firebase, never the seed.

## Run

```bash
pnpm dev          # api (:4000) + web (:4001) together
# or individually:
pnpm --filter @hms/api start:dev
pnpm --filter @hms/web dev
```

The API refuses to start until the `FIREBASE_*` env vars are set.

## Architecture

- **Tenant isolation:** Postgres RLS. `forTenant(tenantId)` (in
  `packages/db/src/tenant-prisma.ts`) wraps every query in a transaction that
  sets `app.current_tenant_id`; policies in `packages/db/sql/rls.sql` filter by
  it. Two clients: `platformDb` (owner, bypasses RLS — auth/platform only) and
  the app role `hms_app` (non-owner → FORCE RLS).
- **Guards (global, in order):** `AuthGuard` → `TenantGuard` (active membership +
  tenant status) → `PermissionsGuard` (`@RequirePermission`) → `ModuleGuard`
  (`@RequireModule`). Platform routes add `@UseGuards(PlatformGuard)`.
- **Auth:** API verifies Firebase ID tokens (`Authorization: Bearer`); web uses
  the Firebase web SDK. Active tenant via `X-Tenant-Id`.
- **Money:** stored in minor units (paise/cents) — divide by 100 to display.

## Build gates (run after every change)

```bash
pnpm --filter @hms/db exec prisma validate
pnpm --filter @hms/api build
pnpm --filter @hms/web build
```
