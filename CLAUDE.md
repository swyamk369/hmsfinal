# HMS SaaS — Developer Briefing for Claude

Paste this file at the start of any Claude session to get full project context.

---

## What this project is

A **multi-tenant Hospital Management System (SaaS)** where multiple hospitals share one deployment. Each hospital is a **tenant**. Tenant data is isolated at the database layer using Postgres Row Level Security (RLS) — not application-layer filtering. Built as a pnpm monorepo.

**Repo:** https://github.com/swyamk3/HMS  
**Stack:** Next.js 14 (App Router) + NestJS + Prisma + PostgreSQL + Firebase Auth  
**Auth in dev:** Firebase is bypassed. The API reads `X-Dev-Platform: 1` / `X-Dev-User: <uid>` / `X-Tenant-Id: <uuid>` headers.

---

## How to run locally

```bash
pnpm services:up        # Docker: Postgres :5432, Redis :6379
pnpm dev                # API :3000 + Web :3001
# Set up the DB (first time only, on a fresh database):
pnpm --filter @hms/db exec prisma migrate deploy
# Create the runtime app role (non-owner, so FORCE RLS applies) — see snippet in sql/rls.sql:
#   CREATE ROLE hms_app LOGIN PASSWORD 'app_pw'; + GRANTs + ALTER DEFAULT PRIVILEGES
# Apply RLS policies + audit-immutability trigger (idempotent, safe to re-run):
psql "$ADMIN_URL" -f packages/db/sql/rls.sql     # or: pnpm --filter @hms/db rls
pnpm --filter @hms/db exec prisma db seed         # idempotent: wipes & rebuilds demo-clinic
```

Open http://localhost:3001. In dev mode you log in by **email** (password ignored) via the
one-click buttons on /login, or as Super Admin (`dev@hms.local`).

**DB roles (critical for RLS):** the API uses TWO Prisma clients — `tenantBase` connects as
`hms_app` (APP_URL, non-owner → FORCE RLS isolates every query) and `platformBase` connects as
the owner (DATABASE_URL → bypasses RLS for platform/auth cross-tenant code). If both used the
superuser, RLS would never enforce. The seed/migrate run as owner and bypass RLS deliberately.

---

## Architecture — must-know rules

### Tenant isolation
- Every tenant-scoped table has a `tenantId` column.
- `forTenant(tenantId)` from `packages/db/src/tenant-prisma.ts` wraps every query in a transaction that sets `SET app.current_tenant_id = '...'`. Postgres RLS policies enforce isolation.
- **Never** use `rawPrisma` or `platformDb` inside tenant module services. Only use them in `auth.service.ts` and `super-admin.service.ts`.
- `platformDb` and `rawPrisma` are the same base Prisma client with no RLS — they bypass tenant isolation deliberately.

### Auth context
Every request has `req.ctx` set by middleware:
```typescript
req.ctx = { userId, tenantId, isPlatform, db }
```
- `db` is the tenant-scoped Prisma client (`forTenant(tenantId)`).
- `isPlatform = true` means the user is a Super Admin — they bypass all permission and module guards.

### RBAC
- `PermissionsGuard` is registered as `APP_GUARD` — it applies to every route automatically.
- `@RequirePermission('patient.write')` on a handler means only users with that permission can call it.
- No decorator = any authenticated user can call it.
- Permissions are `"module.action"` strings stored in Postgres, resolved per tenant.

### Module entitlement guard
- `ModuleGuard` is registered as the second `APP_GUARD`.
- `@RequireModule('LAB')` on a controller class means only tenants with LAB enabled can call any route in that controller.
- Module entitlements are set per-subscription in the `module_entitlement` table.
- Platform users bypass the module guard.

### /auth/me response shape
```typescript
{
  id: string,
  email: string,
  fullName: string,
  isPlatform: boolean,
  tenants: [{
    tenantId: string,
    tenantName: string,
    status: string,          // 'ACTIVE' | 'SUSPENDED'
    roles: string[],         // e.g. ['DOCTOR']
    permissions: string[],   // e.g. ['patient.read', 'encounter.write']
    modules: string[],       // e.g. ['PATIENT', 'OPD', 'BILLING']
    providerId: string|null  // set for DOCTOR/NURSE roles
  }]
}
```

