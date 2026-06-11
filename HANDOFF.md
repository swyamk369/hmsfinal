# HMS SaaS — Project Briefing & Handoff

You are joining an in-progress, multi-tenant Hospital Management System (SaaS).
Read this fully before touching any file. The single source of truth for scope and
phase status is `PROJECT_IMPLEMENTATION_PLAN.md`; project conventions are in `CLAUDE.md`.

## What this product is
A multi-tenant HMS where many hospitals share one deployment. Each hospital is a
**tenant**; tenant data is isolated at the **database layer via Postgres Row-Level
Security (RLS)** — never application-layer filtering. On top of the internal HMS we
have built a public, HotDoc/Zocdoc-style layer: patients **search globally, book
locally**, and use a **multi-hospital patient portal** — all on the same tenant-aware
backend, with strict isolation (Hospital A never sees Hospital B).

## Stack & repo
- pnpm monorepo: `apps/web` (Next.js 14 App Router), `apps/api` (NestJS),
  `packages/db` (Prisma + Postgres), `packages/shared` (permissions/roles).
- Postgres RLS + Firebase Auth. Money is stored in **minor units (paise)** — divide by 100.
- Repo: github.com/swyamk369/hmsfinal, default branch `main`.

## How to run (this app's ports — do NOT collide with any old app on 3000/3001/5432/6379)
- API :4000, Web :4001, Postgres :5433, Redis :6380 (Docker).
- Dev servers run as background watches (api `start:dev`, web `next dev`). Logs:
  /tmp/hms-api-dev.log, /tmp/hms-web-dev.log.
- DB setup: `prisma migrate deploy`, apply `packages/db/sql/rls.sql`, then
  `pnpm --filter @hms/api provision:demo` (idempotent demo data; see accounts below).
- ⚠️ NEVER run `pnpm --filter @hms/web build` while `next dev` is live — they share
  `apps/web/.next` and the prod build corrupts dev manifests (blanket 404s / "Loading…").
  Web build gate ritual: stop dev → `rm -rf apps/web/.next` → build → `rm -rf .next` → restart dev.

## Architecture rules (do not violate)
- **Two Prisma clients.** `forTenant(tenantId)` connects as the non-owner `hms_app` role
  (FORCE RLS → every query auto-scoped); `platformDb`/`rawPrisma` connect as owner
  (bypass RLS). Use `platformDb`/`rawPrisma` ONLY in auth, platform/super-admin, and the
  public-read/patient-portal services — never in normal tenant module services.
  `tenantTransaction(tenantId, fn)` for multi-step tenant writes.
- **Guard chain (global APP_GUARDs):** Throttler → Auth → Tenant → Permission → Module.
  `@Public()` bypasses AuthGuard; Permission/Module/Tenant guards return true when no
  `@RequirePermission`/`@RequireModule`/tenantId. So `@Public()` + no decorators = truly public.
- **RBAC:** permissions are `"domain.action"` strings in `packages/shared/src/permissions.ts`;
  role→permission defaults in `packages/shared/src/roles.ts`. After editing these, REBUILD
  `@hms/shared` + `@hms/db` before `db:seed` or the new perms won't register.
- **Money in paise.** Every destructive action requires a `reason` + writes an `AuditLog`
  row (tenantId, actorId, action, entity, entityId, metadata). Never store plaintext passwords.
- **Frontend:** never use `profile.tenants[0]`; use `getActiveMembership`/`activeTenantId`.
  API calls go through `apiGet/apiPost/apiPatch/apiPut(path, body, tenantId)` in
  `apps/web/src/lib/api.ts`. Staff pages wrap in `<Protected>` (gives the app shell +
  role/module/permission gating).

## What's already built
- **Phases 0–18 (core HMS):** tenant isolation/RLS, prod+dev auth, platform/super-admin,
  hospital admin setup, staff/providers, app shell, and full clinical/financial modules —
  Patients, OPD/encounters, Doctor consultation, Billing, Lab, Pharmacy, Inventory, IPD,
  Insurance, Reports/dashboards, Notifications, Audit, Testing. Built and committed.
- **Phase 21 — Revenue Cycle Hardening (partial):** 21.1 per-diem bed/room charging ✅,
  21.2 revenue-leakage reconciliation ✅. 21.3–21.9 are PLANNED, not built.
