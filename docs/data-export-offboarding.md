# Data Export And Tenant Offboarding Policy

What a hospital tenant receives when leaving the platform, who may request it,
and the operational steps. This document describes the **current** capability;
where tooling does not exist yet it defines the manual procedure.

## Who may request

- The tenant's **Hospital Admin** (verified against the tenant's active
  `HOSPITAL_ADMIN` membership), or
- A platform Super Admin acting on a written request from the tenant.

## What the tenant receives

A per-table export of **all rows belonging to their `tenantId`**, covering
every tenant-scoped table (patients, encounters, vitals, diagnoses, notes,
prescriptions, lab orders/results, pharmacy dispenses, inventory, bills,
payments, refunds, admissions, claims, notifications, audit log). Identity
rows (`user`, `tenant_user`, roles) are included for the tenant's members.

- **Format:** one CSV file per table (UTF-8, header row), plus a manifest
  listing table → row count. JSON is available on request.
- **Money fields** are exported as stored (minor units / paise).
- **Audit log** is included in full; it is append-only and exported as-is.

## How the export is produced (manual procedure — no endpoint yet)

There is currently **no self-service export endpoint**. A platform operator
runs the export with owner credentials:

1. Verify the request (tenant identity + requester role).
2. Record the export in the platform audit log
   (`action = tenant.export`, metadata: requester, scope).
3. For each tenant-scoped table:
   `\copy (SELECT * FROM <table> WHERE tenant_id = '<tenantId>') TO '<table>.csv' CSV HEADER`
4. Deliver via an encrypted archive to the verified Hospital Admin contact
   email on file.

## Retention and deletion after offboarding

- On contract end the tenant is **suspended** (reason required, audited) —
  this immediately blocks all tenant logins and API access.
- Data is retained in suspended state for **90 days** so the export can be
  re-run or disputed, then deleted on written confirmation.
- Clinical/financial rows are never hard-deleted while the tenant is active;
  deletion happens only as part of confirmed offboarding and is recorded in
  the platform audit log (`action = tenant.offboard.delete`).
- Backups age out on the normal backup rotation; deletion from live data does
  not rewrite historical backups.

## Known gaps (deliberate, documented)

- No self-service export endpoint or UI; the procedure above is manual.
- No automated 90-day deletion job; offboarding deletion is operator-run.
Both are deferred to post-core work and tracked in the implementation plan.
