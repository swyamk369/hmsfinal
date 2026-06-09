# HMS SaaS New App Build Master Plan

**Purpose:** Master implementation handoff for rebuilding HMS SaaS from scratch.  
**Audience:** Human developers, Claude, Codex, and any future AI agent working on the project.  
**Mode:** Planning/documentation only until Phase 0 is approved.  
**Source documents:** `NEW_APP_PRODUCT_SPEC.md`, `PROJECT_IMPLEMENTATION_PLAN.md`, `AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md`, `CLAUDE.md`, `PROJECT_CONTEXT.md`, and the comparable HMS SaaS market research.

---

## 1. What We Are Building

We are building a production-ready, multi-tenant hospital operating system SaaS.

The product is not a generic EMR and not a marketing landing page. It is operational software for clinics, specialty centers, day-care hospitals, multi-site outpatient groups, and 20-150 bed hospitals that need:

- fast registration-to-billing workflows
- role-based access
- modular pricing and module entitlements
- tenant-isolated hospital workspaces
- OPD and doctor consultation
- billing, payments, invoices, receipts, and refunds
- lab, pharmacy, inventory, IPD, and insurance workflows as growth modules
- auditability for clinical, financial, staff, tenant, and security actions
- production-grade onboarding, testing, integrations, and deployment

The first product screen after login must be the role dashboard. Do not build a marketing landing page first.

---

## 2. Market Gap And Positioning

### Market Gap

The market splits into three imperfect groups:

1. **Regional hospital/HMIS products** have workflow breadth but weaker public documentation, API posture, pricing transparency, and review-backed support.
2. **Ambulatory EHR/practice-management SaaS products** have stronger UX, billing, patient engagement, APIs, and commercial maturity, but often lack inpatient, ward, inventory, procurement, and TPA/insurance depth.
3. **Enterprise hospital suites** have hospital depth but are expensive, slow to implement, quote-led, and unsuitable for many smaller hospitals.

The whitespace is a modular, fast-to-deploy, clinic-to-small-hospital operating system that combines operational breadth with transparent SaaS packaging.

### Product Positioning

> A modern hospital operating system for clinics, specialty centers, day-care hospitals, and small hospitals that need faster registration-to-billing workflows, modular pricing, role-based access, auditability, and real operational depth.

### Strategy

- Start with OPD, patient administration, scheduling, billing, payments, receipts, notifications, basic reports, and audit logs.
- Expand into lab and pharmacy.
- Then add inventory/procurement and IPD.
- Then add insurance/TPA, reports, public APIs, integrations, migration tools, and enterprise controls.
- Do not lead with AI. AI can come later for notes, coding assistance, denial risk suggestions, and workflow acceleration after the transactional core is trusted.

---

## 3. Non-Negotiable Build Rules

1. No route without authentication.
2. No tenant API without tenant context.
3. No module API without module entitlement.
4. No role action without permission.
5. No clinical or financial hard deletes.
6. Every destructive action requires a reason.
7. Audit logs are required for clinical, financial, staff, tenant, module, and security actions.
8. No hardcoded tenant IDs, user IDs, provider IDs, module access, or plan assumptions.
9. No mock data once API exists.
10. No placeholder dashboards.
11. No module is complete without E2E proof.
12. No frontend page should make role, tenant, or module decisions from stale first-tenant assumptions.
13. Super Admin is platform-only by default and cannot casually edit tenant clinical data without audited support mode.
14. Hospital Admin is tenant-only and must never access platform routes.
15. Every phase must pass build, schema, seed, and relevant test gates before the next phase begins.

---

## 4. Master Module List

| Code | Module | Purpose | Build Package |
|---|---|---|---|
| `ADMIN` | Hospital Admin Setup | workspace config, staff, roles, catalog, departments | Foundation/Starter |
| `PATIENT` | Patient Records | registration, demographics, consent, timeline | Starter |
| `OPD` | OPD and Consultation | appointments, queue, encounters, consultation | Starter |
| `SCHEDULING` | Scheduling | doctor schedules and slots | Starter |
| `BILLING` | Billing and Payments | bills, payments, invoices, receipts, refunds | Starter |
| `LAB` | Laboratory | orders, samples, results, reports | Growth |
| `PHARMACY` | Pharmacy | prescriptions, dispense, pharmacy billing | Growth |
| `INVENTORY` | Inventory | stock, batches, suppliers, purchase, adjustments | Professional |
| `IPD` | Inpatient | wards, beds, admissions, rounds, discharge | Professional |
| `INSURANCE` | Insurance/TPA | policies, claims, settlement, receivables | Enterprise |
| `REPORTS` | Reports | operational, clinical, financial, inventory analytics | Professional/Enterprise |

Rules:

- `ADMIN` is enabled for every tenant.
- `SCHEDULING` is enabled whenever `OPD` is enabled.
- `INVENTORY` and `PHARMACY` are separate.
- Disabled modules must be hidden in the UI and blocked by the API.

---

## 5. Roles And Dashboards

| Role | Landing | Dashboard Focus | Primary Owner |
|---|---|---|---|
| `SUPER_ADMIN` | `/platform` | tenants, plans, modules, usage, audit | Developer 1 |
| `HOSPITAL_ADMIN` | `/admin` | setup checklist, staff, configuration, operations summary | Developer 1 |
| `HOSPITAL_MANAGER` | `/manager` | operational overview, reports, non-destructive monitoring | Developer 1 |
| `RECEPTION` | `/reception` | patient registration, appointments, OPD queue | Developer 2 |
| `DOCTOR` | `/doctor` | consultation queue, patient history, clinical work | Developer 2 |
| `NURSE` | `/nursing` | assigned patients, vitals, IPD care | Developer 2 |
| `LAB_TECH` | `/lab` | pending samples, results, reports | Developer 2 |
| `PHARMACIST` | `/pharmacy` | prescriptions to dispense, stock availability | Developer 2 |
| `INVENTORY_MGR` | `/inventory` | low stock, expiry, purchasing, stock ledger | Developer 2 |
| `BILLING` | `/billing` | bills, payments, receipts, receivables | Developer 2 |
| `ACCOUNTANT` | `/accounts` | financial reports, refunds, reconciliation | Developer 2 |
| `INSURANCE_STAFF` | `/insurance` | claims, settlements, receivables | Developer 2 |

