# Support Access Policy

How platform (SaaS company) staff may interact with hospital tenant data, what
the system enforces today, and what is forbidden.

## Roles covered

- **Platform Super Admin** (`isPlatform = true`): operates `/platform` routes
  only. Has no tenant membership, no tenant roles, and no tenant permissions.

## What the system enforces today

1. **Platform routes are platform-only.** Every `/platform/*` route is behind
   `PlatformGuard`. Tenant users (including Hospital Admins) receive 403.
2. **Platform users have no tenant workflow access.** Tenant routes resolve
   permissions from tenant membership; a platform user has none, so clinical
   and financial endpoints reject them. There is no impersonation mechanism
   and no dev/header auth.
3. **Every platform mutation is audited** to the append-only
   `platform_audit_log` (tenant create, suspend/reactivate with reason, module
   toggles, admin invite). UPDATE/DELETE on that table are blocked by a
   database trigger and revoked from the application role.
4. **Data the platform can see** is limited to tenant operational metadata:
   tenant profile, subscription, module entitlements, staff counts, and
   platform audit entries. Patient, clinical, and financial records are
   tenant-RLS-scoped and not exposed by any platform endpoint.

## What support staff may do

- Suspend/reactivate a tenant (reason required, audited).
- Toggle module entitlements at the tenant's request (audited).
- Invite or re-invite a tenant's Hospital Admin (audited).
- Trigger a password reset for a tenant user **only** via the tenant's own
  admin (the `/staff/:id/reset-password` route is tenant-scoped; platform has
  no equivalent).

## What is forbidden

- Reading or editing tenant clinical/financial records through any channel,
  including direct database access, except during a declared incident with the
  tenant's written consent.
- Sharing tenant data across tenants for any reason.
- Any access path that bypasses the audit log.

## Known gap (deliberate, documented)

There is **no in-app "support mode"** (time-boxed, audited tenant read access
for support staff). Until it exists, any incident-driven inspection of tenant
data is a manual, owner-credential database operation that must be:
recorded in the platform audit log via a manual `platform_audit_log` insert
(`action = support.access`, metadata describing scope and consent), approved
by the tenant in writing, and limited to the minimum necessary rows.
