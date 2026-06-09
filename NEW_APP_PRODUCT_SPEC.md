# HMS SaaS New App Product Specification

**Purpose:** Final product blueprint for rebuilding the HMS SaaS from scratch.  
**Status:** Product specification, no implementation started.  
**Scope:** Multi-tenant hospital management SaaS with full operational workflows, not a landing page or dashboard-only prototype.  
**Parallel AI coordination:** `AI_PARALLEL_PRODUCT_AND_IMPLEMENTATION_PLAN.md`

---

## 1. Product Goal

Build a production-ready, multi-tenant Hospital Management System SaaS where:

1. Platform Super Admins create and manage hospital workspaces.
2. Each hospital has isolated data, users, modules, settings, billing, and workflows.
3. Hospital Admins configure their workspace and invite staff.
4. Staff members use role-specific dashboards and workflows.
5. Every module is built as an end-to-end workflow, not just a screen.
6. Every route respects authentication, tenant context, module entitlement, role permissions, and audit requirements.

The app should open into the usable product after login. It should not prioritize a marketing landing page.

---

## 2. Product Principles

1. **Tenant isolation first:** Every hospital is a tenant. Tenant A must never see Tenant B data.
2. **Workflow completeness:** A module is incomplete until the real workflow works from start to finish.
3. **Role-first UX:** Users see only the dashboard, navigation, pages, and actions relevant to their role.
4. **Module-aware SaaS:** Enabled modules come from the hospital plan and Super Admin module selections.
5. **Audit every important action:** Clinical, financial, administrative, and destructive actions must be auditable.
6. **No hard deletes for clinical or financial data:** Use soft archive/cancel flows with reasons.
7. **Structured data where it matters:** Do not fake workflows forever with loose strings if structured models are needed.
8. **Production from day one:** Build with tests, migrations, environment validation, logging, and deployment in mind.

---

## 3. Recommended Stack

### Frontend

- Next.js App Router
- React
- Tailwind CSS
- Role-aware app shell
- Module-aware navigation
- Form validation
- Print-ready views for invoices, receipts, prescriptions, lab reports, and discharge summaries

### Backend

- NestJS REST API
- Request-scoped auth and tenant context
- Permission guard
- Module entitlement guard
- Audit logging service
- Input validation DTOs
- Explicit error responses

### Database

- PostgreSQL
- Prisma ORM
- Row Level Security or strict tenant-scoped query architecture
- Migrations for every schema change
- Soft archive/cancel fields for clinical and financial records

### Auth

- Firebase Auth for authentication
- App database for authorization
- Firebase stores login identity only
- App database stores users, tenant memberships, roles, permissions, provider records, and module access

### Infrastructure

- Docker local stack
- Managed Postgres in production
- CI/CD
- Backups
- Error logging
- Health checks
- Environment validation

---

## 4. SaaS Account Structure

### Platform Layer

Used by the SaaS company.

Primary role:

- `SUPER_ADMIN`

Responsibilities:

- Create hospital workspaces.
- Select plan and enabled modules.
- Invite first Hospital Admin.
- Suspend/reactivate hospitals.
- Manage plans and subscriptions.
- View platform usage.
- View platform audit logs.

### Hospital Tenant Layer

Used by each hospital.

Primary roles:

- `HOSPITAL_ADMIN`
- `RECEPTION`
- `DOCTOR`
- `NURSE`
- `LAB_TECH`
- `PHARMACIST`
- `INVENTORY_MGR`
- `BILLING`
- `ACCOUNTANT`
- `INSURANCE_STAFF`
- `HOSPITAL_MANAGER`

Responsibilities:

- Run hospital operations inside one tenant.
- Use only enabled modules.
- Access only assigned permissions.
- See role-specific dashboards and workflows.

---

## 5. Standard Module Codes

| Code | Module | Purpose | Default Plan |
|---|---|---|---|
| `ADMIN` | Hospital Admin Setup | Settings, departments, staff, catalog | All plans |
| `PATIENT` | Patient Records | Registration, profile, timeline | All plans |
| `OPD` | OPD and Consultation | Appointments, queue, doctor consultation | All plans |
| `SCHEDULING` | Scheduling | Doctor schedules and appointment slots | All plans |
| `BILLING` | Billing and Payments | Bills, payments, invoices, receipts | All plans |
| `PHARMACY` | Pharmacy | Prescription dispensing | Growth+ |
| `INVENTORY` | Inventory | Stock, batches, suppliers, purchasing | Professional+ |
| `LAB` | Lab | Orders, samples, results, reports | Growth+ |
| `IPD` | Inpatient | Wards, beds, admissions, discharge | Professional+ |
| `INSURANCE` | Insurance and TPA | Policies, claims, settlements | Enterprise |
| `REPORTS` | Reports | Operational, clinical, financial reports | Professional+ |

Rules:

- `ADMIN` must be automatically enabled for every hospital tenant.
- `SCHEDULING` should be enabled whenever `OPD` is enabled.
- `INVENTORY` and `PHARMACY` are separate modules.
- Frontend routes and backend APIs must both check module entitlements.

---

## 6. Subscription Plans

