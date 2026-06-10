#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# HMS Postgres restore INTO STAGING (never production by default).
#
#   RESTORE_URL=postgresql://owner:pw@staging:5432/hms_restore \
#     ./infra/scripts/restore.sh ./backups/hms-20260610T000000Z.dump
#
# After restoring you MUST re-apply RLS (the dump is data+schema; the hms_app
# role/policies are environment-level) and validate. This script refuses a URL
# whose database name looks like production unless ALLOW_PROD_RESTORE=1.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DUMP="${1:?Usage: restore.sh <dump-file>}"
: "${RESTORE_URL:?Set RESTORE_URL (owner connection) to the STAGING target}"
[ -f "$DUMP" ] || { echo "Dump not found: $DUMP" >&2; exit 1; }

URL="${RESTORE_URL%%\?*}"
DBNAME="$(basename "${URL##*/}")"
if [[ "$DBNAME" =~ prod ]] && [[ "${ALLOW_PROD_RESTORE:-0}" != "1" ]]; then
  echo "Refusing to restore into a database named '$DBNAME' (looks like production)." >&2
  echo "Set ALLOW_PROD_RESTORE=1 to override (you almost never should)." >&2
  exit 2
fi

echo "Restoring $DUMP → $URL"
# --clean --if-exists makes the restore idempotent into an existing staging DB.
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$URL" "$DUMP"

echo "→ Re-applying RLS to the restored database..."
DATABASE_URL="$RESTORE_URL" node "$(dirname "$0")/../../packages/db/scripts/apply-rls.mjs"

echo "→ Validating restore (row counts on key tables)..."
psql "$URL" -v ON_ERROR_STOP=1 -c \
  "SELECT 'tenant' t, count(*) FROM tenant UNION ALL \
   SELECT 'user', count(*) FROM \"user\" UNION ALL \
   SELECT 'patient', count(*) FROM patient UNION ALL \
   SELECT 'audit_log', count(*) FROM audit_log;"
echo "✓ Restore + RLS re-apply complete. Run a smoke test against the staging API before promoting."