---

## 6. Permission Model

Every tenant endpoint must pass:

1. Auth guard
2. Tenant context guard
3. Tenant status guard
4. Module entitlement guard
5. Permission guard

### Permission Groups

Platform:

- `platform.tenant.read`
- `platform.tenant.create`
- `platform.tenant.update`
- `platform.tenant.suspend`
- `platform.modules.manage`
- `platform.plans.manage`
- `platform.admin.invite`
- `platform.audit.read`

Hospital setup and staff:

- `settings.read`
- `settings.manage`
- `facility.read`
- `facility.write`
- `department.read`
- `department.write`
- `role.read`
- `role.write`
- `staff.read`
- `staff.invite`
- `staff.update`
- `staff.deactivate`
- `staff.reset_password`

Patient and OPD:

- `patient.read`
- `patient.write`
- `patient.archive`
- `patient.timeline.read`
- `patient.consent.manage`
- `appointment.read`
- `appointment.write`
- `appointment.cancel`
- `appointment.reschedule`
- `queue.read`
- `queue.manage`

Clinical:

- `encounter.read`
- `encounter.write`
- `consultation.read`
- `consultation.write`
- `clinical_note.write`
- `vitals.read`
- `vitals.write`
- `diagnosis.write`
- `followup.write`
- `prescription.read`
- `prescription.write`
- `prescription.finalize`

Nursing:

- `nursing.read`
- `nursing.note.write`
- `medication.administer`

Lab:

- `lab.catalog.manage`
- `lab.order`
- `lab.read`
- `lab.sample.collect`
- `lab.result.enter`
- `lab.result.verify`
- `lab.report.print`

Pharmacy and inventory:

- `pharmacy.read`
- `pharmacy.dispense`
- `pharmacy.return`
- `inventory.read`
- `inventory.item.write`
- `inventory.stock_in`
- `inventory.stock_out`
- `inventory.adjust`
- `inventory.supplier.manage`
- `inventory.purchase.manage`
- `inventory.reports.read`

Billing and accounts:

- `bill.read`
- `bill.write`
- `bill.cancel`
- `invoice.print`
- `payment.collect`
- `payment.refund`
- `reports.financial.read`

IPD:

- `ipd.read`
- `ipd.admit`
- `ipd.transfer`
- `ipd.discharge`
- `ipd.round.write`
- `ipd.charge.write`
- `ward.manage`
- `bed.manage`

Insurance:

- `insurance.read`
- `insurance.provider.manage`
- `insurance.policy.manage`
- `insurance.claim.create`
- `insurance.claim.update`
- `insurance.claim.approve`
- `insurance.claim.settle`

Reports:

- `reports.read`
- `reports.operational.read`
- `reports.clinical.read`
- `reports.inventory.read`

### Role Permission Summary

| Role | Permission Summary |
|---|---|
| `SUPER_ADMIN` | All `platform.*`; no tenant clinical edit access except audited support mode |
| `HOSPITAL_ADMIN` | All tenant permissions for enabled modules |
| `HOSPITAL_MANAGER` | Read operational, clinical summary, financial summary, inventory summary; no destructive defaults |
| `RECEPTION` | patient registration, appointments, queue, basic encounter read/write, basic billing/payment |
| `DOCTOR` | patient read/timeline, consultation, notes, vitals, diagnosis, prescription, lab order, IPD request |
| `NURSE` | patient read, vitals, nursing notes, medication administration, IPD care |
| `LAB_TECH` | lab order work queue, sample collection, result entry, verification, report print |
| `PHARMACIST` | prescription read, stock availability, dispense, stock out, pharmacy billing |
| `INVENTORY_MGR` | item, supplier, purchase, stock in/out, adjustment, reports |
| `BILLING` | bill, invoice, payment collection, refund where allowed, receivables |
| `ACCOUNTANT` | financial reports, refunds, reconciliation, insurance read |
| `INSURANCE_STAFF` | policies, claims, approvals, settlements, insurance receivables |

---

## 7. Database Blueprint

The new app database must be designed around tenant isolation, complete workflows, and auditability.

### Platform And SaaS

- `Tenant`
- `Plan`
- `Subscription`
- `ModuleEntitlement`
- `PlatformAuditLog`

### Identity And RBAC

- `User`
- `TenantUser`
- `Role`
- `Permission`
- `RolePermission`
- `UserRole`
- `Provider`

### Hospital Setup

- `Facility`
- `Department`
- `HospitalSettings`
- `ServiceCatalog`

### Patient

- `Patient`
- `PatientIdentifier`
- `Consent`
- `MedicalHistory`
- `Allergy`

### OPD And Clinical

- `Appointment`
- `Encounter`
- `Vitals`
- `Diagnosis`
- `ClinicalNote`
- `Prescription`
- `PrescriptionItem`

### Nursing

- `NursingNote`
- `MedicationAdministration`

### Lab

- `LabTestCatalog`
- `LabOrder`
- `LabOrderItem`
- `LabSample`
- `LabResult`

### Pharmacy And Inventory

- `InventoryItem`
- `Supplier`
- `InventoryBatch`
- `PurchaseOrder`
- `PurchaseOrderItem`
- `InventoryTransaction`
- `DispenseRecord`
- `DispenseItem`

### Billing

- `Bill`
- `BillItem`
- `Payment`
- `Refund`

### IPD

- `Ward`
- `Bed`
- `Admission`
- `BedTransfer`
- `IpdRound`
- `IpdCharge`
- `DischargeSummary`