| Plan | Modules | Intended Customer |
|---|---|---|
| `STARTER` | ADMIN, PATIENT, OPD, SCHEDULING, BILLING | Small clinics |
| `GROWTH` | Starter + LAB, PHARMACY | Clinics with lab/pharmacy |
| `PROFESSIONAL` | Growth + INVENTORY, IPD, REPORTS | Small and mid-size hospitals |
| `ENTERPRISE` | All modules including INSURANCE | Large hospitals and chains |

Each plan should also support:

- User limit
- Facility/branch limit
- Bed limit
- Optional trial period
- Subscription status
- Module overrides by Super Admin

Subscription statuses:

- `TRIALING`
- `ACTIVE`
- `PAST_DUE`
- `SUSPENDED`
- `CANCELED`

Tenant statuses:

- `ACTIVE`
- `SUSPENDED`
- `PENDING_SETUP`

---

## 7. Roles And Landing Pages

| Role | Landing Page | Main Dashboard |
|---|---|---|
| `SUPER_ADMIN` | `/platform` | SaaS tenants, modules, subscriptions |
| `HOSPITAL_ADMIN` | `/admin` | Hospital setup and operations |
| `HOSPITAL_MANAGER` | `/manager` | Operations and reports |
| `RECEPTION` | `/reception` | Registration, appointments, queue |
| `DOCTOR` | `/doctor` | Consultation queue |
| `NURSE` | `/nursing` | Assigned patients, vitals, IPD care |
| `LAB_TECH` | `/lab` | Pending lab orders and results |
| `PHARMACIST` | `/pharmacy` | Prescriptions to dispense |
| `INVENTORY_MGR` | `/inventory` | Stock, batches, alerts |
| `BILLING` | `/billing` | Bills, payments, receivables |
| `ACCOUNTANT` | `/accounts` | Financial reports, refunds, reconciliation |
| `INSURANCE_STAFF` | `/insurance` | Claims and TPA receivables |

Rule:

- After login, users go directly to their role dashboard.
- No user should land on a generic marketing page.

---

## 8. Permission Model

Every protected API route should require:

1. Authenticated user.
2. Active tenant context, unless platform route.
3. Tenant status is usable.
4. Module entitlement.
5. Permission.

### Permission Names

Use granular permission keys:

```text
platform.tenant.read
platform.tenant.create
platform.tenant.update
platform.tenant.suspend
platform.modules.manage
platform.plans.manage
platform.admin.invite
platform.audit.read

settings.read
settings.manage
facility.read
facility.write
department.read
department.write
role.read
role.write
staff.read
staff.invite
staff.update
staff.deactivate
staff.reset_password

patient.read
patient.write
patient.archive
patient.timeline.read
patient.consent.manage

appointment.read
appointment.write
appointment.cancel
appointment.reschedule
queue.read
queue.manage

encounter.read
encounter.write
consultation.read
consultation.write
clinical_note.write
vitals.read
vitals.write
diagnosis.write
followup.write

prescription.read
prescription.write
prescription.finalize

nursing.read
nursing.note.write
medication.administer

lab.catalog.manage
lab.order
lab.read
lab.sample.collect
lab.result.enter
lab.result.verify
lab.report.print

pharmacy.read
pharmacy.dispense
pharmacy.return

inventory.read
inventory.item.write
inventory.stock_in
inventory.stock_out
inventory.adjust
inventory.supplier.manage
inventory.purchase.manage
inventory.reports.read

bill.read
bill.write
bill.cancel
invoice.print
payment.collect
payment.refund
reports.financial.read

ipd.read
ipd.admit
ipd.transfer
ipd.discharge
ipd.round.write
ipd.charge.write
ward.manage
bed.manage

insurance.read
insurance.provider.manage
insurance.policy.manage
insurance.claim.create
insurance.claim.update
insurance.claim.approve
insurance.claim.settle

reports.read
reports.operational.read
reports.clinical.read
reports.inventory.read
```

### Role Permission Matrix

| Role | Permissions |
|---|---|
| `SUPER_ADMIN` | All `platform.*` permissions. No default tenant clinical edit access except audited support mode. |
| `HOSPITAL_ADMIN` | All tenant permissions for enabled modules, including staff, settings, catalog, reports. |
| `HOSPITAL_MANAGER` | Read most operational data, reports, queue, billing summaries, bed occupancy, lab status, inventory status. No destructive permissions by default. |
| `RECEPTION` | patient.read, patient.write, appointment.*, queue.*, encounter.read, bill.read, bill.write, payment.collect |
| `DOCTOR` | patient.read, patient.timeline.read, encounter.*, consultation.*, clinical_note.write, vitals.*, diagnosis.write, prescription.*, lab.order, lab.read, ipd.admit request permission, followup.write |
| `NURSE` | patient.read, encounter.read, vitals.*, nursing.*, medication.administer, ipd.read, ipd.round.write limited, lab.read |
| `LAB_TECH` | patient.read, lab.read, lab.sample.collect, lab.result.enter, lab.result.verify, lab.report.print |
| `PHARMACIST` | patient.read limited, prescription.read, pharmacy.read, pharmacy.dispense, inventory.read, inventory.stock_out, bill.read, bill.write |
| `INVENTORY_MGR` | inventory.*, supplier, purchase, inventory reports |
| `BILLING` | patient.read, bill.*, invoice.print, payment.collect, payment.refund, insurance.read |
| `ACCOUNTANT` | bill.read, bill.cancel, payment.refund, reports.financial.read, insurance.read |
| `INSURANCE_STAFF` | patient.read, bill.read, insurance.* |