- **Phase 22 — Public Patient Booking Layer (COMPLETE, merged to main, commit 23d132c):**
  - 22.1 schema/RLS: 11 models + 12 enums (PatientAuthUser [global], PatientPortalAccess,
    PublicHospitalProfile, PublicDoctorProfile, AppointmentType, AvailabilityRule/Override,
    PatientPortalSettings, PublicSearchIndex [global], OnlineBooking, HospitalLocation),
    9 new RLS tables; 15 staff permissions wired to roles.
  - 22.2 staff admin controls: `apps/api/src/patient-public/hms-public.*` (@Controller('hms'),
    permission-gated, tenant-scoped, audited) + UI `/admin/public-profile` ("Public Site" tab):
    hospital profile (publish/hide), portal & booking settings (incl. timezone), appointment
    types CRUD, doctor profiles (publish/hide + availability editor), portal-access requests.
  - 22.3 public directory (no-auth): `PublicController` @Public + `PublicService` (owner client,
    PUBLISHED-only, public-safe) → `/public/hospitals|doctors|search`; pages `/hospitals(/[slug])`,
    `/doctors(/[slug])`.
  - 22.4 online booking: pure timezone-aware slot engine (`slots.ts`), `BookingService` writes a
    real Patient + Appointment(source=ONLINE_BOOKING) + OnlineBooking into the correct tenant via
    `tenantTransaction`; AUTOMATIC/MANUAL/HYBRID approval, duplicate detection (flag, never
    auto-merge); flow at `/book/[tenantId]/[doctorId]`.
  - 22.4b staff booking queue: `/opd/online-bookings` (approve/reject/reschedule/link-patient).
  - 22.5 patient portal (SEPARATE Firebase auth branch): `PatientPortalController` @Public verifies
    the patient's own token → `PatientAuthUser` → `PatientPortalAccess(ACTIVE)` → that hospital's
    Patient via `forTenant`; pages `/patient/login|register|dashboard` (hospital selector + tabs:
    appointments, bills, reports, prescriptions, documents[visibleToPatient only]).
  - 22.6 hardening: document publish/hide + portal-access block/revoke/reactivate (audited);
    timezone normalization (DST-correct wall-clock↔UTC); patient request-access flow; document-view
    audit; per-doctor availability UI.
  - Security model honored: one global patient login but SEPARATE per-hospital records (no shared
    medical record); documents default `visibleToPatient=false`; tenant isolation proven (unlinked
    tenant → 403, no token → 401); enforced backend-side, not just UI.

## Demo accounts (after `provision:demo`, password `Demo-2026!`)
- Staff: admin@demo.local, doctor@demo.local, reception@demo.local, nurse@demo.local,
  labtech@demo.local, pharmacist@demo.local, billing@demo.local, inventory@demo.local,
  accountant@demo.local, insurance@demo.local, manager@demo.local (login at `/login`).
- Patient portal: patient@demo.local (login at `/patient/login`, linked to "Demo Hospital").
- Public, no login: `/hospitals`, `/doctors`. Two seeded hospitals: Demo Hospital + Sunrise Clinic.

## Conventions for new work
- A module is "done" only when: API + UI + RBAC + module entitlement + tenant isolation +
  audit logs + seed data + an E2E path all work.
- Service pattern: `scope(ctx)` → {db: requireDb(ctx), tenantId, actorId}; `record(...)` for audit.
- Pure, unit-tested helpers for logic (see `slots.ts`, `bed-charges.ts`).
- Gates after every change: `pnpm --filter @hms/api build && test`, web build (with .next ritual)
  + web test, `prisma validate`. Current baseline: **api 278 tests, web 276 tests** all green.
- Tests mock `@hms/db` (`platformDb`/`forTenant`/`tenantTransaction`) — see existing `*.spec.ts`.

## What's next (pick from the plan; lowest-numbered open item first)
- **Phase 21.3–21.9** (revenue-cycle): payer tariffs/rate plans, advance deposits & estimates,
  discount/refund/write-off governance, GST invoices, package/bundled billing, day-close locking.
- **Phase 22 optional follow-ups** (none blocking): prescriptions are read-only in the portal;
  request-access links are staff-approved (no auto-link); could add doctor-profile rich fields,
  patient-side reschedule/cancel, email/SMS notifications on booking, file-upload validation.
- Always read the target phase's section in `PROJECT_IMPLEMENTATION_PLAN.md` fully before editing.

## Key files
- `PROJECT_IMPLEMENTATION_PLAN.md` (source of truth) · `CLAUDE.md` (conventions)
- `packages/db/prisma/schema.prisma`, `packages/db/sql/rls.sql`, `packages/db/src/tenant-prisma.ts`
- `apps/api/src/app.module.ts` (guards/modules), `common/decorators.ts`, `common/audit.service.ts`
- `apps/api/src/patient-public/` (the whole Phase 22 backend)
- `apps/api/src/scripts/provision-demo.ts` (demo seed)
- `apps/web/src/lib/{api,public,patient-portal,public-admin,bookings}.ts`,
  `apps/web/src/app/{hospitals,doctors,book,patient,admin/public-profile,opd/online-bookings}/`