### Insurance

- `InsuranceProvider`
- `PatientInsurancePolicy`
- `InsuranceClaim`
- `ClaimSettlement`

### Audit

- `AuditLog`

Database rules:

- Every tenant-scoped table has `tenantId`.
- Clinical and financial records support soft archive/cancel states.
- Destructive/irreversible workflow records include reason metadata.
- Ledger-style tables are append-only where appropriate.
- Every migration has a named Prisma migration and rollback note.

---

## 8. API Blueprint

All endpoint groups must be implemented with DTO validation, permission decorators, module decorators, tenant context, audit hooks where needed, and documented response shapes.

### Auth

- `GET /auth/me`
- `POST /auth/logout`

### Platform

- `GET /platform/tenants`
- `POST /platform/tenants`
- `GET /platform/tenants/:id`
- `POST /platform/tenants/:id/suspend`
- `POST /platform/tenants/:id/activate`
- `GET /platform/tenants/:id/modules`
- `POST /platform/tenants/:id/modules`
- `POST /platform/tenants/:id/invite-admin`
- `GET /platform/audit`

### Admin Setup

- `GET /admin/overview`
- `GET/PATCH /admin/profile`
- `GET/POST /admin/facilities`
- `GET/POST /admin/departments`
- `GET/POST/PATCH /admin/catalog`
- `GET/POST/PATCH /admin/wards`
- `GET/POST/PATCH /admin/beds`

### Staff

- `GET /staff`
- `POST /staff`
- `PATCH /staff/:id`
- `PATCH /staff/:id/roles`
- `POST /staff/:id/deactivate`
- `POST /staff/:id/reactivate`
- `POST /staff/:id/reset-password`
- `GET /providers/me`

### Patients

- `GET /patients`
- `POST /patients`
- `GET /patients/:id`
- `PATCH /patients/:id`
- `DELETE /patients/:id`
- `GET /patients/:id/timeline`
- `POST /patients/:id/consents`
- `POST /patients/:id/allergies`
- `POST /patients/:id/history`

### OPD And Consultation

- `GET /appointments`
- `POST /appointments`
- `PATCH /appointments/:id`
- `POST /appointments/:id/cancel`
- `GET /encounters`
- `POST /encounters`
- `GET /encounters/queue`
- `POST /encounters/:id/checkin`
- `POST /encounters/:id/start`
- `GET /encounters/:id/detail`
- `POST /encounters/:id/vitals`
- `POST /encounters/:id/diagnoses`
- `POST /encounters/:id/notes`
- `POST /encounters/:id/lab-orders`
- `POST /encounters/:id/complete`

### Prescriptions

- `GET /encounters/:id/prescriptions`
- `POST /encounters/:id/prescriptions`
- `POST /prescriptions/:id/finalize`
- `GET /prescriptions/:id`

### Lab

- `GET/POST /lab/catalog`
- `GET /lab/orders`
- `POST /lab/orders`
- `GET /lab/orders/:id`
- `POST /lab/orders/:id/sample`
- `PATCH /lab/orders/:id/status`
- `POST /lab/orders/:id/results`
- `POST /lab/results/:id/verify`
- `GET /lab/reports/:id`

### Pharmacy

- `GET /pharmacy/prescriptions`
- `GET /pharmacy/prescriptions/:id/availability`
- `POST /pharmacy/prescriptions/:id/dispense`
- `POST /pharmacy/returns`

### Inventory

- `GET/POST /inventory/items`
- `PATCH /inventory/items/:id`
- `GET/POST /inventory/suppliers`
- `GET/POST /inventory/purchases`
- `POST /inventory/batches`
- `POST /inventory/adjustments`
- `GET /inventory/alerts`
- `GET /inventory/transactions`

### Billing

- `GET /billing/catalog`
- `GET /billing/bills`
- `POST /billing/bills`
- `GET /billing/bills/:id`
- `POST /billing/bills/:id/payments`
- `POST /billing/bills/:id/cancel`
- `POST /billing/bills/:id/refunds`
- `GET /billing/bills/:id/invoice`
- `GET /billing/stats`

### IPD

- `GET/POST /ipd/wards`
- `GET/POST /ipd/beds`
- `GET /ipd/occupancy`
- `POST /ipd/admissions`
- `GET /ipd/admissions/:id`
- `POST /ipd/admissions/:id/transfer`
- `POST /ipd/admissions/:id/rounds`
- `POST /ipd/admissions/:id/charges`
- `POST /ipd/admissions/:id/discharge`
- `GET /ipd/admissions/:id/summary`

### Insurance

- `GET/POST /insurance/providers`
- `GET/POST /insurance/policies`
- `GET /insurance/claims`
- `POST /insurance/claims`
- `GET /insurance/claims/:id`
- `PATCH /insurance/claims/:id/status`
- `POST /insurance/claims/:id/settle`
- `GET /insurance/receivables`

### Reports

- `GET /reports/operations`
- `GET /reports/financial`
- `GET /reports/inventory`
- `GET /reports/clinical`

---

## 9. Frontend Route Blueprint

### Public

- `/login`
- `/forgot-password`

### Platform

- `/platform`
- `/platform/tenants/[id]`
- `/platform/plans`
- `/platform/audit`

### Hospital Admin

- `/admin`
- `/admin/profile`
- `/admin/facilities`
- `/admin/departments`
- `/admin/staff`
- `/admin/roles`
- `/admin/catalog`
- `/admin/wards`
- `/admin/lab-catalog`
- `/admin/insurance`

### Patient And OPD

- `/patients`
- `/patients/[id]`
- `/reception`
- `/opd`
- `/opd/appointments`

### Clinical

- `/doctor`
- `/doctor/consult/[encounterId]`
- `/nursing`
- `/nursing/ipd/[admissionId]`

### Lab