---

## 9. Core Database Models

This is the target model list for the new app. Field lists are intentionally concise but specific enough for schema design.

### Platform And SaaS

`Tenant`

- id
- name
- slug
- status
- tier
- contactEmail
- contactPhone
- address
- branding
- createdAt
- updatedAt

`Plan`

- id
- code
- name
- priceInr
- priceUsd
- interval
- userLimit
- facilityLimit
- bedLimit
- modules
- active

`Subscription`

- id
- tenantId
- planId
- status
- provider
- providerSubId
- currentPeriodStart
- currentPeriodEnd
- trialEndsAt
- createdAt

`ModuleEntitlement`

- id
- tenantId
- subscriptionId
- moduleCode
- enabled
- source
- updatedAt

`PlatformAuditLog`

- id
- actorId
- tenantId nullable
- action
- entity
- entityId
- metadata
- createdAt

### Identity And RBAC

`User`

- id
- firebaseUid
- email
- fullName
- phone
- isPlatform
- createdAt
- disabledAt nullable

`TenantUser`

- id
- tenantId
- userId
- active
- createdAt
- deactivatedAt nullable
- deactivationReason nullable

`Role`

- id
- tenantId nullable
- code
- name
- description
- systemRole

`Permission`

- id
- key
- description

`RolePermission`

- roleId
- permissionId

`UserRole`

- id
- tenantUserId
- roleId
- departmentId nullable

`Provider`

- id
- tenantId
- userId
- departmentId nullable
- type
- registrationNumber nullable
- speciality nullable
- active

### Hospital Setup

`Facility`

- id
- tenantId
- name
- address
- phone
- active

`Department`

- id
- tenantId
- facilityId
- name
- type
- active

`HospitalSettings`

- id
- tenantId
- timezone
- currency
- invoicePrefix
- mrnPrefix
- defaultConsultationCatalogId nullable
- createdAt
- updatedAt

`ServiceCatalog`

- id
- tenantId
- code
- name
- type
- price
- taxRate
- active

### Patient

`Patient`

- id
- tenantId
- mrn
- fullName
- dob
- sex
- phone
- email nullable
- address nullable
- emergencyContactName nullable
- emergencyContactPhone nullable
- deletedAt nullable
- archiveReason nullable
- createdAt

`PatientIdentifier`

- id
- tenantId
- patientId
- system
- value

`Consent`

- id
- tenantId
- patientId
- purpose
- grantedAt
- revokedAt nullable

`MedicalHistory`

- id
- tenantId
- patientId
- type
- description
- recordedAt

`Allergy`

- id
- tenantId
- patientId
- substance
- severity
- notes

### OPD And Clinical

`Appointment`

- id
- tenantId
- patientId
- providerId nullable
- scheduledAt
- status
- reason
- cancellationReason nullable

`Encounter`

- id
- tenantId
- patientId
- providerId nullable
- appointmentId nullable
- type
- status
- chiefComplaint
- tokenNumber nullable
- startedAt
- endedAt nullable
- followUpDate nullable
- followUpNotes nullable

`Vitals`

- id
- tenantId
- encounterId
- systolicBp
- diastolicBp
- pulse
- temperature
- spo2
- weightKg
- heightCm
- respiratoryRate
- notes
- recordedById
- recordedAt

`Diagnosis`

- id
- tenantId
- encounterId
- icdCode nullable
- description
- type
- notes

`ClinicalNote`

- id
- tenantId
- encounterId
- authorId
- noteType
- content
- createdAt

### Prescription

`Prescription`

- id
- tenantId
- encounterId
- providerId
- status
- notes
- createdAt
- finalizedAt nullable

`PrescriptionItem`

- id
- tenantId
- prescriptionId
- inventoryItemId nullable
- drugName
- dosage
- frequency
- duration
- route
- instructions
- quantity

### Nursing

`NursingNote`

- id
- tenantId
- patientId
- admissionId nullable
- encounterId nullable
- nurseId
- note
- createdAt

`MedicationAdministration`

- id
- tenantId
- patientId
- admissionId nullable
- prescriptionItemId nullable
- administeredById
- administeredAt
- status
- notes

### Lab

`LabTestCatalog`

- id
- tenantId
- code
- name
- specimenType
- price
- active

`LabOrder`

- id
- tenantId
- patientId
- encounterId nullable
- admissionId nullable
- providerId nullable
- orderedById
- status
- notes
- createdAt

`LabOrderItem`

- id
- tenantId
- labOrderId
- testId
- status

`LabSample`

- id
- tenantId
- labOrderItemId
- barcode
- collectedById
- collectedAt nullable
- status

`LabResult`

- id
- tenantId
- labOrderItemId
- testName
- value
- unit
- referenceRange
- abnormalFlag
- notes
- enteredById
- verifiedById nullable
- recordedAt
- verifiedAt nullable