### Frontend auth
- `useAuth()` from `apps/web/src/lib/auth-context.tsx` — provides `profile`, `activeTenantId`, `setActiveTenant`, `login`, `logout`.
- `getActiveMembership(profile, activeTenantId)` — returns the Membership for the active tenant (falls back to `tenants[0]`).
- `activeTenantId` is persisted in `localStorage` under key `hms_active_tenant`.
- Every API call must pass `activeTenantId` as the tenant scope — use `apiGet(path, tenantId)` / `apiPost(path, body, tenantId)` from `apps/web/src/lib/api.ts`.
- **Never** use `profile.tenants[0]` directly in pages. Always use `getActiveMembership` or `activeTenantId`.

### Route protection
```tsx
// Role-gated:
<Protected allowedRoles={['HOSPITAL_ADMIN', 'DOCTOR']}>

// Module-gated:
<Protected requireModule="LAB">

// Both:
<Protected allowedRoles={['LAB_TECH']} requireModule="LAB">

// Platform only:
<Protected requirePlatform>
```

---

## Canonical module codes

| Code | Module | Plans |
|---|---|---|
| `PATIENT` | Patient records | All plans |
| `OPD` | Encounters, consultations | All plans |
| `BILLING` | Bills, payments | All plans |
| `ADMIN` | Hospital config | All plans |
| `SCHEDULING` | Doctor schedules | All plans |
| `PHARMACY` | Prescription dispensing | GROWTH+ |
| `LAB` | Lab orders/results | GROWTH+ |
| `INVENTORY` | Stock management | PROFESSIONAL+ |
| `IPD` | Wards, admissions | PROFESSIONAL+ |
| `REPORTS` | Dashboards | PROFESSIONAL+ |
| `INSURANCE` | Claims, TPA | ENTERPRISE |

---

## Canonical roles and their landing pages

| Role | Landing | Key permissions |
|---|---|---|
| `HOSPITAL_ADMIN` | `/admin` | Everything + staff.manage + settings.manage |
| `DOCTOR` | `/doctor` | encounter.write, consultation.write, prescription.write, lab.write |
| `RECEPTION` | `/opd` | patient.write, encounter.read, bill.write, payment.write |
| `NURSE` | `/patients` | vitals.write, consultation.read, lab.read |
| `LAB_TECH` | `/lab` | lab.read, lab.write |
| `PHARMACIST` | `/pharmacy` | pharmacy.write, inventory.read, prescription.read |
| `INVENTORY_MGR` | `/inventory` | inventory.read, inventory.write |
| `BILLING` | `/billing` | bill.write, bill.refund, bill.cancel, insurance.write |
| `ACCOUNTANT` | `/billing` | bill.read, bill.refund, insurance.read |

---

## Canonical permissions (29 keys)

```
patient.read, patient.write
appointment.read, appointment.write
encounter.read, encounter.write
prescription.read, prescription.write
vitals.write, diagnosis.write
consultation.read, consultation.write
schedule.read, schedule.write
bill.read, bill.write, bill.refund, bill.cancel, payment.write
pharmacy.read, pharmacy.write
lab.read, lab.write
ipd.read, ipd.write
inventory.read, inventory.write
insurance.read, insurance.write
tenant.manage, staff.manage, settings.manage
report.read
```

---

## Key files

