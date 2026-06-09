# Hospital Management System (HMS) — SaaS Platform

## Overview

A multi-tenant Hospital Management System (SaaS) where multiple hospitals (tenants) share one deployment. Tenant data isolation is enforced via Postgres Row Level Security (RLS) — not application filtering. Built in a pnpm monorepo.

## Authoritative Implementation Plan

**See [PROJECT_IMPLEMENTATION_PLAN.md](./PROJECT_IMPLEMENTATION_PLAN.md)**

This is the single source of truth for all development work. It contains:
- Canonical module codes, plan definitions, roles, and permissions
- Current implementation status matrix (what exists vs. what is incomplete)
- 18 phases with exact files, change descriptions, and validation gates
- Developer work streams and parallelization rules
- Schema migration schedule
- Module completion checklist template

For multi-agent coordination, also read [AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md](./AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md). It defines the source-of-truth order, workstream lanes, startup checklist, handoff format, and shared-file rules so AI agents can work simultaneously without drifting.

---

## Project Structure

- **Monorepo**: `pnpm` workspaces
- **Frontend (`apps/web`)**: Next.js 14 App Router, React, Tailwind CSS
- **Backend (`apps/api`)**: NestJS REST API
- **DB package (`packages/db`)**: Prisma ORM + PostgreSQL
- **Auth**: Firebase (prod) / dev headers locally (`AUTH_MODE=dev`)

## How to Run Locally

```bash
pnpm services:up        # Docker: Postgres :5432, Redis :6379
pnpm dev                # API :3000 + Web :3001
```

Open http://localhost:3001 — auto-logged in as Super Admin in dev mode.

## Key Architecture

- **RLS**: `forTenant(tenantId)` sets `app.current_tenant_id` per-transaction. Postgres policies enforce isolation at the DB layer — not application layer.
- **`platformDb` / `rawPrisma`**: Cross-tenant Prisma client. Only used in platform routes and `auth.service.ts`. Never use in tenant-scoped module services.
- **`APP_GUARD`**: `PermissionsGuard` registered globally — applies to all routes. Decorated with `@RequirePermission('x.y')`.
- **Dev mode**: `X-Dev-Platform: 1` → Super Admin. `X-Dev-User: <uid>` → impersonate user. `X-Tenant-Id: <uuid>` → scope tenant.

## Build Commands

```bash
pnpm --filter api build
pnpm --filter web build
pnpm --filter @hms/db exec prisma validate
pnpm --filter @hms/db exec prisma db seed          # fresh DB only
pnpm --filter @hms/db exec prisma migrate deploy   # production / CI
pnpm --filter @hms/db exec prisma migrate dev --name <desc>  # new migration
```

## Important Files

| File | Purpose |
|---|---|
| `packages/db/prisma/schema.prisma` | Full data model — source of truth |
| `AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md` | Multi-agent product/implementation coordination contract |
| `packages/db/sql/rls.sql` | RLS policies + audit immutability trigger |
| `packages/db/src/tenant-prisma.ts` | `forTenant()`, `platformDb`, `rawPrisma` |
| `packages/db/prisma/seed.ts` | Canonical permissions, role definitions, demo data |
| `apps/api/src/app.module.ts` | All modules registered here + global guards |
| `apps/api/src/common/permissions.guard.ts` | `PermissionsGuard`, `PlatformGuard`, `@RequirePermission` |
| `apps/api/src/common/dev-auth.middleware.ts` | Dev fake auth (never enable in production) |
| `apps/api/src/auth/auth.service.ts` | `/auth/me` — resolves user's full access picture |
| `apps/web/src/lib/auth-context.tsx` | `useAuth()`, `AuthProvider`, `getActiveMembership`, `landingPath` |
| `apps/web/src/lib/api.ts` | `apiGet()`, `apiPost()` — auth headers injected automatically |
| `apps/web/src/components/Protected.tsx` | Role-gated + module-gated route wrapper |
| `apps/web/src/components/HeaderBar.tsx` | Role-based + module-filtered nav |

## Build Status (last verified 2026-06-08)

| Check | Status |
|---|---|
| `pnpm --filter api build` | ✅ Passes |
| `pnpm --filter web build` | ✅ Passes |
| `pnpm --filter @hms/db exec prisma validate` | ✅ Passes |

## Money representation

All monetary amounts stored as **minor units** (paise / cents). Divide by 100 to display. Example: ₹500.00 = `50000`.