### Pharmacy And Inventory

`InventoryItem`

- id
- tenantId
- name
- type
- unit
- sku nullable
- lowStockThreshold
- active

`Supplier`

- id
- tenantId
- name
- contact
- address
- active

`InventoryBatch`

- id
- tenantId
- itemId
- supplierId nullable
- batchNumber
- expiryDate
- quantity
- unitCost
- salePrice
- createdAt

`PurchaseOrder`

- id
- tenantId
- supplierId
- invoiceRef
- status
- createdAt

`PurchaseOrderItem`

- id
- tenantId
- purchaseOrderId
- itemId
- batchId nullable
- quantity
- unitCost

`InventoryTransaction`

- id
- tenantId
- itemId
- batchId nullable
- type
- quantity
- reason
- actorId
- createdAt

`DispenseRecord`

- id
- tenantId
- prescriptionId
- patientId
- dispensedById
- status
- billId nullable
- createdAt

`DispenseItem`

- id
- tenantId
- dispenseRecordId
- prescriptionItemId
- inventoryItemId
- batchId
- quantity
- unitPrice

### Billing

`Bill`

- id
- tenantId
- patientId
- encounterId nullable
- admissionId nullable
- billNumber
- totalAmount
- discount
- netAmount
- status
- notes
- cancellationReason nullable
- createdAt
- updatedAt

`BillItem`

- id
- tenantId
- billId
- catalogId nullable
- sourceType
- sourceId nullable
- name
- quantity
- unitPrice
- total

`Payment`

- id
- tenantId
- billId
- amount
- method
- transactionId nullable
- collectedById
- notes
- createdAt

`Refund`

- id
- tenantId
- billId
- paymentId nullable
- amount
- reason
- refundedById
- createdAt

### IPD

`Ward`

- id
- tenantId
- name
- type
- active

`Bed`

- id
- tenantId
- wardId
- bedNumber
- status

`Admission`

- id
- tenantId
- patientId
- encounterId nullable
- providerId nullable
- bedId
- status
- admittedAt
- dischargedAt nullable
- dischargeReason nullable
- expectedDischargeAt nullable

`BedTransfer`

- id
- tenantId
- admissionId
- fromBedId
- toBedId
- reason
- transferredById
- transferredAt

`IpdRound`

- id
- tenantId
- admissionId
- providerId
- notes
- createdAt

`IpdCharge`

- id
- tenantId
- admissionId
- catalogId
- quantity
- notes
- createdById
- billItemId nullable
- createdAt

`DischargeSummary`

- id
- tenantId
- admissionId
- summary
- instructions
- followUpDate nullable
- preparedById
- finalizedAt nullable

### Insurance

`InsuranceProvider`

- id
- tenantId
- name
- contact
- active

`PatientInsurancePolicy`

- id
- tenantId
- patientId
- providerId
- policyNumber
- coverageDetails
- active

`InsuranceClaim`

- id
- tenantId
- billId
- patientPolicyId
- providerId
- claimAmount
- approvedAmount nullable
- patientShare nullable
- status
- rejectionReason nullable
- submittedAt nullable
- approvedAt nullable
- settledAt nullable
- notes

`ClaimSettlement`

- id
- tenantId
- claimId
- paymentId nullable
- amount
- settledById
- settledAt
- notes

### Audit

`AuditLog`

- id
- tenantId
- actorId nullable
- action
- entity
- entityId
- metadata
- createdAt

---

## 10. Routes And Pages

### Public

| Route | Purpose |
|---|---|
| `/login` | Sign in |
| `/forgot-password` | Password reset |

### Platform

| Route | Purpose |
|---|---|
| `/platform` | Tenant list, create hospital, status |
| `/platform/tenants/[id]` | Tenant detail, modules, subscription, first admin |
| `/platform/plans` | Plans and module bundles |
| `/platform/audit` | Platform audit log |

### Hospital Admin

| Route | Purpose |
|---|---|
| `/admin` | Setup checklist and operational overview |
| `/admin/profile` | Hospital profile |
| `/admin/facilities` | Facilities and branches |
| `/admin/departments` | Departments |
| `/admin/staff` | Staff users and roles |
| `/admin/roles` | Role templates and permissions |
| `/admin/catalog` | Service catalog |
| `/admin/wards` | Wards and beds |
| `/admin/lab-catalog` | Lab tests |
| `/admin/insurance` | Insurance providers |

### Patient And OPD

| Route | Purpose |
|---|---|
| `/patients` | Patient search and registration |
| `/patients/[id]` | Patient detail and timeline |
| `/reception` | Reception dashboard |
| `/opd` | OPD queue and appointments |
| `/opd/appointments` | Appointment calendar |

### Clinical

| Route | Purpose |
|---|---|
| `/doctor` | Doctor queue |
| `/doctor/consult/[encounterId]` | Consultation workspace |
| `/nursing` | Nursing dashboard |
| `/nursing/ipd/[admissionId]` | IPD nursing care |

### Lab

| Route | Purpose |
|---|---|
| `/lab` | Lab work queue |
| `/lab/orders/[id]` | Order detail, samples, results |
| `/lab/reports/[id]` | Printable report |

### Pharmacy And Inventory