| File | Purpose |
|---|---|
| `PROJECT_IMPLEMENTATION_PLAN.md` | **Single source of truth** — 18-phase plan, exact files, validation gates |
| `AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md` | Multi-agent product/implementation coordination contract |
| `packages/db/prisma/schema.prisma` | Full data model |
| `packages/db/sql/rls.sql` | RLS policies + audit immutability trigger |
| `packages/db/src/tenant-prisma.ts` | `forTenant()`, `platformDb`, `rawPrisma` |
| `packages/db/prisma/seed.ts` | Canonical permissions, role→permission map, demo data |
| `apps/api/src/app.module.ts` | All modules + global guards (PermissionsGuard, ModuleGuard) |
| `apps/api/src/common/permissions.guard.ts` | `@RequirePermission`, `PermissionsGuard`, `PlatformGuard` |
| `apps/api/src/common/module.guard.ts` | `@RequireModule`, `ModuleGuard` |
| `apps/api/src/common/dev-auth.middleware.ts` | Dev fake auth — never enable in production |
| `apps/api/src/auth/auth.service.ts` | `/auth/me` — resolves full access picture |
| `apps/api/src/platform/super-admin.service.ts` | Cross-tenant platform operations |
| `apps/web/src/lib/auth-context.tsx` | `useAuth()`, `AuthProvider`, `getActiveMembership`, `landingPath` |
| `apps/web/src/lib/api.ts` | `apiGet()`, `apiPost()` with auth headers |
| `apps/web/src/components/Protected.tsx` | Route wrapper: role + module + platform checks |
| `apps/web/src/components/HeaderBar.tsx` | Module-filtered, role-aware nav |

---

## What is already built (confirmed 2026-06-08)

**Fully working infrastructure:**
- Firebase auth (prod) + dev header auth (dev mode)
- Postgres RLS on all tables via `forTenant()`
- `PermissionsGuard` + `ModuleGuard` as global APP_GUARDs
- `/auth/me` returns roles, permissions, modules[], providerId per tenant
- Active tenant handling across all pages (no stale `tenants[0]` usage)
- Tenant switcher in HeaderBar with localStorage persistence
- Suspended tenant enforcement (redirects to /login)
- Module-filtered navigation

**APIs exist for all modules (CRUD-level):**
- Platform/Super Admin (create/suspend/activate tenant, set modules)
- Patients, Encounters/OPD, Consultation, Prescriptions, Schedules
- Billing (bills, payments, invoice)
- Pharmacy (dispense prescriptions)
- Lab (orders, results, status)
- Inventory (items, batches, stock-in)
- IPD (wards, beds, admit, discharge)
- Insurance/Claims
- Staff (invite, assign roles)

**UI exists for all modules** — pages are at the routes listed in the role table above.

---

## What is NOT yet done (implementation gaps)

These are confirmed gaps as of 2026-06-08. See `PROJECT_IMPLEMENTATION_PLAN.md` for the exact files and changes needed for each.

| Gap | Phase |
|---|---|
| `createTenant()` does not bootstrap roles/permissions — inviteAdmin fails on new tenants | Phase 2 |
| No `inviteAdmin` endpoint on platform API | Phase 2 |
| Platform dashboard UI missing: tenant detail, module toggles, invite admin form | Phase 2 |
| Dev mode always Super Admin — no friendly-name role impersonation | Phase 3 |
| Seed missing NURSE, LAB_TECH, PHARMACIST, BILLING, INVENTORY_MGR users | Phase 3 |
| Hospital Admin has no UI to configure departments, catalog, wards | Phase 4 |
| `inviteStaff()` does not create Provider record for DOCTOR/NURSE | Phase 5 |
| No staff deactivate/reactivate with reason | Phase 5 |
| Doctor page auto-selects `providers[0]` instead of logged-in doctor's own provider | Phase 5 |
| No patient detail page | Phase 6 |
| No archive patient (soft delete) | Phase 6 |
| No cancel bill with reason | Phase 9 |
| No refund with reason | Phase 9 |
| Pharmacy dispenses using generic RX-GEN item, not real inventory | Phase 10 |
| No stock adjustment with reason | Phase 10 |
| Lab has no status lifecycle enforcement (can skip ORDERED → COMPLETED) | Phase 12 |
| No discharge summary | Phase 13 |
| No IPD charges posted to billing | Phase 13 |
| No duplicate insurance settlement check | Phase 14 |
| Audit logs missing for most clinical/financial actions | Phase 16 |
| No RBAC or tenant isolation tests | Phase 17 |

