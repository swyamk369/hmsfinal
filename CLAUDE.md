# HMS SaaS — Developer Briefing for Claude

Paste this file at the start of any Claude session to get full project context.

---

## What this project is

A **multi-tenant Hospital Management System (SaaS)** where multiple hospitals share one deployment. Each hospital is a **tenant**. Tenant data is isolated at the database layer using Postgres Row Level Security (RLS) — not application-layer filtering. Built as a pnpm monorepo. On top of the internal HMS there is a public, HotDoc/Zocdoc-style layer (Phase 22): patients **search globally, book locally**, and use a multi-hospital **patient portal** — same tenant-aware backend, strict isolation, one global patient login but separate per-hospital records.

**Repo:** https://github.com/swyamk369/hmsfinal (default branch `main`)
**Stack:** Next.js 14 (App Router) + NestJS + Prisma + PostgreSQL + Firebase Auth
**Auth:** Firebase, in dev too — there is **no** dev-header bypass. You log in with the
seeded demo accounts (real Firebase passwords, `Demo-2026!`). The API verifies the Firebase
token in `apps/api/src/common/auth.middleware.ts` and sets `req.ctx`. Pass `X-Tenant-Id` to
scope a request to a tenant.

> New here? Read **`HANDOFF.md`** (repo root) first — it's the current onboarding summary
> (this file is the conventions reference; `PROJECT_IMPLEMENTATION_PLAN.md` is the plan/status).

---

## How to run locally

```bash
pnpm services:up        # Docker: Postgres :5433, Redis :6380
pnpm dev                # API :4000 + Web :4001 (concurrently; api start:dev + web next dev)
# Set up the DB (first time only, on a fresh database):
pnpm --filter @hms/db exec prisma migrate deploy
# Create the runtime app role (non-owner, so FORCE RLS applies) — see snippet in sql/rls.sql:
#   CREATE ROLE hms_app LOGIN PASSWORD 'app_pw'; + GRANTs + ALTER DEFAULT PRIVILEGES
# Apply RLS policies + audit-immutability trigger (idempotent, safe to re-run):
psql "$ADMIN_URL" -f packages/db/sql/rls.sql     # or: pnpm --filter @hms/db rls
pnpm --filter @hms/db exec prisma db seed         # canonical permissions + role map
pnpm --filter @hms/api provision:demo             # idempotent demo data (2 hospitals + all users)
```

> ⚠️ Ports are **4000/4001/5433/6380** for this app — a separate older app may run on
> 3000/3001/5432/6379; do not collide with it.

Open http://localhost:4001. Log in at `/login` with a seeded **staff** account (e.g.
`admin@demo.local`, password `Demo-2026!`), or as a **patient** at `/patient/login`
(`patient@demo.local` / `Demo-2026!`). See "Demo accounts" below.

> ⚠️ Never run `pnpm --filter @hms/web build` while `next dev` is live — they share
> `apps/web/.next` and the prod build corrupts dev manifests (blanket 404s / "Loading…").
> Web build gate: stop dev → `rm -rf apps/web/.next` → build → `rm -rf .next` → restart dev.

**DB roles (critical for RLS):** the API uses TWO Prisma clients — `tenantBase` connects as
`hms_app` (APP_URL, non-owner → FORCE RLS isolates every query) and `platformBase` connects as
the owner (DATABASE_URL → bypasses RLS for platform/auth cross-tenant code). If both used the
superuser, RLS would never enforce. The seed/migrate run as owner and bypass RLS deliberately.

---

## Architecture — must-know rules