| Route | Purpose |
|---|---|
| `/pharmacy` | Prescriptions to dispense |
| `/pharmacy/dispense/[id]` | Dispense workflow |
| `/inventory` | Stock dashboard |
| `/inventory/items` | Item master |
| `/inventory/purchases` | Purchase and stock-in |
| `/inventory/suppliers` | Suppliers |
| `/inventory/transactions` | Stock ledger |

### Billing And Insurance

| Route | Purpose |
|---|---|
| `/billing` | Bills dashboard |
| `/billing/new` | Manual bill |
| `/billing/[id]` | Bill detail, payments, refunds |
| `/billing/[id]/invoice` | Printable invoice |
| `/accounts` | Financial dashboard |
| `/insurance` | Claims dashboard |
| `/insurance/claims/[id]` | Claim detail |

### IPD

| Route | Purpose |
|---|---|
| `/ipd` | Bed occupancy |
| `/ipd/admit` | Admission workflow |
| `/ipd/admissions/[id]` | Admission detail |
| `/ipd/admissions/[id]/discharge` | Discharge workflow |
| `/ipd/admissions/[id]/summary` | Discharge summary |

### Reports

| Route | Purpose |
|---|---|
| `/reports` | Report index |
| `/reports/operations` | OPD, IPD, lab, pharmacy |
| `/reports/financial` | Revenue, receivables, refunds |
| `/reports/inventory` | Stock, expiry, purchases |
| `/reports/clinical` | Visits, diagnoses, lab turnaround |

---

## 11. API Endpoint Plan

All tenant endpoints require:

- Auth
- Tenant context
- Tenant active status
- Module entitlement
- Permission

### Auth

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/me` | Current profile, memberships, modules, permissions |
| POST | `/auth/logout` | Optional session cleanup |

### Platform

| Method | Path | Purpose |
|---|---|---|
| GET | `/platform/tenants` | List tenants |
| POST | `/platform/tenants` | Create tenant |
| GET | `/platform/tenants/:id` | Tenant detail |
| POST | `/platform/tenants/:id/suspend` | Suspend tenant |
| POST | `/platform/tenants/:id/activate` | Activate tenant |
| GET | `/platform/tenants/:id/modules` | List entitlements |
| POST | `/platform/tenants/:id/modules` | Enable or disable module |
| POST | `/platform/tenants/:id/invite-admin` | Invite first admin |
| GET | `/platform/audit` | Platform audit |

### Admin Setup

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/overview` | Setup and operations overview |
| GET/PATCH | `/admin/profile` | Hospital profile |
| GET/POST | `/admin/facilities` | Facilities |
| GET/POST | `/admin/departments` | Departments |
| GET/POST/PATCH | `/admin/catalog` | Service catalog |
| GET/POST/PATCH | `/admin/wards` | Wards |
| GET/POST/PATCH | `/admin/beds` | Beds |

### Staff

| Method | Path | Purpose |
|---|---|---|
| GET | `/staff` | List staff |
| POST | `/staff` | Invite staff |
| PATCH | `/staff/:id` | Update staff |
| PATCH | `/staff/:id/roles` | Update roles |
| POST | `/staff/:id/deactivate` | Deactivate with reason |
| POST | `/staff/:id/reactivate` | Reactivate |
| POST | `/staff/:id/reset-password` | Password reset |
| GET | `/providers/me` | Current provider profile |

### Patients

| Method | Path | Purpose |
|---|---|---|
| GET | `/patients` | List/search patients |
| POST | `/patients` | Register patient |
| GET | `/patients/:id` | Patient detail |
| PATCH | `/patients/:id` | Edit patient |
| DELETE | `/patients/:id` | Archive with reason |
| GET | `/patients/:id/timeline` | Patient timeline |
| POST | `/patients/:id/consents` | Add consent |
| POST | `/patients/:id/allergies` | Add allergy |
| POST | `/patients/:id/history` | Add history |

### OPD And Consultation

| Method | Path | Purpose |
|---|---|---|
| GET | `/appointments` | Appointment list |
| POST | `/appointments` | Book appointment |
| PATCH | `/appointments/:id` | Reschedule |
| POST | `/appointments/:id/cancel` | Cancel with reason |
| GET | `/encounters` | Today encounters |
| POST | `/encounters` | Create walk-in or encounter |
| GET | `/encounters/queue` | OPD queue |
| POST | `/encounters/:id/checkin` | Check in |
| POST | `/encounters/:id/start` | Start consultation |
| GET | `/encounters/:id/detail` | Clinical detail |
| POST | `/encounters/:id/vitals` | Record vitals |
| POST | `/encounters/:id/diagnoses` | Add diagnosis |
| POST | `/encounters/:id/notes` | Add note |
| POST | `/encounters/:id/lab-orders` | Order lab |
| POST | `/encounters/:id/complete` | Complete consultation |

### Prescriptions

| Method | Path | Purpose |
|---|---|---|
| GET | `/encounters/:id/prescriptions` | List prescriptions |
| POST | `/encounters/:id/prescriptions` | Create prescription |
| POST | `/prescriptions/:id/finalize` | Finalize |
| GET | `/prescriptions/:id` | Detail |

