# New App Implementation Plan: HMS SaaS From Scratch

## Summary

Build a brand-new production-ready Hospital Management System SaaS in a new repository. The old project will not be reused for implementation. Existing documents can be used only as product reference.

The new app must be a real operational product, not a dashboard prototype or landing page. It must support multi-tenant hospitals, production Firebase Auth, role-based workflows, module entitlements, PostgreSQL RLS tenant isolation, audit logs, billing, lab, pharmacy, inventory, IPD, insurance, and reports.

## Foundation Decisions

- **Repo:** new repository from scratch.
- **Frontend:** Next.js App Router, React, TypeScript, Tailwind.
- **Backend:** NestJS REST API, TypeScript.
- **Database:** PostgreSQL + Prisma.
- **Tenant isolation:** PostgreSQL Row Level Security.
- **Auth:** Firebase Auth only. No dev auth, no fake headers, no impersonation shortcuts.
- **Authorization:** app database controls tenants, roles, permissions, modules, providers, and memberships.
- **Package layout:**
  - `apps/web`
  - `apps/api`
  - `packages/db`
  - `packages/shared`
  - `docs`
  - `infra`

## Non-Negotiable Rules

- No route without authentication unless explicitly public.
- No tenant API without tenant context.
- No module API without module entitlement.
- No user action without permission.
- No clinical or financial hard deletes.
- Destructive actions require a reason.
- Important actions must be audited.
- Super Admin is platform-only.
- Hospital users are tenant-scoped.
- No mock workflows after real API exists.
- No marketing page before the operational product.
- Every module must pass end-to-end workflow proof.

## Phase 0 — New Repo Setup

Build:

