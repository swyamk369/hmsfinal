# Phase 23 — Patient Experience Overhaul (HealthConnect): HANDOFF

> Read this top-to-bottom before touching a file. It contains the full current state,
> the conventions already locked in, and the exact remaining plan. The single source of
> truth for scope is `PROJECT_IMPLEMENTATION_PLAN.md` (Phase 22 = current backend behavior)
> and `CLAUDE.md` (conventions, ports, auth, demo accounts). This file is the Phase-23 layer.

---

## 0. TL;DR — where we are

Phase 23 reskins the **patient-facing** frontend to the HealthConnect design system and adds
the patient features the designs imply, **without** regressing any Phase 22 / HMS staff flow
and **without fake data** (no fake payments/ratings/distances/reviews/experience).

It is organized as **Part A** (reskin existing patient routes — frontend, uses existing APIs)
and **Part B** (new backend models + RLS + migration + seed + endpoints, plus their screens
and tests).

Progress:

| Increment | Scope | Status |
|---|---|---|
| A1–A3 | Booking wizard, public home `/`, patient `/patient/login` + `/patient/register`, public nav | ✅ done (prior session, **committed** `1d9d207`) |
| **A4** | `/doctors` + `/hospitals` reskin (filter sidebar w/ live counts, rich cards, mobile) | ✅ done this session (uncommitted) |
| **A5** | `/doctors/[slug]` + `/hospitals/[slug]` profiles + sticky real-slot Book widget | ✅ done this session (uncommitted) |
| **A6** | Portal sidebar shell + split routes `/patient/{dashboard,appointments,bills,prescriptions,documents,hospitals}` | 🚧 **not started** (one helper file pre-written, see §4) |
| Part B | New backend (favorites, family, patient notifications, settings, refills) + screens + tests | ⏳ not started |
| Enrich | `/public/doctors` & `/public/hospitals` return photo/logo/fees/next-slot | ⏳ not started |
| Gates | api + web tests, full build gate, `provision:demo` smoke | ⏳ not started |

**Safe checkpoint:** `pnpm --filter @hms/web exec tsc --noEmit` → **exit 0**. Nothing half-written.
The existing single-page portal at `apps/web/src/app/patient/dashboard/page.tsx` is **untouched and
still works** — A6 will replace it.

**Not committed.** Working tree has the A4/A5 changes + 2 new component files (below). Commit only
when the human asks; if you do, branch first and end the message with the Co-Authored-By line.

---

## 1. Environment & rituals (do not violate)

- Monorepo (pnpm): `apps/web` (Next 14 App Router), `apps/api` (NestJS), `packages/db` (Prisma+PG),
  `packages/shared`. Ports: **API :4000, Web :4001, Postgres :5433, Redis :6380**. A *different* old
  app may run on 3000/3001/5432/6379 — never touch it.
- **Auth is Firebase-only** (no dev headers). Staff log in at `/login`; patients at `/patient/login`.
  Demo: staff `admin@demo.local` … ; patient `patient@demo.local`; all password `Demo-2026!`.
  Two seeded tenants: **Demo Hospital** (full data) + **Sunrise Clinic** (directory-only).
- **Money is in paise** (minor units) — divide by 100 to display.
- **⚠️ NEVER run `pnpm --filter @hms/web build` while `next dev` is live** — they share
  `apps/web/.next` and the prod build corrupts dev manifests (blanket 404s / stuck "Loading…").
  Web build ritual: **stop dev → `rm -rf apps/web/.next` → build → `rm -rf apps/web/.next` → restart dev.**
  For a fast safe check that does NOT touch `.next`, use **`pnpm --filter @hms/web exec tsc --noEmit`**
  (this is what was used to keep every increment green).
- After editing `packages/shared` or `packages/db`, **rebuild `@hms/shared` + `@hms/db`** before
  `db:seed` / `provision:demo`.

---

## 2. Two Prisma clients & the patient-portal security model (critical for Part B)

- `forTenant(tenantId)` / `tenantTransaction(tenantId, fn)` → non-owner `hms_app` role → **FORCE RLS**.
  Use for all **tenant** reads/writes.
- `platformDb` / `rawPrisma` → owner client → **bypasses RLS**. Allowed ONLY in auth, platform/
  super-admin, and the **public + patient-portal** services in `apps/api/src/patient-public/`.
