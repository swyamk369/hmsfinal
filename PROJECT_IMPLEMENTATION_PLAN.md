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