### Lab

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/lab/catalog` | Catalog |
| GET | `/lab/orders` | Work queue |
| POST | `/lab/orders` | Create order |
| GET | `/lab/orders/:id` | Detail |
| POST | `/lab/orders/:id/sample` | Collect sample |
| PATCH | `/lab/orders/:id/status` | Status transition |
| POST | `/lab/orders/:id/results` | Enter result |
| POST | `/lab/results/:id/verify` | Verify |
| GET | `/lab/reports/:id` | Report |

### Pharmacy

| Method | Path | Purpose |
|---|---|---|
| GET | `/pharmacy/prescriptions` | Prescriptions to dispense |
| GET | `/pharmacy/prescriptions/:id/availability` | Inventory availability |
| POST | `/pharmacy/prescriptions/:id/dispense` | Dispense and bill |
| POST | `/pharmacy/returns` | Return flow |

### Inventory

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/inventory/items` | Item master |
| PATCH | `/inventory/items/:id` | Update item |
| GET/POST | `/inventory/suppliers` | Suppliers |
| GET/POST | `/inventory/purchases` | Purchase orders |
| POST | `/inventory/batches` | Add batch |
| POST | `/inventory/adjustments` | Adjust stock with reason |
| GET | `/inventory/alerts` | Low stock and expiry |
| GET | `/inventory/transactions` | Ledger |

### Billing

| Method | Path | Purpose |
|---|---|---|
| GET | `/billing/catalog` | Service catalog |
| GET | `/billing/bills` | List bills |
| POST | `/billing/bills` | Create bill |
| GET | `/billing/bills/:id` | Bill detail |
| POST | `/billing/bills/:id/payments` | Add payment |
| POST | `/billing/bills/:id/cancel` | Cancel with reason |
| POST | `/billing/bills/:id/refunds` | Refund |
| GET | `/billing/bills/:id/invoice` | Invoice |
| GET | `/billing/stats` | Dashboard stats |

### IPD

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/ipd/wards` | Wards |
| GET/POST | `/ipd/beds` | Beds |
| GET | `/ipd/occupancy` | Bed dashboard |
| POST | `/ipd/admissions` | Admit |
| GET | `/ipd/admissions/:id` | Admission detail |
| POST | `/ipd/admissions/:id/transfer` | Bed transfer |
| POST | `/ipd/admissions/:id/rounds` | Doctor round |
| POST | `/ipd/admissions/:id/charges` | Add charge |
| POST | `/ipd/admissions/:id/discharge` | Discharge |
| GET | `/ipd/admissions/:id/summary` | Discharge summary |

### Insurance

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/insurance/providers` | Providers |
| GET/POST | `/insurance/policies` | Patient policies |
| GET | `/insurance/claims` | Claims |
| POST | `/insurance/claims` | Create claim |
| GET | `/insurance/claims/:id` | Detail |
| PATCH | `/insurance/claims/:id/status` | Update status |
| POST | `/insurance/claims/:id/settle` | Settle |
| GET | `/insurance/receivables` | Receivables |

### Reports

| Method | Path | Purpose |
|---|---|---|
| GET | `/reports/operations` | Operational report |
| GET | `/reports/financial` | Financial report |
| GET | `/reports/inventory` | Inventory report |
| GET | `/reports/clinical` | Clinical report |

---

## 12. End-To-End Workflows

### Workflow 1: SaaS Tenant Onboarding

Actors:

- Super Admin
- Hospital Admin

Steps:

1. Super Admin logs in.
2. Super Admin creates a hospital tenant.
3. Super Admin selects plan and modules.
4. System creates tenant, subscription, module entitlements, default roles, default permissions.
5. Super Admin invites first Hospital Admin.
6. System creates Firebase user and app user.
7. System creates tenant membership and assigns `HOSPITAL_ADMIN`.
8. Hospital Admin logs in.
9. Hospital Admin lands on `/admin`.
10. Hospital Admin completes setup checklist.

Acceptance:

- Hospital Admin is not platform user.
- Hospital Admin cannot access `/platform`.
- Hospital Admin sees only enabled modules.
- Tenant has default roles and permissions.
- Audit logs exist for tenant creation and admin invite.

### Workflow 2: Hospital Workspace Setup

Actors:

- Hospital Admin

Steps:

1. Admin updates hospital profile.
2. Admin creates facilities.
3. Admin creates departments.
4. Admin creates service catalog.
5. Admin creates doctor schedules.
6. Admin creates wards/beds if IPD enabled.
7. Admin creates lab catalog if LAB enabled.
8. Admin adds inventory items if INVENTORY enabled.
9. Admin adds insurance providers if INSURANCE enabled.
10. Admin invites staff.

Acceptance:

- Workspace can be configured without database edits.
- Disabled modules do not appear in setup.
- Staff users can log in with correct roles.

### Workflow 3: Patient Registration To OPD

Actors:

- Reception
- Doctor
- Billing

Steps:

1. Reception searches patient.
2. If patient does not exist, reception registers patient.
3. System assigns MRN.
4. Reception creates walk-in or appointment.
5. Reception assigns doctor.
6. Reception checks patient in.
7. System generates token.
8. Doctor sees patient in queue.
9. Doctor starts consultation.
10. Doctor completes consultation.
11. Consultation bill is created.
12. Billing collects payment.