- Create new monorepo.
- Add pnpm workspaces.
- Add TypeScript configs.
- Add ESLint, Prettier, test framework, CI skeleton.
- Add Docker Compose for Postgres.
- Add base environment validation.
- Add root scripts:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm test`
  - `pnpm db:migrate`
  - `pnpm db:seed`
  - `pnpm db:rls`

Acceptance:

- Fresh clone installs cleanly.
- API, Web, DB, and shared packages build.
- Postgres starts locally.
- CI runs basic build checks.

## Phase 1 — Product Contract And Canonical Definitions

Build:

- Create final docs in `docs/`.
- Define canonical modules:
  - `ADMIN`
  - `PATIENT`
  - `OPD`
  - `SCHEDULING`
  - `BILLING`
  - `LAB`
  - `PHARMACY`
  - `INVENTORY`
  - `IPD`
  - `INSURANCE`
  - `REPORTS`
- Define plans:
  - `STARTER`
  - `GROWTH`
  - `PROFESSIONAL`
  - `ENTERPRISE`
- Define roles:
  - `SUPER_ADMIN`
  - `HOSPITAL_ADMIN`
  - `HOSPITAL_MANAGER`
  - `RECEPTION`
  - `DOCTOR`
  - `NURSE`
  - `LAB_TECH`
  - `PHARMACIST`
  - `INVENTORY_MGR`
  - `BILLING`
  - `ACCOUNTANT`
  - `INSURANCE_STAFF`
- Define permission matrix.
- Define API route map.
- Define frontend route map.
- Define DB model map.

Acceptance:

- One implementation plan exists as source of truth.
- No old-project continuation language remains.
- No dev-auth flow appears anywhere.

## Phase 2 — Database And RLS Foundation

Build:

- Create Prisma schema from scratch.
- Add platform models:
  - Tenant
  - Plan
  - Subscription
  - ModuleEntitlement
  - PlatformAuditLog
- Add identity/RBAC models:
  - User
  - TenantUser
  - Role
  - Permission
  - RolePermission
  - UserRole
  - Provider
- Add hospital setup models:
  - Facility
  - Department
  - HospitalSettings
  - ServiceCatalog
- Add clinical/operational models for all later modules.
- Add `tenantId` to every tenant-scoped table.
- Add RLS policies for every tenant-scoped table.
- Add immutable audit log protection.
- Add production seed for canonical plans, modules, roles, permissions only.

Acceptance:

- Prisma validate passes.
- Fresh migration deploy passes.
- RLS blocks cross-tenant data.
- Production seed contains no fake users or fake auth shortcuts.

## Phase 3 — Production Auth And Access Control

Build:

- Implement Firebase Admin token verification in API.
- Implement Firebase client auth in Web.
- Add `/auth/me`.
- Add secure Super Admin bootstrap process.
- Add request context:
  - user
  - tenant
  - roles
  - permissions
  - modules
  - providerId
- Add global guards:
  - Auth guard
  - Tenant guard
  - Tenant status guard
  - Permission guard
  - Module guard
  - Platform guard
- Add tenant-scoped Prisma helper using RLS.

Acceptance:

- Missing/invalid token returns 401.
- Valid Firebase user resolves `/auth/me`.
- Wrong tenant membership returns 403.
- Missing permission returns 403.
- Disabled module returns 403.
- Suspended tenant returns 403.

## Phase 4 — Platform SaaS

Build:

- Super Admin login and platform shell.
- Tenant list.
- Create hospital tenant.
- Select plan and modules.
- Bootstrap tenant:
  - subscription
  - entitlements
  - hospital settings
  - roles
  - permissions
  - audit record
- Invite first Hospital Admin.
- Suspend/reactivate tenant.
- Platform audit log.

Frontend routes:

- `/platform`
- `/platform/tenants/[id]`
- `/platform/plans`
- `/platform/audit`

Acceptance:

- Super Admin creates hospital without DB edits.
- Hospital Admin can sign in through Firebase.
- Hospital Admin cannot access platform routes.
- Module toggles update access.
- Platform actions are audited.

## Phase 5 — Hospital Admin Setup

Build:

- Hospital profile.
- Facilities.
- Departments.
- Service catalog.
- Wards and beds.
- Lab catalog setup.
- Insurance provider setup.
- Setup checklist.
- Staff overview.

Frontend routes:

- `/admin`
- `/admin/profile`
- `/admin/facilities`
- `/admin/departments`
- `/admin/catalog`
- `/admin/wards`
- `/admin/lab-catalog`
- `/admin/insurance`

Acceptance:

- Hospital Admin can configure the workspace from UI.
- Disabled module setup sections are hidden.
- Non-admin writes return 403.
- Setup changes are audited.

## Phase 6 — Staff And Provider Management

Build:

- Invite staff through Firebase.
- Assign tenant membership.
- Assign roles.
- Assign departments.
- Create provider profiles for doctors and nurses.
- Deactivate/reactivate staff with reason.
- Password reset flow.
- Current provider profile endpoint.

Frontend routes:

- `/admin/staff`
- `/admin/roles`

Acceptance:

- Doctor invite creates provider profile.
- Nurse invite creates provider profile.
- Non-provider roles do not create provider profiles.
- Deactivated staff cannot access tenant workflows.
- Staff lifecycle actions are audited.

## Phase 7 — Frontend App Shell

Build:

- Login and forgot password.
- Auth provider.
- API client.
- Tenant selector.
- Protected route wrapper.
- Role-aware navigation.
- Module-aware navigation.
- Shared layout.
- Loading, empty, error, and success states.
- Role landing pages.

Role landings:

- `SUPER_ADMIN` -> `/platform`
- `HOSPITAL_ADMIN` -> `/admin`
- `HOSPITAL_MANAGER` -> `/manager`
- `RECEPTION` -> `/reception`
- `DOCTOR` -> `/doctor`
- `NURSE` -> `/nursing`
- `LAB_TECH` -> `/lab`
- `PHARMACIST` -> `/pharmacy`
- `INVENTORY_MGR` -> `/inventory`
- `BILLING` -> `/billing`
- `ACCOUNTANT` -> `/accounts`
- `INSURANCE_STAFF` -> `/insurance`

Acceptance:

- Users land on correct dashboard.
- Navigation hides inaccessible modules.
- Protected routes block wrong role/module/tenant.

## Phase 8 — Starter Workflow: Patient, OPD, Doctor, Billing

Build:

- Patient registration.
- Patient search.
- Patient profile.
- Patient timeline.
- Consent, allergies, history.
- Appointment booking.
- Walk-in check-in.
- OPD queue.
- Doctor consultation.
- Vitals, diagnosis, notes.
- Prescription.
- Bill creation.
- Payment collection.
- Invoice and receipt.
- Cancel/refund/archive with reason.

Frontend routes:

- `/patients`
- `/patients/[id]`
- `/reception`
- `/opd`
- `/opd/appointments`
- `/doctor`
- `/doctor/consult/[encounterId]`
- `/billing`
- `/billing/new`
- `/billing/[id]`
- `/billing/[id]/invoice`

Acceptance:

- Reception registers patient.
- Patient enters OPD queue.
- Doctor completes consultation.
- Bill is created and paid.
- Patient timeline shows the full flow.
- Audit logs exist for important actions.

## Phase 9 — Growth Workflow: Lab

Build:

- Lab test catalog.
- Lab order creation.
- Sample collection.
- Processing status.
- Result entry.
- Abnormal flags.
- Verification.
- Printable report.
- Billing integration.
- Patient timeline integration.
- Doctor result view.

Frontend routes:

- `/lab`
- `/lab/orders/[id]`
- `/lab/reports/[id]`

Acceptance:

- Lab lifecycle is enforced.
- Result appears for doctor and patient.
- Disabled Lab module blocks API and UI.
- Lab report is printable.

## Phase 10 — Growth Workflow: Pharmacy

Build:

- Finalized prescription queue.
- Inventory availability check.
- FEFO dispense flow.
- Partial/missing stock handling.
- Dispense record.
- Pharmacy bill.
- Returns.

Frontend routes:

- `/pharmacy`
- `/pharmacy/dispense/[id]`

Acceptance:

- Dispense fails if stock is missing.
- Successful dispense reduces stock.
- Prescription status updates correctly.
- Bill uses actual dispensed items.

## Phase 11 — Professional Workflow: Inventory

Build:

- Item master.
- Suppliers.
- Purchase orders.
- Stock-in.
- Batches.
- Expiry tracking.
- Low stock alerts.
- Stock adjustment with reason.
- Inventory transaction ledger.

Frontend routes:

- `/inventory`
- `/inventory/items`
- `/inventory/purchases`
- `/inventory/suppliers`
- `/inventory/transactions`

Acceptance:

- Stock ledger is append-only.
- Stock-in creates batch and transaction.
- Adjustments require reason.
- Low stock and expiry alerts work.

## Phase 12 — Professional Workflow: IPD And Nursing

Build:

- Wards.
- Beds.
- Bed occupancy.
- Admission.
- Bed transfer.
- Nursing notes.
- Medication administration.
- Doctor rounds.
- IPD charges.
- Discharge summary.
- Final billing.

Frontend routes:

- `/ipd`
- `/ipd/admit`
- `/ipd/admissions/[id]`
- `/ipd/admissions/[id]/discharge`
- `/ipd/admissions/[id]/summary`
- `/nursing`
- `/nursing/ipd/[admissionId]`

Acceptance:

- Bed cannot be double booked.
- Admission changes bed to occupied.
- Discharge frees bed.
- IPD charges reach billing.
- Discharge summary is printable.

## Phase 13 — Enterprise Workflow: Insurance

Build:

- Insurance providers.
- Patient policies.
- Claim creation.
- Claim status flow.
- Approval/rejection.
- Settlement.
- Patient share calculation.
- Receivables.

Frontend routes:

- `/insurance`
- `/insurance/claims/[id]`
- `/accounts`

Acceptance:

- Claim can be created from bill.
- Rejection requires reason.
- Duplicate settlement is blocked.
- Settlement updates bill and receivables.

## Phase 14 — Reports And Dashboards

Build:

- Role dashboards.
- Operational reports.
- Financial reports.
- Inventory reports.
- Clinical reports.
- Platform usage reports.
- Exportable tables.

Frontend routes:

- `/reports`
- `/reports/operations`
- `/reports/financial`
- `/reports/inventory`
- `/reports/clinical`
- `/manager`

Acceptance:

- Every role has a useful first screen.
- Reports respect tenant, role, permission, and module.
- Disabled modules do not appear in dashboards.

## Phase 15 — Notifications

Build:

- Notification model.
- In-app notifications.
- Email notifications.
- SMS/WhatsApp integration hooks.
- Notification preferences.
- Workflow triggers:
  - appointment confirmation
  - lab result ready
  - payment receipt
  - prescription ready
  - low stock
  - claim update
  - discharge summary ready

Acceptance:

- Notifications are created from real workflow events.
- Users only see tenant-scoped notifications.
- Notification failures do not break core workflow.

## Phase 16 — Audit, Compliance, And Safety

Build:

- Full audit coverage.
- Audit search.
- Reason enforcement.
- Append-only audit protection.
- Support-access policy.
- Data export/offboarding policy.
- Security headers.
- Rate limiting.
- Structured logs.
- Error handling.

Acceptance:

- Every destructive action requires reason.
- Every important action has audit entry.
- Audit logs cannot be modified casually.
- Sensitive data is not logged.

## Phase 17 — Testing

Build tests for:

- Permission mapping.
- Auth.
- Tenant context.
- RLS isolation.
- Module entitlement.
- Platform flows.
- Admin setup.
- Staff lifecycle.
- Patient/OPD/consultation.
- Billing/payment/refund.
- Lab lifecycle.
- Pharmacy dispense.
- Inventory ledger.
- IPD admission/discharge.
- Insurance settlement.
- Frontend route protection.
- Full E2E workflows.

Required E2E proofs:

- Super Admin creates tenant -> invites Hospital Admin -> Admin configures workspace -> invites staff.
- Patient registration -> OPD -> doctor consultation -> billing -> payment.
- Consultation -> lab order -> sample -> result -> report.
- Prescription -> pharmacy dispense -> stock deduction -> bill.
- IPD admit -> bed occupied -> charges -> discharge -> bed available.
- Insurance policy -> claim -> approval -> settlement -> receivables.
- Tenant A cannot access Tenant B data.
- Disabled module blocks API and UI.
- Missing permission returns 403.

Acceptance:

- CI passes from clean checkout.
- RLS tests prove tenant isolation.
- Critical workflows pass E2E.

## Phase 18 — Production Deployment

Build:

- Production Docker setup.
- Environment validation.
- CI/CD.
- Migration deploy process.
- RLS apply process.
- Backup and restore process.
- Health checks.
- Monitoring.
- Error tracking.
- Log aggregation.
- Rollback docs.
- Firebase production setup.
- Domain/CORS setup.

Acceptance:

- Clean production-like deployment works.
- New hospital can be onboarded from UI.
- Core workflows work in production environment.
- Backups and rollback are documented.
- Health checks include API and DB connectivity.

## Phase 21 — Revenue Cycle Hardening

Builds on the Phase 20 unified Finance module (the `BillableCharge` ledger, bills,
payments, refunds, day-close, approvals). Goal: eliminate revenue leakage and make
billing automatic, payer-aware, and audit-clean across every module — the way a
best-in-class hospital information system bills.

**Locked decisions (do not re-litigate):**

- Bed/room days are counted by **calendar day (midnight census)** — count distinct
  calendar dates the patient occupied a bed. Configurable per tenant.
- The per-day room rate lives on **`Ward.dailyRate`** (minor units), with an optional
  link to a `ServiceCatalog` BED item for name/tax.
- All new charges flow through the existing `BillableCharge` ledger and audit — never
  a parallel billing path.
- Every sub-phase must meet the Completion Standard (API, UI, RBAC, module entitlement,
  tenant isolation, audit, reason enforcement, tests, E2E, production build).

**Recommended accrual rollout (answers "best for seamless day-to-day ops"):**

1. Ship **at-discharge true-up** + **on-demand "post bed charges" button** first — no
   scheduler needed, immediately usable, idempotent via a watermark.
2. Add **nightly auto-accrual** (a midnight census job over all `ADMITTED` admissions)
   as the target state once a scheduler exists — this is the seamless ideal: room
   charges simply appear each day, the running balance is always current, and no
   cashier ever has to remember. The watermark makes all three mechanisms safe to run
   together without double-charging.

### Phase 21.1 — Per-diem bed/room charging ✅ DONE (2026-06-11)

Build:

- Schema: `Ward.dailyRate` (Int, minor units, default 0) + optional `Ward.chargeCatalogId`;
  `Admission.bedChargedThrough` (DateTime?, idempotency watermark); `HospitalSettings`
  IPD policy fields — `ipdDayBasis` (default `CALENDAR_DAY`), `ipdChargeAdmissionDay`
  (default true), `ipdChargeDischargeDay` (default false), `ipdMinUnits` (default 1).
- Pure, exported, unit-tested helper `apps/api/src/ipd/bed-charges.ts`: rebuild
  occupancy segments from `admittedAt` → each `BedTransfer.transferredAt` →
  (`dischargedAt` ?? now), map each segment's bed → ward → rate, compute calendar-day
  units per the policy, and subtract whatever the watermark already covered.
- `IpdService.accrueBedCharges(ctx, admissionId, asOf?)`: posts one `BillableCharge`
  per ward segment (`sourceModule: IPD`, `sourceType: BED_CHARGE`) into the running
  IPD bill, audits `charge.create`, and advances `bedChargedThrough` — all inside a
  `tenantTransaction`. Idempotent.
- Wire accrual into `IpdService.discharge()` (final true-up before the bed is freed).
- Migration + verify RLS still covers `ward`/`admission` (new columns only, no new
  tables). Seed demo ward rates + settings defaults.

Frontend routes:

- `/admin/wards` (or `/ipd/wards`) — ward daily-rate field.
- `/ipd/admissions/[id]` — bed-day preview + "Post bed charges now" action on the
  charges tab; discharge screen shows the accrued room total.

API endpoints:

- `POST /ipd/admissions/:id/accrue-bed-charges` (interim, `ipd.charge.write`).

Acceptance:

- A 3-calendar-day stay posts 3 bed-days at the ward rate (per admission/discharge-day
  policy).
- An ICU → PRIVATE transfer splits the stay and bills each segment at its own ward rate.
- Re-running accrual (interim, then discharge) never double-charges.
- A same-day admit/discharge bills the configured minimum (1 day).
- Bed charges reach the IPD bill, the `BillableCharge` ledger, and audit.

### Phase 21.2 — Revenue-leakage reconciliation (highest ROI) ✅ DONE (2026-06-11)

Build:

- A finance reconciliation service that cross-checks clinical events against charges:
  `COMPLETED` lab orders with no billed charge, dispenses with no bill, admitted
  bed-days not yet accrued (uses 21.1's watermark vs today), completed encounters/
  procedures with no consultation/procedure charge. Returns leakage rows with deep
  links and a one-click "post charge" action.

Frontend routes:

- `/finance/leakage`.

API endpoints:

- `GET /finance/leakage`.

Acceptance:

- A completed, unbilled lab order appears in the report; posting the charge clears it.
- Respects tenant isolation, permissions, and module entitlement.

### Phase 21.3 — Payer-specific tariffs / rate plans

Build:

- `PriceList` (name, payerType, active) + `PriceListItem` (catalogId, price, taxRate).
- Resolve the unit price by the patient's payer (cash vs policy/TPA/corporate/scheme)
  at charge time, falling back to `ServiceCatalog.price`.

Frontend routes:

- `/admin/price-lists`.

Acceptance:

- The same service prices differently per payer; cash fallback works when no list
  matches.

### Phase 21.4 — Advance deposits and estimates

Build:

- A patient/admission **advance-deposit** ledger (money taken before/at admission, held
  as credit, auto-applied against bills, refundable balance on discharge).
- An **estimate** model: pre-admission/pre-procedure cost projection, printable.

Frontend routes:

- Deposit capture on `/ipd/admit` and the patient account; estimate generator under
  `/finance/estimates`.

API endpoints:

- `GET/POST /finance/deposits`, `POST /finance/deposits/:id/refund` (reason required),
  `GET/POST /finance/estimates`.

Acceptance:

- A deposit reduces patient outstanding and is auto-applied to the final bill.
- Unused deposit is refundable on discharge with reason + audit.

### Phase 21.5 — Discount, refund, and write-off governance

Build:

- Configurable thresholds in `HospitalSettings` (discount %, refund amount, write-off
  amount). A request above threshold auto-creates a `FinanceApproval` and blocks the
  action until approved; below threshold auto-approves. (Closes the Phase 20 known gap.)
- Implement the `WRITE_OFF` execution path: zero the bill's outstanding balance without
  cash movement, with reason + audit.

Acceptance:

- A refund above the threshold requires approval before it executes.
- A write-off clears outstanding, leaves a credit/write-off trail, and is audited.

### Phase 21.6 — GST-compliant invoices

Build:

- Tax fields on `BillItem` (taxableValue, taxRate, taxAmount, hsnSac); bill-level
  CGST/SGST/IGST split + a `roundOff` line on `Bill`.
- Invoice print view shows hospital GSTIN, per-item tax, HSN/SAC, and tax totals.

Acceptance:

- The invoice shows per-item taxable value + tax and balanced totals with rounding.

### Phase 21.7 — Package / bundled billing

Build:

- A `Package` definition (fixed price, included services, included bed-days) and
  package-aware billing that suppresses included charges and bills only the extras.
  (Concretizes the "Package Billing" item in Future Direction.)

Acceptance:

- A package admission bills the package price; out-of-package items are billed
  separately and visible.

### Phase 21.8 — Day-close locking

Build:

- Block payments/refunds dated into a `CLOSED` business date unless the day is reopened
  (reopen already requires approval). Day-close becomes a true financial lock, not just
  a report.

Acceptance:

- A back-dated payment into a closed business date is rejected with a clear error.

### Phase 21.9 — Revenue-cycle polish

Build:

- Bill-time **payer split** (co-pay %, non-payable items → patient-responsible vs
  payer-responsible) computed up front, feeding insurance receivables.
- **Credit notes** as a first-class adjustment (own financial-year number series) vs
  cash refunds.
- **Charge-posting idempotency keys** on `(sourceModule, sourceId)` so workflow retries
  cannot duplicate charges.
- **Dues aging** (0-30 / 30-60 / 60-90) on the patient statement and a printable
  consolidated patient statement.

Acceptance:

- A bill shows patient-share vs payer-share before any settlement.
- Re-posting the same source event does not create a duplicate charge.
- The patient statement prints with aged outstanding buckets.

## Future Direction — Post-Core Expansion After Phase 18

These items are intentionally deferred until the production HMS core is complete, tested, deployed, and stable. They must not interrupt or reorder Phases 0-18.

Future expansion priorities:

- **Patient Portal + Online Booking:** Patient accounts, family profiles, public doctor/hospital search, online appointment booking, intake forms, reminders, patient records, bills, prescriptions, lab reports, and secure messages.
- **OT / Procedure Module:** Operation theatre scheduling, surgical teams, anesthesia notes, procedure notes, surgical checklists, OT consumables, procedure charges, and post-operative records.
- **Radiology / Imaging:** Imaging orders, modality scheduling, radiology reporting, report print views, and future PACS/DICOM integration.
- **Emergency / Triage:** Emergency registration, ambulance inbound handoff, triage scoring, trauma bay status, critical alerts, and emergency queue.
- **Document And Consent Management:** Digital consent forms, scanned documents, ID proofs, signatures, version history, medico-legal document tagging, and record release workflows.
- **Queue Display / Kiosk:** Self check-in kiosk, QR/token generation, department-wise public display boards, patient arrival status, and queue notifications.
- **Approval Workflows:** Discount approvals, refund approvals, purchase approvals, discharge clearance, claim approvals, and configurable approval chains.
- **TPA / Corporate / Package Billing:** Corporate contracts, payer-specific price lists, package billing, credit billing, TPA approvals, denial management, and receivables.
- **Housekeeping / Facility / Biomedical:** Bed cleaning requests, room readiness, facility service tickets, biomedical equipment assets, calibration, AMC/warranty, and maintenance history.
- **AI Layer:** Doctor AI scribe, multilingual consultation transcription, patient timeline summarization, prescription/lab/discharge draft assistants, billing/insurance helpers, nursing handoff summaries, inventory forecasting, manager insights, and patient-facing assistant.

Post-core rules:

- AI and patient-facing features must be added only after the transactional HMS workflows are trusted.
- AI may draft, summarize, suggest, and assist, but clinicians and staff must approve final clinical, financial, and operational records.
- Patient-facing booking must create real tenant appointments and respect provider availability, module entitlements, tenant status, and audit requirements.
- Public discovery pages must not expose private tenant or patient data.
- Every post-core module must follow the same completion standard: API, UI, RBAC, module entitlement, tenant isolation, audit, tests, and E2E proof.

## Public API Rules

Every tenant endpoint must enforce:

- Firebase-authenticated user.
- Active app user.
- Active tenant membership.
- Active tenant status.
- Permission.
- Module entitlement.
- RLS-scoped DB access.

Destructive endpoints require:

```json
{
  "reason": "Non-empty reason"
}
```

## Completion Standard

A module is complete only when:

- API works.
- UI works.
- RBAC works.
- Module entitlement works.
- Tenant isolation is proven.
- Audit logs exist.
- Reason fields are enforced.
- Print/export views work where needed.
- E2E workflow passes.
- Production build passes.

## What Not To Build First

Do not start with:

- marketing landing page
- AI assistant
- fake analytics
- decorative dashboards
- pharmacy without inventory
- lab without lifecycle
- IPD bed grid without admission/discharge
- insurance without settlement
- public API before auth/rate-limit/audit

First real product target:

- tenant onboarding
- hospital setup
- staff invite
- patient registration
- appointment/walk-in
- OPD queue
- doctor consultation
- billing
- payment
- invoice/receipt
- audit
- role dashboards

## Assumptions

- This will be a brand-new repository.
- No implementation code from the old project will be reused.
- Old documents are reference only.
- Firebase Auth is mandatory.
- Production readiness is required from the beginning.
- `PROJECT_IMPLEMENTATION_PLAN.md` is updated with this plan after approval.
