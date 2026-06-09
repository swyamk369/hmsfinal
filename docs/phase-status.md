# Phase Status

| Phase | Status | Notes |
|---|---|---|
| 0 — New repo setup | ✅ Complete | pnpm monorepo (`apps/web`, `apps/api`, `packages/db`, `packages/shared`, `docs`, `infra`); TS configs; Prettier + ESLint; Jest; Docker Compose; CI skeleton; root scripts (dev/build/test/db:migrate/db:seed/db:rls). |
| 1 — Product contract | ✅ Complete | Canonical modules/plans/roles/permissions + route/screen maps in `@hms/shared`; docs in `docs/`; no dev-auth anywhere. |
| 2 — DB + RLS | ✅ Complete | Full Prisma schema, `tenantId` on every tenant table, RLS policies, append-only audit trigger, canonical-only seed (no fake users). |
| 3 — Production auth | ✅ Complete | Firebase Admin verification; `/auth/me`; Super Admin bootstrap; request context; AuthGuard/TenantGuard/PermissionsGuard/ModuleGuard/PlatformGuard; RLS helper. Web: login, forgot-password, tenant-suspended, unauthorized, module-disabled, app shell, role/module-aware nav. |
| 4 — Platform SaaS | ✅ Complete | Tenant CRUD + suspend/activate (reason) + module toggles + invite-admin + audit; `/platform`, `/platform/tenants/[id]`, `/platform/plans`, `/platform/audit`. E2E verified with real Firebase tokens. |
| 5+ | ⏳ Not started | Hospital admin setup, staff, clinical/billing/lab/pharmacy/inventory/IPD/insurance workflows. |

## Known deferred (allowed by plan)
- Global search and notification center: shells deferred until backend search/notification endpoints (later phases) — not built as dead controls.
- Platform KPI strip shows only derivable metrics (hospitals/active/suspended/staff); no MRR/trial analytics (no fake data).