### Tenant isolation
- Every tenant-scoped table has a `tenantId` column.
- `forTenant(tenantId)` from `packages/db/src/tenant-prisma.ts` wraps every query in a transaction that sets `SET app.current_tenant_id = '...'`. Postgres RLS policies enforce isolation.
- **Never** use `rawPrisma` or `platformDb` inside ordinary tenant module services. They are
  the no-RLS owner client and are reserved for the deliberate cross-tenant/no-tenant cases:
  `auth.service.ts`, `super-admin.service.ts`, and the public/patient-portal services in
  `apps/api/src/patient-public/` (public directory reads + patient-portal auth, which run
  with no staff tenant context — they filter to `isPublic`/`PUBLISHED` or to the resolved
  `patientId` explicitly). Tenant **writes** from those services still go through
  `forTenant(tenantId)` / `tenantTransaction(tenantId, …)` so RLS applies.
- `platformDb` and `rawPrisma` are the same base Prisma client with no RLS — they bypass tenant isolation deliberately.

### Auth context
Every request has `req.ctx` set by middleware:
```typescript
req.ctx = { userId, tenantId, isPlatform, db }
```
- `db` is the tenant-scoped Prisma client (`forTenant(tenantId)`).
- `isPlatform = true` means the user is a Super Admin — they bypass all permission and module guards.

### RBAC & the guard chain
- Global `APP_GUARD`s run in order: **Throttler → Auth → Tenant → Permission → Module**.
- `@Public()` (`apps/api/src/common/decorators.ts`) bypasses the Auth guard; the Permission/
  Module/Tenant guards return `true` when there's no `@RequirePermission`/`@RequireModule`/
  tenantId. So `@Public()` + no other decorators = a truly public, no-auth route (used by the
  public directory and the patient portal, which does its own Firebase-token check).
- `@RequirePermission('patient.write')` on a handler means only users with that permission can call it.
- No permission decorator = any authenticated user can call it.
- Permissions are `"domain.action"` strings, resolved per tenant.

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

12 roles (canonical list in `packages/shared/src/roles.ts`):

| Role | Landing | Key permissions |
|---|---|---|
| `SUPER_ADMIN` | `/platform` | Platform-wide; bypasses permission + module guards (`isPlatform`) |
| `HOSPITAL_ADMIN` | `/admin` | Everything in-tenant + staff.manage + settings.manage |
| `HOSPITAL_MANAGER` | `/admin` | Read-heavy admin + reports + online-booking read |
| `DOCTOR` | `/doctor` | encounter.write, consultation.write, prescription.write, lab.write, patient document publish |
| `RECEPTION` | `/opd` | patient.write, encounter.read, bill.write, payment.write, online-booking manage |
| `NURSE` | `/patients` | vitals.write, consultation.read, lab.read |
| `LAB_TECH` | `/lab` | lab.read, lab.write |
| `PHARMACIST` | `/pharmacy` | pharmacy.write, inventory.read, prescription.read |
| `INVENTORY_MGR` | `/inventory` | inventory.read, inventory.write |
| `BILLING` | `/billing` | bill.write, bill.refund, bill.cancel, insurance.write |
| `ACCOUNTANT` | `/billing` | bill.read, bill.refund, insurance.read |
| `INSURANCE_STAFF` | `/billing` | insurance.read, insurance.write |

**Patients are NOT staff** — they have their own Firebase identity (`PatientAuthUser`) and use
the public/portal surface (`/patient/login` → `/patient/dashboard`), not the staff roles above.

---

## Canonical permissions

The full set lives in **`packages/shared/src/permissions.ts`** (and is seeded into Postgres);
it has grown well past the original core list and now spans patient, appointment, encounter,
prescription, vitals/diagnosis, consultation, schedule, bill/payment, pharmacy, lab, ipd,
inventory, insurance, report, tenant/staff/settings management — **plus the Phase 22 public
layer**: `public_profile.*`, `doctor_public_profile.manage`, `appointment_type.manage`,
`availability.manage`, `online_booking.read|manage|approve|reject|reschedule`,
`patient_portal_settings.manage`, `patient_portal_access.read|manage`,
`patient_document.publish|hide`. Don't hand-maintain a list here — read the source file, and
remember to **rebuild `@hms/shared` + `@hms/db` before `db:seed`** or new keys won't register.