- **Patient portal endpoints** (`apps/api/src/patient-public/patient-portal.controller.ts`) are
  `@Public()` (bypass staff AuthGuard) and **verify the patient's OWN Firebase token manually**,
  resolve `PatientAuthUser` by uid, then enforce **uid ↔ tenant ↔ patient** via
  `PatientPortalAccess(accessStatus=ACTIVE)` before reading that tenant's `Patient` through
  `forTenant`. Unlinked tenant → **403**, no token → **401**. Documents default
  `visibleToPatient=false`; portal shows only `visibleToPatient=true`. **Read
  `patient-portal.service.ts` + `patient-portal.controller.ts` before extending** — copy the exact
  `assertAccess(uid, tenantId, patientId)` pattern they already use.
- Every destructive/important action: a non-empty `reason` (where destructive) + an `AuditLog` row
  `{ tenantId, actorId, action, entity, entityId, metadata }`. Service pattern elsewhere:
  `scope(ctx) → { db: requireDb(ctx), tenantId, actorId }` then `record(...)`.

---

## 3. HealthConnect design system — conventions ALREADY LOCKED (match these)

Tokens live in `apps/web/tailwind.config.ts`. **Use only defined tokens.** Available:

- Colors: `canvas` (#f7f9fb page bg), `surface` (#fff cards), `line` (borders), `ink` / `ink-muted` /
  `ink-soft` (text), `primary` (+`50/100/500/600/700`), `success`/`warning`/`danger` (each has
  `-bg`/`-fg`), `ink900`.
- Status colors (locked): green=Active/Confirmed/Paid/Verified, red=Unpaid/Cancel/Critical,
  amber=Pending/Due/Under-review.
- Font sizes DEFINED: `display-lg, headline-md, headline-sm, title-lg, body-lg, body-md, body-sm,
  label-md, label-sm`. **`text-display-sm` does NOT exist** — older pages used it (it silently did
  nothing); do not reintroduce undefined tokens.
- Rounded-xl white cards, `border border-line`, Inter font. Two shells: **PublicShell** (top nav) for
  discovery/booking; **portal sidebar shell** (A6) for `/patient/*`.

### Honesty decisions LOCKED (keep across all remaining work)
- **Payments:** never simulate a charge. "Pay" → honest "Pay at clinic / contact the hospital".
- **Ratings/reviews:** none exist → OMIT entirely (no stars, no "(124 reviews)").
- **Distances ("1.2 mi"):** no geolocation → OMIT.
- **"Verified Facility" badge:** no verification flag exists → OMIT.
- **Doctor "X years experience":** no such field → show real `qualifications` instead.
- **Photos/logos:** use real `photoUrl`/`logoUrl` when present, else **initials/icon** (see
  `Avatar` in `directory-ui.tsx`). Never stock photos.
- **Refills:** must be a real request record surfaced to staff — never a fake "refill sent".

### Reusable primitives already written (USE THESE — don't reinvent)
- `apps/web/src/components/patient/booking-ui.tsx` (A1): `BookingChrome`, `BookingStepper`,
  `ProviderCard`, `ServiceOption`, `groupByPartOfDay`.
- `apps/web/src/components/patient/auth-split.tsx` (A1–A3): HealthConnect split layout for
  login/register.
- `apps/web/src/components/patient/directory-ui.tsx` (**A4, new**): `initials`, `Avatar({name,url,
  shape,size})`, `Tag`, `Toggle`, `CheckRow`, `FilterGroup`, `SortSelect`, `ResultsLayout`
  (responsive sidebar + mobile drawer), `Pagination`.
- `apps/web/src/components/patient/portal-ui.tsx` (**A6 pre-work, new, not yet imported**):
  `useData(fn, deps)`, `StatusBadge`, `prettyStatus`, `Loading`, `EmptyState`, `ErrorState`,
  `SubTabs`, `portalMoney`. **A6 should consume these.**
- `apps/web/src/components/public-shell.tsx` (A3): `PublicShell` + `SearchBar`.

### Booking deep-link contract (A5 → wizard)
The doctor-profile sticky widget deep-links into the wizard with pre-selection:
`/book/[tenantId]/[doctorId]?type=<appointmentTypeId>&date=<YYYY-MM-DD>&time=<slot string>&consult=<IN_PERSON|TELEHEALTH>`.
The wizard (`app/book/[tenantId]/[doctorId]/page.tsx`) now reads these via `useSearchParams` and is
wrapped in `<Suspense>` (required by Next 14 for `useSearchParams` in a route page — follow this
pattern for any new route page that reads query params; see `/doctors`, `/hospitals`, `/module-disabled`).

---

## 4. Exactly what changed this session (A4 + A5)

Modified:
- `apps/web/src/lib/public.ts` — added optional fields to `SearchRow`: `photoUrl?`, `logoUrl?`,
  `fees?`, `nextAvailableSlot?` (cards render them only when present; backend doesn't populate them
  yet — that's the "Enrich" task).
- `apps/web/src/app/doctors/page.tsx` — rebuilt: `ResultsLayout` filter sidebar with **real**
  client-side live counts (specialty, language) + Telehealth/Online-booking toggles, rich cards
  (Avatar, specialty, hospital, consult/language tags, Book/View-profile), sort, pagination,
  responsive mobile filter drawer, seeds filters from `?q`/`?city`/`?specialty`. `useSearchParams`
  → inner component + `<Suspense>`.
- `apps/web/src/app/hospitals/page.tsx` — same pattern (filters: City, Services, Telehealth,
  Online-booking; cards with logo/Avatar, location, service tags).
- `apps/web/src/app/doctors/[slug]/page.tsx` — rebuilt: header (Avatar, specialty, qualifications,
  hospital, telehealth/accepting-new tags), About, Education & Credentials, Languages, Services &
  Fees, **sticky `BookingWidget`** that loads REAL slots (`publicApi.bookingSlots`), shows date
  pills + time chips, and on click deep-links into the wizard (contract above). Honest "not bookable
  → call" fallback.
- `apps/web/src/app/hospitals/[slug]/page.tsx` — rebuilt: cover/logo, About, Departments &
  specialties, Key facilities, Services & fees, Top specialists (Avatar cards), Quick Info sidebar
  (Telehealth/Languages/Insurance/Booking — real fields only). **Save Hospital deferred to Part B.**
- `apps/web/src/app/book/[tenantId]/[doctorId]/page.tsx` — refactored to read `?type/date/time/
  consult` and pre-seed the wizard; wrapped default export in `<Suspense>` (`BookPageInner` + wrapper).

New (untracked):
- `apps/web/src/components/patient/directory-ui.tsx`
- `apps/web/src/components/patient/portal-ui.tsx`

All of the above: **`tsc --noEmit` clean.**

---

## 5. A6 — the planned architecture (do this next)

Goal: turn the single tabbed `apps/web/src/app/patient/dashboard/page.tsx` into a **persistent
sidebar-shell + split routes**. Patient portal uses a **separate Firebase auth branch** — do NOT use
`useAuth()`/`<Protected>` (those are staff). Use `getFirebaseAuth()` + `onAuthStateChanged` +
`getFirebaseIdToken()` and the `portalApi` client (`apps/web/src/lib/patient-portal.ts`).

Recommended structure (mirrors how the current dashboard already gates auth):

1. `apps/web/src/app/patient/layout.tsx` (`'use client'`): use `usePathname()`. For
   `/patient/login`, `/patient/register` (and the `/patient` index which just `redirect()`s to
   `/patient/dashboard`) render `{children}` **bare**. Otherwise render `<PortalShell>{children}</PortalShell>`.
   A layout stays mounted across child-route navigation → the shell/context loads `me`+
   `linkedHospitals` **once** (no refetch when switching portal pages).
2. `apps/web/src/components/patient/portal-shell.tsx`: a React context (`PortalProvider`/`usePortal`)
   + the chrome. Move the auth gate, `me`/`linkedHospitals` load, `tenantId` state (persist in
   `localStorage` key **`hms_portal_tenant`**), hospital switcher, and `LinkHospitalModal` here
   (lift them out of the current dashboard page). Expose `{ ready, me, hospitals, tenantId,
   setTenantId, current, refresh, logout, openLinkModal }`.
   - Desktop: left sidebar — header "Patient Portal / Manage your healthcare" + avatar; nav
     **Dashboard, Appointments, Bills, Prescriptions, Documents, Hospitals** (add Family/Settings/
     Care Team/Notifications/Help in Part B); **"+ New Booking"** pinned bottom → `/doctors`.
   - Top bar: page title (derive from pathname map) + sign-out + hospital switcher. (Notifications
     bell is Part B — omit until then so there's no dead control.)
   - Mobile: bottom tab bar (e.g., Dashboard, Appointments, Bills, Documents, Hospitals).
   - `usePortal()` for active `tenantId`/`current` in each page.
3. Split routes (each `'use client'`, consume `usePortal()` + `portalApi` + `portal-ui.tsx`):
   - `app/patient/dashboard/page.tsx` (**replace existing**): Overview — welcome hero (CTA →
     `/doctors`; "Complete Profile" only once Settings exists in Part B), Quick Actions (Find a
     Doctor → `/doctors`, Link Hospital Record → open link modal, Add Family Member → Part B),
     upcoming appointment, recent documents, **rich empty states** (no fake "Upload Document" — our
     model is staff-published docs only; say docs appear when a hospital shares them).
   - `app/patient/appointments/page.tsx`: `SubTabs` Upcoming / Past / Pending / Cancelled; View
     Details, Add to Calendar (reuse the `.ics` builder from the booking page), Directions (maps link
     from hospital address if present). Reschedule/Cancel = **Part B** (needs backend + tenant policy).
   - `app/patient/bills/page.tsx`: `SubTabs` Unpaid / Paid / All; honest "Pay at clinic" (no fake pay).
   - `app/patient/prescriptions/page.tsx`: Active / Completed; "Request Refill" = **Part B**.
   - `app/patient/documents/page.tsx`: search + filter tabs All/Reports/Prescriptions/Bills/Referrals;
     keep the "only hospital-published reports are shown" banner; view/download →
     `portalApi.markDocumentViewed` (already audits view).
   - `app/patient/hospitals/page.tsx`: Choose a Hospital — linked facilities w/ MRN + last visit,
     "Open Portal" (sets active tenant → dashboard), "Link another hospital record" (link modal).
   The current dashboard already contains working `Overview/Appointments/Bills/Reports/Prescriptions/
   Documents/LinkHospitalModal` components — **harvest and split them**, don't rewrite from scratch.

Reference image: `…/stitch_healthconnect_patient_portal_booking_experience 3/patient_dashboard_healthconnect/screen.png`
(and `dashboard_healthconnect`, `my_hospitals_healthconnect`, plus folder-2 `my_health_dashboard`
[mobile], `my_bills_*`, `my_prescriptions_*`, folder-3 `my_documents_healthconnect`).

Keep `tsc --noEmit` green after A6.

---

## 6. Part B — new backend + screens (the heavy lift)

For EACH: schema model(s) → migration → `rls.sql` (if tenant-scoped) → endpoint (token + access guard
+ audit) → screen → seed in `provision-demo.ts` → tests. Read
`apps/api/src/patient-public/patient-portal.{service,controller}.ts` and an existing
`apps/api/test/patient-portal.spec.ts` first to copy the exact patterns.

**Schema/isolation decision rule:** patient-owned, cross-hospital data (favorites, family, patient
notifications, notification prefs) → **GLOBAL model keyed by `uid`**, NOT RLS-enrolled (like
`PatientAuthUser`/`PublicSearchIndex`), scoped by the verified token uid. Hospital-owned clinical data
(refill requests) → **tenant-scoped (RLS)**, written via `forTenant`/`tenantTransaction` after the
portal-access check, and surfaced to staff with permission+module+audit.

Features:
1. **Care Team / favorites** (`/patient/care-team`, design `my_care_team`): models
   `PatientSavedProvider` + `PatientSavedHospital` (global, keyed by uid; store tenantId+doctorId/
   slug + denormalized name/specialty for display). Endpoints `GET/POST/DELETE
   /patient-portal/saved-providers|saved-hospitals`. Save/unsave hearts on directory cards + profiles
   (A4/A5 deliberately omitted the heart — add it here). "Book Again".
2. **Family / dependents** (`/patient/family`, `family_profiles`): `PatientFamilyMember` (global,
   keyed by guardian uid; fullName, relationship, dob, sex). "Add Family Member", "Book for this
   person" (book-on-behalf = pass dependent details into the existing booking-create; the booking
   service already creates a Patient per booking). **Defer cross-hospital dependent record
   aggregation** (call it out). Note the minor-vs-adult consent question — keep simple this phase.
3. **Patient notifications** (`/patient/notifications`, `notifications`): recommend a dedicated
   **global** `PatientNotification` (uid, optional tenantId, category, title, body, actionUrl,
   readAt, createdAt) written from REAL events — booking confirmed/rejected/rescheduled, document
   published, refill status. Do NOT overload the staff `Notification` model (tenant/staff-scoped).
   Endpoints list + mark-read; bell badge in the shell (add the bell in the top bar now).
4. **Settings** (`/patient/settings`, `settings`): Personal Info (edit `PatientAuthUser`
   displayName/mobile/photo — photo only if you wire real storage, else omit the upload), Hospital
   Records (manage `PatientPortalAccess` links / request access / unlink), Security (Firebase change
   password), Notification preferences (small global pref model or JSON on `PatientAuthUser`).
5. **Prescription refill** : tenant-scoped `PrescriptionRefillRequest` (tenantId, patientId, uid,
   prescriptionId, status REQUESTED/APPROVED/REJECTED/DISPENSED, note). Patient creates via portal
   (forTenant after access check, audited). **Staff side:** surface in a pharmacy/reception queue —
   permission-gated + `@RequireModule` + tenant-scoped + audited. (If a staff queue is too big this
   phase, ship the request + an honest "we've notified the clinic" — never fake "refill sent".)
6. **Help & Support** (`/patient/help`, `help_support`): static-but-real contact + FAQ. No dead buttons.
7. **Clinical record / lab-result detail** (`clinical_clarity`): readable view of a published
   `LabOrder`/`LabResult` or `PatientDocument` (published + `visibleToPatient` only), reachable from
   Documents/Reports. Likely `GET /patient-portal/reports/:id` (or reuse existing reports payload).

Migration command (after editing `schema.prisma`):
`pnpm --filter @hms/db exec prisma migrate dev --name phase23_patient_features` → rebuild `@hms/db`
→ add any tenant-scoped tables to the `tenant_tables` array in `packages/db/sql/rls.sql` → apply RLS
(`pnpm --filter @hms/db rls` or psql) → `pnpm --filter @hms/api provision:demo`.

Seed (`apps/api/src/scripts/provision-demo.ts`): give `patient@demo.local` a couple of saved
providers, one family member, 2 notifications, and ensure a **published lab report** exists so every
new screen is demoable with real data.

---

## 7. Public API enrichment (for the richer A4/A5 cards)

`/public/doctors` & `/public/hospitals` currently return `PublicSearchIndex` rows
(`apps/api/src/patient-public/public.service.ts`). They lack `photoUrl/logoUrl/fees`. The web
`SearchRow` type already has these as optional. Recommended (no schema change): in
`PublicService.doctors()/hospitals()`, after the index query, batch-fetch the matching
`PublicDoctorProfile`/`PublicHospitalProfile` and merge `photoUrl`/`logoUrl` (+ a representative
`fees` from default appointment type or `doctor.fees`) into the returned rows — **public-safe only**.
`nextAvailableSlot` (real "next available") needs the slot engine per doctor — heavier; OK to defer.
Cards will light up automatically once the API returns these (UI already handles them).

---

## 8. Tests & gates (keep api 278 / web 276 green, then add)

API (mock `@hms/db` `platformDb`/`forTenant`/`tenantTransaction`, see existing `*.spec.ts`):
- portal isolation regression: unlinked tenant → 403, no token → 401.
- saved-provider add/remove scoped to uid; family book-on-behalf verifies dependent link;
  notifications list scoped to uid; settings profile update; refill request created + audited;
  patient reschedule/cancel honors tenant policy + reason + audit.
- public directory returns the new card fields; booking still creates a real tenant Appointment.

Web:
- route protection for `/patient/*` (redirect to `/patient/login` when unauthenticated); public pages
  render without auth; booking wizard step gating. Consider extracting the inline `tally()` filter
  helper (in `/doctors` and `/hospitals`) to a pure module to unit-test live counts.
- No-fake-data scan stays clean (no ratings/distances/payments).

Full gate run (in order):
```
pnpm --filter @hms/db build
pnpm --filter @hms/db exec prisma validate
pnpm --filter @hms/api build
pnpm --filter @hms/api test
# WEB BUILD: stop next dev → rm -rf apps/web/.next → pnpm --filter @hms/web build → rm -rf apps/web/.next → restart dev
pnpm --filter @hms/web test
pnpm --filter @hms/api provision:demo   # then smoke live with patient@demo.local
```
Fast inner-loop check (safe, no .next impact): `pnpm --filter @hms/web exec tsc --noEmit`.

---

## 9. Live smoke (after work)

`pnpm dev` (logs `/tmp/hms-api-dev.log`, `/tmp/hms-web-dev.log`) → http://localhost:4001 :
- Public: `/` → search → `/doctors` (filters/cards) → `/doctors/[slug]` (sticky widget) → `/book/...`
  → confirmed/pending; `/hospitals` → `/hospitals/[slug]`.
- Portal: `/patient/login` with `patient@demo.local` / `Demo-2026!` → dashboard/appointments/bills/
  prescriptions/documents/hospitals; then Part B screens.
- Isolation: a tenant the patient isn't linked to → 403.

---

## 10. Gotchas
- `useSearchParams` in a route page → wrap in `<Suspense>` (Next 14). Pattern: inner component +
  default export wrapper. See `/doctors`, `/hospitals`, `/book`, `/module-disabled`.
- Patient portal ≠ staff: separate Firebase branch + `portalApi`; never `<Protected>`/`useAuth()`.
- Don't use undefined Tailwind tokens (no `text-display-sm`).
- Money in paise. Destructive → reason + AuditLog. Don't store plaintext passwords.
- `platformDb`/`rawPrisma` only in auth/platform/`patient-public/`; tenant writes via
  `forTenant`/`tenantTransaction`.
- Never web-build while `next dev` is live (see §1).