- `/lab`
- `/lab/orders/[id]`
- `/lab/reports/[id]`

### Pharmacy And Inventory

- `/pharmacy`
- `/pharmacy/dispense/[id]`
- `/inventory`
- `/inventory/items`
- `/inventory/purchases`
- `/inventory/suppliers`
- `/inventory/transactions`

### Billing And Insurance

- `/billing`
- `/billing/new`
- `/billing/[id]`
- `/billing/[id]/invoice`
- `/accounts`
- `/insurance`
- `/insurance/claims/[id]`

### IPD

- `/ipd`
- `/ipd/admit`
- `/ipd/admissions/[id]`
- `/ipd/admissions/[id]/discharge`
- `/ipd/admissions/[id]/summary`

### Reports

- `/reports`
- `/reports/operations`
- `/reports/financial`
- `/reports/inventory`
- `/reports/clinical`

Frontend rules:

- Every page uses a role/module-aware layout.
- Every route has loading, empty, error, and success states.
- Do not add visible explanatory copy about app features in operational UI. Build the actual controls.
- Use dense, professional operational layouts for repeated work.
- Avoid decorative marketing-style pages during product build.

---

## 10. Complete Application Flows

### 10.1 SaaS Tenant Onboarding

1. Super Admin logs in.
2. Opens `/platform`.
3. Creates hospital workspace.
4. Selects plan and modules.
5. System creates tenant, subscription, entitlements, roles, permissions, and audit records.
6. Super Admin invites first Hospital Admin.
7. System creates Firebase user and app user.
8. System links user to tenant and assigns `HOSPITAL_ADMIN`.
9. Hospital Admin logs in and lands on `/admin`.
10. Hospital Admin cannot access `/platform`.

### 10.2 Hospital Workspace Setup

1. Hospital Admin opens `/admin`.
2. Completes setup checklist.
3. Configures profile, facilities, departments, service catalog, schedules.
4. Configures module-specific setup only for enabled modules.
5. Invites staff and assigns roles/departments.
6. System creates provider profiles for doctors and nurses.

### 10.3 Login And Routing

1. User logs in.
2. App calls `/auth/me`.
3. API returns active tenant memberships, roles, permissions, modules, and provider data.
4. App routes user to role landing page.
5. Navigation is filtered by role, permission, module, and tenant status.

### 10.4 Patient Registration

1. Reception searches by MRN, name, or phone.
2. If patient exists, select patient.
3. If not, register patient with demographics, identifiers, and consent.
4. System assigns MRN.
5. Patient profile and timeline are available.

### 10.5 Appointment Or Walk-In

1. Reception selects patient.
2. Selects walk-in or scheduled appointment.
3. Selects department and doctor.
4. System checks schedule.
5. For walk-in, system checks in immediately and generates token.
6. Patient appears in OPD queue.

### 10.6 OPD Queue

1. Reception monitors waiting, in-consultation, completed, canceled patients.
2. Doctor sees assigned queue.
3. Allowed users can check in, cancel, reschedule, or reassign.
4. Queue state updates in real time or near-real time.

### 10.7 Doctor Consultation

1. Doctor starts encounter.
2. Doctor reviews patient history.
3. Doctor records vitals, diagnosis, notes, prescription, lab order, follow-up.
4. Doctor may request IPD admission.
5. Doctor completes consultation.
6. Billing/lab/pharmacy downstream records are created where appropriate.

### 10.8 Prescription To Pharmacy

1. Doctor finalizes prescription.
2. Pharmacist sees prescription.
3. System checks inventory availability.
4. Pharmacist dispenses from FEFO batches.
5. Stock decreases.
6. Dispense record and pharmacy bill are created.
7. Prescription becomes dispensed.

### 10.9 Lab Order To Result

1. Doctor or reception creates lab order.
2. Lab collects sample.
3. Lab processes sample.
4. Lab enters result, reference range, abnormal flag, notes.
5. Lab verifies/finalizes.
6. Doctor sees result.
7. Patient timeline and bill update.

### 10.10 Billing And Payments

1. Bill is created from consultation, lab, pharmacy, IPD, or manual flow.
2. Billing collects payment.
3. Invoice/receipt is generated.
4. Partial payment, refund, and cancel flows are supported.
5. Refund/cancel require reason and audit.

### 10.11 Inventory And Procurement

1. Inventory Manager creates supplier.
2. Adds inventory item.
3. Records purchase/stock-in.
4. Creates batch with expiry and price.
5. Pharmacy dispense reduces stock.
6. Adjustments require reason.
7. Low stock and expiry alerts update.

### 10.12 IPD Admission To Discharge

1. Doctor/reception creates admission.
2. IPD assigns bed.
3. Bed becomes occupied.
4. Nurses record vitals and notes.
5. Doctors record rounds.
6. Charges accumulate.
7. Discharge summary is prepared.
8. Final bill is settled.
9. Patient is discharged and bed becomes available.

### 10.13 Insurance/TPA Claim Settlement

1. Insurance policy is added.
2. Claim is created against bill/admission.
3. Claim is approved or rejected.
4. Approved amount and patient share are calculated.
5. Insurance payment is posted.
6. Duplicate settlement is blocked.

### 10.14 Reports

1. Each role sees relevant dashboard.
2. Admin sees operations, revenue, beds, labs, inventory, claims.
3. Platform sees tenants, modules, usage, subscriptions.
4. Reports respect tenant, module, role, and permission.

### 10.15 Notifications

Send notifications for:

- appointment confirmation/reminder
- queue/token update
- payment receipt
- lab result ready
- prescription ready
- low-stock alert
- claim update
- discharge summary ready

Channels:

- in-app
- email
- SMS
- WhatsApp

### 10.16 Audit Logs

Audit:

- tenant creation
- module changes
- staff invite/role changes
- patient registration/edit/archive
- appointment cancel/reschedule
- consultation start/complete
- prescription finalize
- lab result finalize
- pharmacy dispense
- stock adjustment
- bill cancel/refund
- IPD admission/discharge
- claim settlement
- security-sensitive login/support actions

### 10.17 Full Daily Hospital Flow

1. Reception registers/checks in patients.
2. OPD queue fills.
3. Doctors consult.
4. Doctors prescribe/order labs/request admission.
5. Pharmacy dispenses.
6. Lab processes samples.
7. Billing collects payments.
8. IPD admits/discharges.
9. Inventory updates stock.
10. Insurance staff handles claims.
11. Admin monitors operations.

### 10.18 Full SaaS Lifecycle Flow

1. SaaS company sells plan.
2. Super Admin creates hospital.
3. Hospital Admin configures workspace.
4. Staff start daily operations.
5. Modules are added as hospital grows.
6. Subscription renews or changes.
7. SaaS team monitors usage, reliability, and support.

---

## 11. Two-Developer Work Division

### Developer 1: Platform, SaaS, Admin, And Foundation

Owns:

- platform/SaaS foundation
- auth
- tenant model
- RBAC
- module entitlements
- tenant status enforcement
- Super Admin
- Hospital Admin setup
- staff/user management
- provider setup
- frontend app shell/navigation
- reporting framework
- platform and admin audit logs

Primary modules:

- `ADMIN`
- platform-only routes
- cross-cutting auth/RBAC/module logic
- setup/reporting shell

### Developer 2: Clinical And Operational Workflows

Owns:

- patient module
- reception/OPD
- doctor consultation
- billing/payments
- lab
- pharmacy
- inventory
- IPD
- insurance
- clinical/operational workflows

Primary modules:

- `PATIENT`
- `OPD`
- `SCHEDULING`
- `BILLING`
- `LAB`
- `PHARMACY`
- `INVENTORY`
- `IPD`
- `INSURANCE`

### Shared Ownership

Both developers share:

- database schema review
- API contracts
- seed data
- E2E workflow proofs
- integration points
- migration planning
- testing
- production readiness
- security review
- code review before phase completion

### Coordination Rules

1. Developer 1 owns guards, auth context, role/module routing, and shared API conventions.
2. Developer 2 consumes those conventions in domain modules.
3. Developer 2 must not bypass tenant/RBAC/module guards.
4. Developer 1 must not create placeholder operational screens without Developer 2 workflow input.
5. Every schema migration is reviewed by both developers.
6. Every phase has one integration day where both developers run E2E flows together.
7. API contracts are written before frontend pages consume them.
8. No developer changes another developer's module internals without review.

---

## 12. Phase-By-Phase Build Plan

### Phase 0: Documentation And Architecture Lock

**Goal:** Lock product, tech, workflows, responsibilities, and testing gates before coding.

**Owner:** Shared

**Dependencies:** None

**Database models involved:** Draft all target models.

**API endpoints:** Draft all endpoint contracts.

**Frontend pages:** Draft all route/page map.

**Permissions:** Draft permission matrix.

**Seed data:** Draft seed user list and tenant demo plan.

**Tests to write/run:** None yet; define test strategy.

**Acceptance criteria:**

- `NEW_APP_PRODUCT_SPEC.md` exists.
- `NEW_APP_BUILD_MASTER_PLAN.md` exists.
- Permission matrix accepted.
- Module list accepted.
- Role list accepted.
- Phase ownership accepted.
- First implementation location accepted.

**Do not move on until:**

- Both developers agree to the phase order.
- No one starts app code.
- The team decides whether the new app is a new repo, new folder, or replacement.

### Phase 1: Foundation And SaaS Core

**Goal:** Build the secure multi-tenant foundation.

**Owner:** Developer 1 primary, Developer 2 reviews schema and seed.

**Dependencies:** Phase 0.

**Database models involved:**

- Tenant
- Plan
- Subscription
- ModuleEntitlement
- User
- TenantUser
- Role
- Permission
- RolePermission
- UserRole
- Provider
- AuditLog

**API endpoints:**

- `GET /auth/me`
- basic health endpoint
- initial platform auth path

**Frontend pages:**

- `/login`
- app shell
- role/module-aware navigation shell
- empty role dashboard shells only if tied to auth routing tests

**Permissions:**

- platform permissions
- settings/staff permissions
- core tenant permissions

**Seed data:**

- Super Admin
- demo tenant
- Hospital Admin
- all role users
- default roles and permissions
- plan/module definitions

**Tests to write/run:**

- unit tests for permission mapping
- API test for `/auth/me`
- tenant isolation proof
- module entitlement proof
- build validation
- migration validation
- seed validation

**Acceptance criteria:**

- Super Admin logs in.
- Hospital Admin logs in.
- `/auth/me` returns tenants, roles, permissions, modules, providerId.
- Tenant user cannot access platform routes.
- Disabled module is blocked by API.

**Do not move on until:**

- API build passes.
- Web build passes.
- Prisma validate passes.
- Seed passes on fresh DB.
- Tenant isolation test passes.
- RBAC smoke test passes.

### Phase 2: Platform And Super Admin

**Goal:** Build sellable SaaS provisioning.

**Owner:** Developer 1 primary.

**Dependencies:** Phase 1.

**Database models involved:**

- Tenant
- Plan
- Subscription
- ModuleEntitlement
- User
- TenantUser
- Role
- AuditLog

**API endpoints:**

- `GET /platform/tenants`
- `POST /platform/tenants`
- `GET /platform/tenants/:id`
- `POST /platform/tenants/:id/suspend`
- `POST /platform/tenants/:id/activate`
- `GET /platform/tenants/:id/modules`
- `POST /platform/tenants/:id/modules`
- `POST /platform/tenants/:id/invite-admin`
- `GET /platform/audit`

**Frontend pages:**

- `/platform`
- `/platform/tenants/[id]`
- `/platform/plans`
- `/platform/audit`

