#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Post-deploy smoke test. Verifies the API is healthy (process + DB +
# Firebase configured) and the web login page serves. Exits non-zero on failure
# so it can gate a deploy. Optionally runs an authenticated /auth/me check.
#
#   API_URL=https://api.example.com WEB_URL=https://app.example.com \
#     ./infra/scripts/smoke.sh
#
# Optional authenticated check (needs the Firebase web API key + a real user):
#   FIREBASE_API_KEY=... SMOKE_EMAIL=... SMOKE_PASSWORD=... ./infra/scripts/smoke.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

API_URL="${API_URL:-http://localhost:4000}"
WEB_URL="${WEB_URL:-http://localhost:4001}"
fail() { echo "✗ $1" >&2; exit 1; }

echo "→ API health: $API_URL/health"
HEALTH="$(curl -fsS --max-time 10 "$API_URL/health")" || fail "API health request failed"
echo "$HEALTH"
echo "$HEALTH" | grep -q '"status":"ok"' || fail "API health is not 'ok'"
echo "$HEALTH" | grep -q '"db":"up"' || fail "Database connectivity is down"
echo "$HEALTH" | grep -q '"firebaseConfigured":true' || fail "Firebase is not configured"

echo "→ API rejects unauthenticated tenant routes"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$API_URL/patients")"
[ "$CODE" = "401" ] || fail "Expected 401 on unauthenticated /patients, got $CODE"

echo "→ Web login page: $WEB_URL/login"
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$WEB_URL/login")"
[ "$CODE" = "200" ] || fail "Web /login returned $CODE"

if [ -n "${FIREBASE_API_KEY:-}" ] && [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
  echo "→ Authenticated /auth/me check for $SMOKE_EMAIL"
  TOKEN="$(curl -fsS --max-time 10 \
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\",\"returnSecureToken\":true}" \
    | sed -n 's/.*"idToken":"\([^"]*\)".*/\1/p')"
  [ -n "$TOKEN" ] || fail "Firebase sign-in failed"
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -H "Authorization: Bearer $TOKEN" "$API_URL/auth/me")"
  [ "$CODE" = "200" ] || fail "/auth/me returned $CODE for a valid token"
  echo "  ✓ authenticated /auth/me = 200"
fi

echo "✓ Smoke test passed."