Acceptance:

- Patient timeline shows encounter and bill.
- Queue updates status.
- Bill status changes after payment.

### Workflow 4: Doctor Consultation To Pharmacy

Actors:

- Doctor
- Pharmacist
- Billing

Steps:

1. Doctor starts consultation.
2. Doctor adds vitals, diagnosis, and notes.
3. Doctor creates prescription.
4. Doctor finalizes prescription.
5. Pharmacy sees finalized prescription.
6. Pharmacist checks inventory availability.
7. Pharmacist dispenses from batches.
8. System deducts inventory.
9. System creates pharmacy bill.
10. Billing collects payment.

Acceptance:

- Missing stock blocks dispense.
- Stock decreases only after successful dispense.
- Prescription status becomes dispensed.
- Bill contains actual dispensed item prices.

### Workflow 5: Lab Order To Result

Actors:

- Doctor or Reception
- Lab Tech
- Billing

Steps:

1. Doctor or reception creates lab order.
2. Bill item is created if configured.
3. Lab collects sample.
4. Lab updates status to processing.
5. Lab enters result.
6. Lab verifies/finalizes result.
7. Doctor sees result in consultation/patient history.
8. Patient timeline shows report.

Acceptance:

- Status transitions are enforced.
- Result has reference range and abnormal flag.
- Printable report exists.

### Workflow 6: IPD Admission To Discharge

Actors:

- Doctor
- Nurse
- IPD Staff
- Billing

Steps:

1. Doctor requests admission or reception admits directly.
2. IPD assigns ward and bed.
3. Bed status becomes occupied.
4. Nurses add notes and vitals.
5. Doctors add daily rounds.
6. Lab orders, medications, procedures, and room charges are added.
7. Discharge summary is prepared.
8. Final bill is generated.
9. Payment or insurance settlement is completed.
10. Patient is discharged.
11. Bed becomes available.

Acceptance:

- Bed cannot be double booked.
- Discharge requires final summary and reason.
- Bed status changes correctly.
- IPD charges flow to billing.

### Workflow 7: Insurance Claim Settlement

Actors:

- Billing
- Insurance Staff
- Patient

Steps:

1. Patient policy is added.
2. Policy is attached to bill or admission.
3. Insurance claim is created.
4. Claim is submitted.
5. Claim is approved or rejected.
6. Approved amount is recorded.
7. Insurance payment is posted.
8. Patient share is calculated.
9. Bill is closed when all shares are settled.

Acceptance:

- Duplicate settlement is blocked.
- Patient share and insurer share are visible.
- Rejection requires reason.
- Claim settlement updates receivables.

---

## 13. Feature Completion Standard

A feature is complete only when:

1. API endpoint exists.
2. UI workflow exists.
3. Permission check exists.
4. Module entitlement check exists.
5. Tenant isolation is proven.
6. Audit log exists where needed.
7. Loading, empty, success, and error states exist.
8. Seed/demo data supports the workflow.
9. Automated or manual E2E proof passes.

A module is complete only when its main workflows pass from start to finish.

---

## 14. Build Phases From Scratch

### Phase 1: Foundation

Build:

- Monorepo setup
- Database schema baseline
- Auth integration
- Tenant model
- User and membership model
- Roles and permissions
- Module entitlements
- Audit log
- App shell
- Login
- `/auth/me`

Acceptance:

- Super Admin can log in.
- Tenant user can log in.
- `/auth/me` returns role, permissions, modules, tenant memberships.
- API build, web build, Prisma validate pass.

### Phase 2: Platform SaaS

Build:

- Platform dashboard
- Create hospital
- Select plan/modules
- Bootstrap tenant defaults
- Invite first Hospital Admin
- Suspend/reactivate tenant
- Platform audit

Acceptance:

- New tenant can be created without DB edits.
- Hospital Admin can log in.
- Hospital Admin is not Super Admin.
- Module toggles work.

### Phase 3: Hospital Workspace Setup

Build:

- Hospital profile
- Facilities
- Departments
- Service catalog
- Ward setup
- Lab catalog setup
- Insurance provider setup
- Setup checklist

Acceptance:

- Admin can configure workspace from UI.
- Disabled module setup sections are hidden.

### Phase 4: Staff And Provider Management

Build:

- Invite staff
- Firebase account creation
- Assign roles
- Assign departments
- Create provider profiles
- Deactivate/reactivate
- Password reset

Acceptance:

- Doctor invite creates provider profile.
- Staff dashboards match roles.
- Deactivated users cannot access tenant.

### Phase 5: Patient And OPD

Build:

- Patient registration
- Patient detail
- Search
- Consent
- Patient timeline
- Appointment booking
- Walk-in
- Check-in
- Queue
- Doctor assignment

Acceptance:

- Reception can complete patient arrival workflow.
- Doctor sees checked-in patient.

### Phase 6: Doctor Consultation

Build:

- Doctor queue
- Consultation workspace
- Vitals
- Diagnosis
- Notes
- Prescription
- Lab order
- IPD request
- Follow-up
- Complete visit

Acceptance:

