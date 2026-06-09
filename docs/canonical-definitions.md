# Canonical Definitions

These are defined once in **`packages/shared/src`** and consumed by `@hms/db` (backend) and `apps/web` (frontend). Do not redefine them elsewhere.

## Modules (`modules.ts`)
`ADMIN`, `PATIENT`, `OPD`, `SCHEDULING`, `BILLING`, `LAB`, `PHARMACY`, `INVENTORY`, `IPD`, `INSURANCE`, `REPORTS`.
`ADMIN` is always enabled and cannot be disabled.

## Plans (`plans.ts`)
| Plan | Modules |
|---|---|
| STARTER | ADMIN, PATIENT, OPD, SCHEDULING, BILLING |
| GROWTH | + LAB, PHARMACY |
| PROFESSIONAL | + INVENTORY, IPD, REPORTS |
| ENTERPRISE | all (+ INSURANCE) |

Prices in minor units. Plan also carries userLimit / facilityLimit / bedLimit.

## Roles (`roles.ts`)
`SUPER_ADMIN` (platform), `HOSPITAL_ADMIN`, `HOSPITAL_MANAGER`, `RECEPTION`, `DOCTOR`, `NURSE`, `LAB_TECH`, `PHARMACIST`, `INVENTORY_MGR`, `BILLING`, `ACCOUNTANT`, `INSURANCE_STAFF`.
`ROLE_LANDING` maps each role to its landing route. `ROLE_DEFS` carries the role→permission mapping; `SUPER_ADMIN` holds only `platform.*`.

## Permissions (`permissions.ts`)
~91 granular `domain.action` keys grouped by area (platform, settings/staff, patient/OPD, clinical, nursing, lab, pharmacy/inventory, billing, IPD, insurance, reports). `PLATFORM_PERMISSIONS` are platform-only; `TENANT_PERMISSIONS` are everything else.

These are asserted by `apps/api/test/canonical.spec.ts`.