**Permissions:**

- all `platform.*`

**Seed data:**

- plans: Starter, Growth, Professional, Enterprise
- module entitlements per plan
- Super Admin account

**Tests to write/run:**

- Super Admin tenant creation API test
- invite Hospital Admin test
- platform route guard test
- module toggle test
- audit log test

**Acceptance criteria:**

- Super Admin creates tenant.
- Tenant bootstrap creates roles and permissions.
- First Hospital Admin can log in.
- Hospital Admin lands on `/admin`.
- Hospital Admin cannot access `/platform`.
- Module toggles persist.

**Do not move on until:**

- Tenant onboarding E2E passes.
- Module toggle works.
- Invite flow has no Super Admin leakage.
- Audit logs are present.

### Phase 3: Hospital Admin Setup And Staff

**Goal:** Let Hospital Admin configure workspace and invite staff without DB edits.

**Owner:** Developer 1 primary, Developer 2 supports provider requirements.

**Dependencies:** Phase 2.

**Database models involved:**

- HospitalSettings
- Facility
- Department
- ServiceCatalog
- User
- TenantUser
- Provider
- Role
- UserRole
- AuditLog

**API endpoints:**

- `GET /admin/overview`
- `GET/PATCH /admin/profile`
- `GET/POST /admin/facilities`
- `GET/POST /admin/departments`
- `GET/POST/PATCH /admin/catalog`
- `GET /staff`
- `POST /staff`
- `PATCH /staff/:id`
- `PATCH /staff/:id/roles`
- `POST /staff/:id/deactivate`
- `POST /staff/:id/reactivate`
- `POST /staff/:id/reset-password`
- `GET /providers/me`

**Frontend pages:**

- `/admin`
- `/admin/profile`
- `/admin/facilities`
- `/admin/departments`
- `/admin/staff`
- `/admin/roles`
- `/admin/catalog`

**Permissions:**

- settings
- facility
- department
- role
- staff

**Seed data:**

- Hospital Admin
- Doctor
- Nurse
- Reception
- Lab Tech
- Pharmacist
- Inventory Manager
- Billing
- Insurance Staff
- default departments
- default service catalog

**Tests to write/run:**

- staff invite API test
- doctor invite creates Provider
- nurse invite creates Provider if configured
- deactivated user access denied
- role update test
- frontend smoke for admin setup

**Acceptance criteria:**

- Admin configures workspace from UI.
- Staff users can log in.
- Provider records resolve correctly.
- Deactivated users cannot access tenant.

**Do not move on until:**

- Admin setup checklist can be completed.
- All role seed users can log in and land correctly.

### Phase 4: Starter Product - Patient, OPD, Doctor, Billing

**Goal:** First marketable workflow: registration to consultation to bill/payment.

**Owner:** Developer 2 primary. Developer 1 supports guards, routing, app shell, reporting hooks.

**Dependencies:** Phase 3.

**Database models involved:**

- Patient
- PatientIdentifier
- Consent
- MedicalHistory
- Allergy
- Appointment
- Encounter
- Vitals
- Diagnosis
- ClinicalNote
- Prescription
- PrescriptionItem
- Bill
- BillItem
- Payment
- Refund
- AuditLog

**API endpoints:**

- patient endpoints
- appointment endpoints
- encounter endpoints
- consultation endpoints
- prescription endpoints
- billing endpoints

**Frontend pages:**

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

**Permissions:**

- patient
- appointment
- queue
- encounter
- consultation
- vitals
- diagnosis
- prescription
- bill
- payment

**Seed data:**

- patients
- appointments
- doctors with schedules
- service catalog
- unpaid/paid bills

**Tests to write/run:**

- patient registration API
- appointment/check-in API
- doctor consultation API
- billing/payment API
- RBAC tests by role
- E2E: patient registration -> OPD -> doctor -> prescription -> bill -> payment

**Acceptance criteria:**

- Reception can register and check in patient.
- Doctor can complete consultation.
- Bill can be generated and paid.
- Patient timeline shows encounter and bill.

**Do not move on until:**

- Starter E2E workflow passes.
- No placeholder dashboard remains in Starter routes.
- Audit logs exist for the workflow.

### Phase 5: Growth Product - Lab And Pharmacy

**Goal:** Add diagnostics and prescription dispense workflows.

**Owner:** Developer 2 primary.

**Dependencies:** Phase 4.

**Database models involved:**

- LabTestCatalog
- LabOrder
- LabOrderItem
- LabSample
- LabResult
- Prescription
- PrescriptionItem
- DispenseRecord
- DispenseItem
- InventoryItem minimal
- InventoryBatch minimal
- Bill
- BillItem
- AuditLog

**API endpoints:**

- lab endpoints
- pharmacy endpoints
- prescription availability endpoint
- billing linkage endpoints

**Frontend pages:**

- `/lab`
- `/lab/orders/[id]`
- `/lab/reports/[id]`
- `/pharmacy`
- `/pharmacy/dispense/[id]`

**Permissions:**

- lab
- pharmacy
- prescription
- inventory read/stock out where needed
- bill write

**Seed data:**

- lab catalog
- sample lab orders
- finalized prescriptions
- starter stock items

**Tests to write/run:**

- lab lifecycle API test
- pharmacy dispense API test
- module entitlement test for LAB/PHARMACY
- E2E: OPD -> lab order -> sample -> result -> billing -> doctor sees result
- E2E: prescription -> pharmacy dispense -> bill

**Acceptance criteria:**

- Lab lifecycle works with enforced status transitions.
- Pharmacy dispense fails if stock is missing.
- Pharmacy bill uses actual dispensed item data.

**Do not move on until:**

- Lab and pharmacy E2Es pass.
- Results appear in patient timeline and doctor view.

### Phase 6: Professional Product - Inventory And IPD

**Goal:** Add hospital operational depth.