---

## Key files

| File | Purpose |
|---|---|
| `HANDOFF.md` | Current onboarding summary (read first) |
| `PROJECT_IMPLEMENTATION_PLAN.md` | **Single source of truth** — phase plan, exact files, validation gates |
| `packages/db/prisma/schema.prisma` | Full data model |
| `packages/db/sql/rls.sql` | RLS policies + audit immutability trigger (lists the RLS-enrolled tables) |
| `packages/db/src/tenant-prisma.ts` | `forTenant()`, `tenantTransaction()`, `platformDb`, `rawPrisma` |
| `packages/db/prisma/seed.ts` | Canonical permissions + role→permission map |
| `apps/api/src/scripts/provision-demo.ts` | Idempotent demo data (2 hospitals, all users + portal patient) |
| `packages/shared/src/{permissions,roles}.ts` | Permission keys + role→permission defaults |
| `apps/api/src/app.module.ts` | All modules + global guards |
| `apps/api/src/common/decorators.ts` | `@RequirePermission`, `@RequireModule`, `@Public`, `@Ctx` |
| `apps/api/src/common/auth.middleware.ts` | Firebase token verification → `req.ctx` |
| `apps/api/src/common/audit.service.ts` | `AuditService` (global) — destructive-action logging |
| `apps/api/src/auth/auth.service.ts` | `/auth/me` — resolves full access picture |
| `apps/api/src/platform/super-admin.service.ts` | Cross-tenant platform operations |
| `apps/api/src/patient-public/` | **Phase 22** public directory + booking + patient portal + HMS admin controls |
| `apps/web/src/lib/auth-context.tsx` | `useAuth()`, `AuthProvider`, `getActiveMembership`, `landingPath` |
| `apps/web/src/lib/api.ts` | `apiGet/apiPost/apiPatch/apiPut` with auth headers |
| `apps/web/src/lib/{public,patient-portal,public-admin,bookings}.ts` | Phase 22 web clients |
| `apps/web/src/components/Protected.tsx` | Route wrapper: role + module + permission + platform checks |

---

## Status (current — see `PROJECT_IMPLEMENTATION_PLAN.md` for detail)

**Built & in `main`:**
- **Phases 0–18 (core HMS):** tenant isolation/RLS, Firebase auth, platform/super-admin,
  hospital admin setup, staff/providers, app shell, and full clinical/financial modules —
  Patients, OPD/encounters, Doctor consultation, Billing, Lab, Pharmacy, Inventory, IPD,
  Insurance, Reports/dashboards, Notifications, Audit, Testing. Most of the old 2026-06-08
  gap list (patient detail/archive, cancel/refund with reason, lab lifecycle, IPD charges,
  Provider creation, real pharmacy stock deduction, clinical/financial audit, RBAC/isolation
  tests, etc.) is **closed**.
- **Phase 21 — Revenue Cycle Hardening (partial):** 21.1 per-diem bed/room charging ✅,
  21.2 revenue-leakage reconciliation ✅.
- **Phase 22 — Public Patient Booking Layer (COMPLETE):** public hospital/doctor directory
  + global search; online booking that writes a real Appointment into the correct tenant;
  staff online-booking queue (approve/reject/reschedule/link); multi-hospital patient portal
  (separate Firebase identity, appointments/bills/reports/prescriptions/documents); HMS admin
  controls at `/admin/public-profile`; timezone-correct slots; document publish/hide; portal
  access management + patient-initiated request-access. All tenant-isolated and audited.

**Test baseline (keep green):** api **278**, web **276**.

**Open / next** (lowest-numbered first):
- **Phase 21.3–21.9:** payer tariffs/rate plans, advance deposits & estimates, discount/
  refund/write-off governance, GST invoices, package/bundled billing, day-close locking.