---

## Critical rules — never violate these

1. **Never use `profile.tenants[0]` in pages.** Always use `getActiveMembership(profile, activeTenantId)`.
2. **Never use `rawPrisma` or `platformDb` inside tenant module services.** Only use them in `auth.service.ts` and platform services.
3. **Every destructive action requires a `reason` field** (archive patient, cancel bill, refund, deactivate staff, discharge IPD, reject claim, adjust stock). API must throw 400 if reason is empty. UI must prompt before calling.
4. **Never store plaintext passwords in Postgres.** Passwords are Firebase-only.
5. **Every destructive action must write an AuditLog row** with `{ tenantId, actorId, action, entity, entityId, metadata }`.
6. **A module is not complete until:** API works + UI works + RBAC works + module entitlement works + tenant isolation works + audit logs exist + seed data exists + E2E workflow passes.
7. **Never add `@RequireModule` to `staff.controller.ts`** — staff management is always accessible to admins regardless of plan.
8. **Run builds after every phase:** `pnpm --filter api build && pnpm --filter web build && pnpm --filter @hms/db exec prisma validate`

---

## Money

All monetary amounts are stored as **minor units** (paise / cents). Divide by 100 to display. Example: ₹500.00 stored as `50000`.

---

## Dev mode users (after Phase 3 seed is run)

| X-Dev-User header | Role | Landing |
|---|---|---|
| `dev-platform` (default) | Super Admin | `/platform` |
| `dev-admin` | HOSPITAL_ADMIN | `/admin` |
| `dev-doctor` | DOCTOR | `/doctor` |
| `dev-nurse` | NURSE | `/patients` |
| `dev-reception` | RECEPTION | `/opd` |
| `dev-labtech` | LAB_TECH | `/lab` |
| `dev-pharmacist` | PHARMACIST | `/pharmacy` |
| `dev-billing` | BILLING | `/billing` |
| `dev-inventory` | INVENTORY_MGR | `/inventory` |

To impersonate a role, set `X-Dev-User: dev-doctor` and `X-Tenant-Id: <demo-clinic-id>` in your API client. The web app dev login buttons (Phase 3) handle this automatically.

---

## Implementation plan summary

Full plan is in `PROJECT_IMPLEMENTATION_PLAN.md`. Phase order:

| Phase | Name | Status |
|---|---|---|
| 0 | Freeze scope, seed permissions, plan modules | ✅ Done |
| 1 | SaaS foundation: module guard, auth/me, tenant pages, nav | ✅ Done |
| 2 | Platform: bootstrapTenantRoles, inviteAdmin, platform UI | ✅ Done |
| 3 | Dev seed: all 9 role users, dev impersonation, login buttons | ✅ Done |
| 4 | Hospital admin workspace: departments, catalog, wards | ⏳ |
| 5 | Staff full: Provider creation, deactivate, own provider | ⏳ |
| 6 | Patient full: detail page, search, archive | ⏳ |
| 7 | Reception/OPD: reschedule, cancel with reason | ⏳ |
| 8 | Doctor consultation: lab orders, consultation billing | ⏳ |
| 9 | Billing full: cancel + refund with reason | ⏳ |
| 10 | Pharmacy + inventory integration: real stock deduction | ⏳ |
| 11 | Inventory full: suppliers, purchase orders, thresholds | ⏳ |
| 12 | Lab full: lifecycle enforcement, abnormal flags | ⏳ |
| 13 | IPD full: rounds, charges, discharge summary | ⏳ |
| 14 | Insurance full: duplicate check, patient share | ⏳ |
| 15 | Dashboards: role-specific widgets, module-filtered | ⏳ |
| 16 | Audit, compliance, security hardening | ⏳ |
| 17 | Tests: RBAC, tenant isolation, 5 E2E workflows | ⏳ |
| 18 | Production deployment | ⏳ |

**Start from the lowest-numbered ⏳ phase. Read its section in `PROJECT_IMPLEMENTATION_PLAN.md` fully before touching any file.**
