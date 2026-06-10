# Rollback Runbook

Procedures for recovering a bad production deploy. Work top-down: the cheapest,
most reversible action first.

## 1. Application image rollback (no schema change)

If a release is bad but the database schema is unchanged, redeploy the previous
image tag. This is the fastest, safest path — prefer it whenever possible.

```bash
# pin both services to the last-good tag and restart
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production \
  up -d --no-deps api web    # with hms-api:<prev>, hms-web:<prev>
```

Then run the smoke gate (`infra/scripts/smoke.sh`). Always deploy by immutable tag
(e.g. a git SHA), never `latest`, so a previous build is always retrievable.

## 2. Failed migration

`prisma migrate deploy` applies pending migrations transactionally where the SQL
allows. If a deploy fails mid-migration:

1. **Do not** start the new app image against a half-migrated DB — the health
   check / readiness probe should keep it out of rotation.
2. Inspect: `pnpm --filter @hms/db exec prisma migrate status`.
3. If the migration partially applied and is not auto-rolled-back, restore from the
   pre-deploy backup (section 3) into the prod DB, then redeploy the previous image.
4. Fix the migration forward in a new migration; never edit an already-applied
   migration file.

**Warnings around irreversible migrations:**
- Column/table **drops** and type narrowing are destructive and not reversible by
  re-running an older image — they require a restore.
- **Always take a fresh backup immediately before** any deploy that includes a
  migration (`infra/scripts/backup.sh`).
- The `audit_log` / `platform_audit_log` tables are append-only (DB triggers +
  REVOKE). A migration must never try to mutate or drop them in place.

## 3. Database restore from backup

Last resort for data corruption or an irreversible migration:

1. Take a final backup of the current (broken) state for forensics.
2. Put the app in maintenance (scale API to 0 / drain traffic).
3. Restore the last-good dump. Validate in **staging first** with
   `infra/scripts/restore.sh`; for the real production DB use the same flow with
   `ALLOW_PROD_RESTORE=1` only after a deliberate go decision.
4. Re-apply RLS (`pnpm db:rls`) — the restore script does this automatically.
5. Redeploy the matching previous app image and run the smoke gate.

## 4. Emergency tenant suspension

To immediately cut off a single hospital (compromise, abuse, billing) without a
full rollback, suspend the tenant — this blocks all of its logins and API access at
the tenant-status guard, is reversible, and is audited:

- **Preferred (UI/API):** Super Admin → `POST /platform/tenants/:id/suspend`
  with a `reason` (reactivate later via `/activate`).
- **Break-glass (DB):** as the owner role,
  `UPDATE tenant SET status='SUSPENDED' WHERE id='<tenantId>';`
  then record the action in `platform_audit_log` (`action='tenant.suspend'`,
  metadata describing who/why). Reverse with `status='ACTIVE'`.

Suspension is immediate on the tenant's next request; existing tokens cannot bypass
it because the tenant-status guard re-checks on every request.

## 5. After any rollback

- Run `infra/scripts/smoke.sh` (health, unauth 401, web login, optional auth check).
- Confirm `audit_log` / `platform_audit_log` are intact and append-only.
- Write an incident note: what failed, what was restored, data-loss window (if any).