- Consultation creates downstream prescription/lab/billing records.

### Phase 7: Billing And Payments

Build:

- Service catalog
- Bill creation
- Auto bills
- Payments
- Receipts
- Invoices
- Discounts
- Cancel with reason
- Refund with reason

Acceptance:

- Bill lifecycle works from unpaid to paid.
- Refund and cancel are audited.

### Phase 8: Pharmacy And Inventory

Build:

- Inventory item master
- Supplier
- Purchase/stock-in
- Batch tracking
- Low stock alert
- Expiry alert
- Prescription dispense
- FEFO stock deduction
- Pharmacy bill

Acceptance:

- Dispense fails if stock is missing.
- Stock ledger is correct.

### Phase 9: Lab

Build:

- Lab catalog
- Orders
- Sample collection
- Status lifecycle
- Results
- Verification
- Reports
- Billing integration

Acceptance:

- Lab report appears in patient timeline and doctor view.

### Phase 10: IPD

Build:

- Ward and bed management
- Admission
- Bed transfer
- Nursing notes
- Daily rounds
- Charges
- Discharge summary
- Final billing

Acceptance:

- Admit and discharge workflow is complete.
- Bed state remains correct.

### Phase 11: Insurance

Build:

- Providers
- Patient policies
- Claims
- Status workflow
- Settlement
- Patient share
- Receivables

Acceptance:

- Insurance settlement updates bill and receivables.

### Phase 12: Reports And Dashboards

Build:

- Role dashboards
- Operational reports
- Financial reports
- Inventory reports
- Clinical reports
- Platform reports

Acceptance:

- Every role has useful first screen.
- Reports respect permissions and modules.

### Phase 13: Testing And Production Readiness

Build:

- RBAC tests
- Tenant isolation tests
- API workflow tests
- Frontend smoke tests
- CI/CD
- Environment validation
- Logging
- Monitoring
- Backups
- Deployment docs

Acceptance:

- Fresh production-like deploy can onboard a new hospital and complete core workflows.

---

## 15. Required E2E Proofs

Before production, prove these workflows:

1. Super Admin creates tenant -> invites Hospital Admin -> Hospital Admin configures workspace -> invites staff.
2. Patient registration -> OPD -> doctor consultation -> prescription -> pharmacy dispense -> bill -> payment.
3. OPD -> lab order -> sample -> result -> billing -> doctor sees result.
4. IPD admit -> bed occupied -> charges -> discharge -> bed available -> final bill.
5. Insurance policy -> claim -> approval -> insurer payment -> patient share -> bill settled.
6. Tenant A user cannot see Tenant B patients, bills, labs, admissions, or inventory.
7. Disabled module API returns forbidden.
8. User missing permission receives forbidden.

---

## 16. Suggested Parallel Work Streams

### Developer A: Platform And Auth

- Auth
- Tenant context
- RBAC
- Module entitlements
- Platform dashboard
- Tenant onboarding

### Developer B: Hospital Admin And Staff

- Workspace setup
- Facilities
- Departments
- Service catalog
- Staff invite
- Provider profiles

### Developer C: Patient, OPD, Doctor

- Patient records
- Reception
- Appointments
- Queue
- Consultation
- Prescription

### Developer D: Billing, Pharmacy, Inventory

- Billing
- Payments
- Receipts
- Inventory
- Pharmacy dispense
- Stock ledger

### Developer E: Lab, IPD, Insurance

- Lab lifecycle
- IPD admission/discharge
- Insurance claims
- Reports integration

### Developer F: QA, Seed, Tests, Production

- Seed data
- Dev impersonation
- E2E tests
- CI/CD
- Deployment
- Monitoring

---

## 17. Production Readiness Checklist

### Security

- Auth verified in production.
- No dev auth in production.
- All tenant APIs require tenant context.
- All routes have permissions.
- All module routes check entitlement.
- Passwords never stored by app.
- Sensitive environment variables validated.

### Data

- Tenant isolation proven.
- Migrations reviewed.
- Backups configured.
- Audit logs append-only.
- Clinical and financial records are not hard deleted.

### UX

- Role dashboards complete.
- Navigation respects modules and permissions.
- Empty states exist.
- Error states explain what happened.
- Mobile/tablet layouts tested for operational screens.
- Print views tested.

### Operations

- CI/CD pipeline.
- Health endpoints.
- Error monitoring.
- Logs.
- Production seed/bootstrap.
- Rollback plan.
- Support access policy.

---

## 18. Do Not Build These First

Avoid:

- Marketing landing page before app workflows.
- Decorative dashboards without working actions.
- Generic pharmacy billing without inventory.
- Lab result screens without status lifecycle.
- IPD bed screen without admission/discharge workflow.
- Insurance dashboard without settlement logic.
- Hardcoded tenant/user assumptions.
- Any route that bypasses RBAC or module entitlements.

---

## 19. First Build Decision

Before implementation starts, confirm:

1. Stack is accepted.
2. Module list is accepted.
3. Role list is accepted.
4. Permission model is accepted.
5. Data model is accepted.
6. Phase order is accepted.
7. First sprint will build Phase 1 only.

Once approved, implementation should begin with Phase 1 Foundation.