**Owner:** Developer 2 primary. Developer 1 supports reports and module packaging.

**Dependencies:** Phase 5.

**Database models involved:**

- InventoryItem
- Supplier
- InventoryBatch
- PurchaseOrder
- PurchaseOrderItem
- InventoryTransaction
- Ward
- Bed
- Admission
- BedTransfer
- IpdRound
- NursingNote
- MedicationAdministration
- IpdCharge
- DischargeSummary
- Bill
- BillItem
- AuditLog

**API endpoints:**

- inventory endpoints
- IPD endpoints
- nursing endpoints
- billing charge linkage

**Frontend pages:**

- `/inventory`
- `/inventory/items`
- `/inventory/purchases`
- `/inventory/suppliers`
- `/inventory/transactions`
- `/ipd`
- `/ipd/admit`
- `/ipd/admissions/[id]`
- `/ipd/admissions/[id]/discharge`
- `/ipd/admissions/[id]/summary`
- `/nursing`
- `/nursing/ipd/[admissionId]`

**Permissions:**

- inventory
- supplier/purchase
- IPD
- ward/bed
- nursing
- medication
- billing charge write

**Seed data:**

- suppliers
- inventory items
- batches
- wards
- beds
- sample admission

**Tests to write/run:**

- stock-in and adjustment tests
- low stock/expiry tests
- IPD admit/discharge tests
- bed double-book prevention test
- E2E: IPD admit -> bed occupied -> charges -> discharge -> bed available -> final bill

**Acceptance criteria:**

- Inventory ledger is correct.
- Bed state is correct.
- IPD charges reach billing.
- Discharge summary exists.

**Do not move on until:**

- Inventory E2E and IPD E2E pass.
- No double bed booking possible.

### Phase 7: Enterprise Product - Insurance, Reports, APIs

**Goal:** Add enterprise/chain upsell capabilities.

**Owner:** Developer 2 owns insurance. Developer 1 owns reports/API framework.

**Dependencies:** Phase 6.

**Database models involved:**

- InsuranceProvider
- PatientInsurancePolicy
- InsuranceClaim
- ClaimSettlement
- reports aggregation/read models where needed
- API client keys
- Webhook subscriptions
- Event ledger

**API endpoints:**

- insurance endpoints
- report endpoints
- public API v1 endpoints
- webhook management endpoints

**Frontend pages:**

- `/insurance`
- `/insurance/claims/[id]`
- `/reports`
- `/reports/operations`
- `/reports/financial`
- `/reports/inventory`
- `/reports/clinical`
- developer/admin API settings if needed

**Permissions:**

- insurance
- reports
- platform/API permissions

**Seed data:**

- insurance providers
- patient policies
- claims
- report fixtures

**Tests to write/run:**

- claim lifecycle tests
- duplicate settlement test
- report permission tests
- API key auth tests
- webhook delivery tests
- E2E: policy -> claim -> approval -> insurer payment -> patient share -> bill settled

**Acceptance criteria:**

- Insurance settlement updates billing and receivables.
- Reports respect tenant, role, permission, and module.
- Public API has auth, rate limits, and audit.

**Do not move on until:**

- Enterprise E2E passes.
- Reports have correct access control.

### Phase 8: Notifications, Audit Hardening, Support Tooling

**Goal:** Add operational reliability, supportability, and trust.

**Owner:** Developer 1 primary for audit/support, Developer 2 for domain notification triggers.

**Dependencies:** Phases 4-7.

**Database models involved:**

- Notification
- NotificationPreference
- AuditLog
- SupportAccessSession
- EventLedger

**API endpoints:**

- notification endpoints
- audit search endpoints
- support mode endpoints
- health/diagnostic endpoints

**Frontend pages:**

- notification center
- admin notification settings
- audit search
- platform tenant health
- support tooling

**Permissions:**

- audit read
- support access
- notification manage
- reports read

**Seed data:**

- notification templates
- audit examples

**Tests to write/run:**

- notification trigger tests
- audit append-only tests
- support mode audit tests
- security tests for support access

**Acceptance criteria:**

- Critical actions produce audit logs.
- Notifications trigger from workflow events.
- Support access is audited and limited.

**Do not move on until:**

- Audit coverage checklist passes.
- No destructive action lacks reason.

### Phase 9: Testing, Deployment, Production Readiness

**Goal:** Ship production-ready SaaS.

**Owner:** Shared. Developer 1 owns deployment/security, Developer 2 owns workflow proof.

**Dependencies:** All product phases.

**Database models involved:** All.

**API endpoints:** All.

**Frontend pages:** All.

**Permissions:** All.

**Seed data:** Full demo and production bootstrap.

**Tests to write/run:**

- unit tests
- API tests
- RBAC tests
- module entitlement tests
- tenant isolation tests
- frontend smoke tests
- E2E workflow tests
- seed validation
- build validation
- migration validation
- deployment smoke tests

**Acceptance criteria:**

- Fresh production-like deployment succeeds.
- New tenant can be onboarded without manual DB edits.
- All required E2E tests pass.
- Monitoring, backups, CI/CD, and error logging are configured.

**Do not move on until:**

- Production readiness checklist is complete.
- Security review is complete.
- Both developers sign off.

---

## 13. Testing Guide

### Test Types

Unit tests:

- pure utility functions
- permission mapping
- pricing/module rules
- calculation functions
- state transition validators

API tests:

- every controller happy path
- validation failures
- permission failures
- module failures
- status transitions

RBAC tests:

- each role can access allowed routes
- each role is blocked from forbidden routes
- Hospital Admin cannot access platform
- Super Admin cannot accidentally operate as tenant user without explicit support mode

Module entitlement tests:

- disabled module blocks API
- disabled module hides nav/page
- module toggle updates access
- plan defaults create correct modules

Tenant isolation tests:

