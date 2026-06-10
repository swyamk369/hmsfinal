#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# HMS Postgres backup. Produces a compressed custom-format dump.
#
#   DATABASE_URL=postgresql://owner:pw@host:5432/hms ./infra/scripts/backup.sh [outdir]
#
# WARNING: dumps contain tenant PHI/PII. Store ONLY on encrypted-at-rest storage
# with restricted access; encrypt in transit; apply your data-retention policy.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (owner connection) to the database to back up}"
OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

# Strip Prisma's ?schema= param that libpq does not understand.
URL="${DATABASE_URL%%\?*}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/hms-${STAMP}.dump"

echo "Backing up → $FILE"
# Custom format (-Fc) is compressed and restorable with pg_restore.
pg_dump --format=custom --no-owner --no-privileges --file "$FILE" "$URL"

# Integrity check: the dump must list a table-of-contents.
pg_restore --list "$FILE" >/dev/null
SIZE="$(du -h "$FILE" | cut -f1)"
echo "✓ Backup complete: $FILE ($SIZE). Encrypt and ship to off-host, access-controlled storage."
echo "Retention guidance: daily for 30d, weekly for 90d, monthly for 1y (tune to compliance needs)."