- **Phase 22 optional follow-ups (non-blocking):** portal prescriptions are read-only;
  request-access links are staff-approved (no auto-link); richer doctor-profile fields;
  patient-side reschedule/cancel; booking notifications (email/SMS); file-upload validation.

---

## Critical rules — never violate these

1. **Never use `profile.tenants[0]` in pages.** Always use `getActiveMembership(profile, activeTenantId)`.
2. **Never use `rawPrisma` or `platformDb` inside ordinary tenant module services.** Only the deliberate cross-tenant/no-tenant services: `auth.service.ts`, platform/super-admin, and `patient-public/` public+portal reads. Tenant writes always go via `forTenant`/`tenantTransaction`.
3. **Every destructive action requires a `reason` field** (archive patient, cancel bill, refund, deactivate staff, discharge IPD, reject claim, adjust stock). API must throw 400 if reason is empty. UI must prompt before calling.
4. **Never store plaintext passwords in Postgres.** Passwords are Firebase-only.
5. **Every destructive action must write an AuditLog row** with `{ tenantId, actorId, action, entity, entityId, metadata }`.
6. **A module is not complete until:** API works + UI works + RBAC works + module entitlement works + tenant isolation works + audit logs exist + seed data exists + E2E workflow passes.
7. **Never add `@RequireModule` to `staff.controller.ts`** — staff management is always accessible to admins regardless of plan.
8. **Run gates after every change:** `pnpm --filter @hms/api build && pnpm --filter @hms/api test`, the web build (with the `.next` ritual above) + `pnpm --filter @hms/web test`, and `pnpm --filter @hms/db exec prisma validate`. Keep api 278 / web 276 green.

---

## Money

All monetary amounts are stored as **minor units** (paise / cents). Divide by 100 to display. Example: ₹500.00 stored as `50000`.

---

## Demo accounts (after `provision:demo`, password `Demo-2026!`)

Login is real Firebase — there is no X-Dev header bypass. Staff sign in at `/login`; patients
at `/patient/login`.

| Account | Role / surface |
|---|---|
| `admin@demo.local` | HOSPITAL_ADMIN |
| `doctor@demo.local` | DOCTOR |
| `reception@demo.local` | RECEPTION |
| `nurse@demo.local` | NURSE |
| `labtech@demo.local` | LAB_TECH |
| `pharmacist@demo.local` | PHARMACIST |
| `billing@demo.local` | BILLING |
| `inventory@demo.local` | INVENTORY_MGR |
| `accountant@demo.local` | ACCOUNTANT |
| `insurance@demo.local` | INSURANCE_STAFF |
| `manager@demo.local` | HOSPITAL_MANAGER |
| `patient@demo.local` | Patient portal (linked to "Demo Hospital") |

Seeded tenants: **Demo Hospital** (full data) + **Sunrise Clinic** (public-directory only).
Public pages need no login: `/hospitals`, `/doctors`. To call the API directly as a staff
user, send a Firebase ID token + `X-Tenant-Id: <tenantId>`.

---

## Implementation plan summary

Full plan is in `PROJECT_IMPLEMENTATION_PLAN.md`. High-level status:

| Phases | Scope | Status |
|---|---|---|
| 0–18 | Core HMS: foundation, auth, platform, admin, staff, app shell, and all clinical/financial modules | ✅ Done |
| 21.1–21.2 | Revenue cycle: per-diem bed charging, revenue-leakage reconciliation | ✅ Done |
| 21.3–21.9 | Revenue cycle: tariffs, deposits/estimates, discount governance, GST invoices, packages, day-close | ⏳ |
| 22 | Public patient booking layer, global search, multi-hospital patient portal | ✅ Done |

**Pick the lowest-numbered ⏳ item and read its section in `PROJECT_IMPLEMENTATION_PLAN.md`
fully before touching any file.** (Phases 19–20 are not defined; 21 follows 18.)