- Tenant A cannot read Tenant B patients
- Tenant A cannot read Tenant B bills
- Tenant A cannot read Tenant B lab orders
- Tenant A cannot read Tenant B inventory
- Tenant A cannot mutate Tenant B records by ID

Frontend smoke tests:

- login
- role landing pages
- nav filtering
- core page loading
- empty states
- error states
- mobile/tablet layout sanity

E2E workflow tests:

- required tests listed below

Seed validation:

- all plans exist
- all modules exist
- all roles exist
- all permissions exist
- all role users exist
- demo tenant has realistic setup

Build validation:

- API build
- web build
- typecheck
- lint if configured

Migration validation:

- Prisma validate
- migrations apply to fresh DB
- migrations apply to previous DB
- seed runs after migrations

### Required E2E Tests

1. Super Admin creates tenant -> invites Hospital Admin -> Hospital Admin configures workspace -> invites staff.
2. Patient registration -> OPD -> doctor consultation -> prescription -> pharmacy dispense -> bill -> payment.
3. OPD -> lab order -> sample -> result -> billing -> doctor sees result.
4. IPD admit -> bed occupied -> charges -> discharge -> bed available -> final bill.
5. Insurance policy -> claim -> approval -> insurer payment -> patient share -> bill settled.
6. Tenant A cannot access Tenant B data.
7. Disabled module blocks API and UI.
8. User without permission gets 403.

### Standard Commands

Adjust command names to the final new-app package names. The equivalent checks must exist:

```bash
pnpm --filter api build
pnpm --filter web build
pnpm --filter @hms/db exec prisma validate
pnpm --filter @hms/db exec prisma migrate deploy
pnpm --filter @hms/db exec prisma db seed
pnpm test
```

---

## 14. Production Readiness Rules

### Security

- Production never uses dev auth.
- Auth tokens are verified.
- Tenant context is required.
- Module entitlements are enforced.
- Permissions are enforced.
- Environment variables are validated.
- Secrets are not logged.
- Rate limiting exists for auth-sensitive endpoints.

### Data

- Tenant isolation is proven.
- Backups are configured.
- Audit logs are append-only or protected.
- Clinical and financial data are not hard deleted.
- Exports are available for tenant offboarding.

### Operations

- CI/CD exists.
- Health checks exist.
- Error monitoring exists.
- Logs are searchable.
- Migration workflow exists.
- Rollback plan exists.
- Production bootstrap is documented.

### UX

- Every role has useful dashboard.
- No placeholder dashboards.
- No dead buttons.
- Loading/empty/error states exist.
- Print views are tested.
- Operational pages are efficient and not marketing-style.

---

## 15. What Must Not Be Built First

Do not build these before core workflows:

- marketing landing page
- AI assistant
- AI scribe
- decorative dashboards
- fake analytics
- generic pharmacy billing without stock
- lab screen without lifecycle
- IPD bed grid without admission/discharge
- insurance dashboard without settlement
- public API without auth/rate limits/audit
- custom role builder before system roles work

The first production-quality target is Starter:

- tenant onboarding
- Hospital Admin setup
- staff invite
- patient registration
- appointment/walk-in
- OPD queue
- doctor consultation
- billing
- payment
- receipt/invoice
- audit logs
- role dashboards
- module entitlements

---

## 16. AI Agent Working Instructions

Before any AI agent writes code:

1. Read this file.
2. Read `AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md`.
3. Read `NEW_APP_PRODUCT_SPEC.md`.
4. Identify the current phase in `PROJECT_IMPLEMENTATION_PLAN.md`.
5. Identify Developer 1, Developer 2, shared ownership, or the workstream lane from the parallel plan.
6. List files to create/change.
7. List schema changes.
8. List API contracts.
9. List frontend routes.
10. List tests.
11. Wait for approval if the task is not explicitly implementation-ready.

During coding:

1. Do not touch unrelated phase work.
2. Do not change another developer's module without noting it.
3. Do not bypass guards.
4. Do not introduce mock data where API exists.
5. Do not use destructive commands without explicit approval.

Before marking done:

1. Run phase build checks.
2. Run phase tests.
3. Update this document's phase status.
4. Document gaps and next actions.

---

## 17. How To Update This Document

Every completed phase must update:

1. Phase status.
2. Completed files/modules.
3. New API endpoints.
4. New database models/migrations.
5. Seed data changes.
6. Tests added.
7. Test results.
8. Known gaps.
9. Next phase readiness.

Use this status format:

```text
Status: Not started | In progress | Blocked | Ready for QA | Complete
Owner: Developer 1 | Developer 2 | Shared
Last updated: YYYY-MM-DD
Validation: API build, web build, Prisma validate, tests, E2E
```

No phase should be marked `Complete` unless every acceptance criterion and "do not move on until" checklist item passes.

---

## 18. Current Phase Status

| Phase | Status | Owner |
|---|---|---|
| Phase 0 - Documentation and architecture lock | In progress | Shared |
| Phase 1 - Foundation and SaaS core | Not started | Developer 1 |
| Phase 2 - Platform/Super Admin | Not started | Developer 1 |
| Phase 3 - Hospital Admin setup and staff | Not started | Developer 1 |
| Phase 4 - Starter product | Not started | Developer 2 |
| Phase 5 - Growth product | Not started | Developer 2 |
| Phase 6 - Professional product | Not started | Developer 2 |
| Phase 7 - Enterprise product | Not started | Shared |
| Phase 8 - Notifications/audit/support | Not started | Shared |
| Phase 9 - Testing/deployment/production | Not started | Shared |

---

## 19. Immediate Next Decision

Before implementation begins, decide:

1. Will the new app be built in a new repository, a new folder inside this repo, or as a replacement of the current app?
2. Which stack versions are locked?
3. Which database isolation method is final?
4. Which auth provider is final?
5. What is the first sprint date and owner assignment?
6. Which developer owns Phase 1 implementation?

After these are approved, start Phase 1 only.
