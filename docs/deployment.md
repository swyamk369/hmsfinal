# Production Deployment Guide

How to deploy the HMS SaaS to a production-like environment. The app is a pnpm
monorepo: NestJS API, Next.js web, PostgreSQL (with Row-Level Security), and
Firebase Auth. **Auth is Firebase-only — there is no dev auth in any build.**

---

## 1. Architecture at deploy time

| Component | Image | Port | Notes |
|---|---|---|---|
| API | `hms-api` (`apps/api/Dockerfile`) | 4000 | NestJS; also runs the DB deploy job |
| Web | `hms-web` (`apps/web/Dockerfile`) | 4001 | Next.js standalone server |
| Postgres | `postgres:16` (managed in real prod) | 5432 | RLS-enforced tenant isolation |

Two DB roles are mandatory for RLS:
- **owner** (`DATABASE_URL`) — migrations, RLS apply, seed, and the platform/auth
  cross-tenant client. Bypasses RLS.
- **app** (`APP_DATABASE_URL`, role `hms_app`) — a NON-owner role; `FORCE ROW
  LEVEL SECURITY` isolates every tenant query it runs.

`packages/db/scripts/apply-rls.mjs` creates `hms_app` with the password it parses
from `APP_DATABASE_URL`, so production's strong password is applied automatically.

---

## 2. Required environment

See `.env.example` (app) and `infra/.env.production.example` (compose). Required:

| Var | Where | Notes |
|---|---|---|
| `DATABASE_URL` | API + DB jobs | owner connection |
| `APP_DATABASE_URL` | API | app (non-owner) connection; must differ from owner |
| `NODE_ENV=production` | API | enables production env guards |
| `CORS_ORIGIN` | API | comma-separated web origins; **no localhost in prod** |
| `THROTTLE_LIMIT` / `THROTTLE_TTL_MS` | API | rate limit (default 300 / 60000) |
| `GOOGLE_APPLICATION_CREDENTIALS` **or** `FIREBASE_*` | API | Firebase Admin |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_FIREBASE_*` | Web **build args** | inlined at build |
| `SUPERADMIN_EMAIL/PASSWORD/NAME` | one-time bootstrap | first platform admin |

The API **fails fast on boot** (`assertEnv`) if: a required var is missing,
owner == app URL, or (in production) CORS is localhost / the app DB still uses the
default `app_pw` / `THROTTLE_LIMIT` looks like an E2E override. This is intentional —
never boot insecurely.

### Secret handling
- Never commit `.env`, `firebase-service-account.json`, or `CREDENTIALS.md`
  (all gitignored; excluded from images via `.dockerignore`).
- No secrets are baked into images. The Firebase Admin key is mounted read-only
  at runtime (`/run/secrets/firebase-service-account.json` in the prod compose).
- The Firebase **web** config (`NEXT_PUBLIC_FIREBASE_*`) is public by design and is
  a build arg for the web image — it is not a secret.

---

## 3. Build the images

From the repo root (build context = root so workspace deps resolve):

```bash
docker build -f apps/api/Dockerfile -t hms-api:latest .

docker build -f apps/web/Dockerfile -t hms-web:latest \
  --build-arg NEXT_PUBLIC_API_URL=https://api.your-domain.com \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=... \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=... \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=... \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=... \
  .
```

---

## 4. Deploy order (migration → RLS → seed → start)

The prod compose encodes this; manually it is:

```bash
# 1. Schema migrations (idempotent; safe to re-run)
pnpm db:migrate          # = prisma migrate deploy

# 2. RLS policies + hms_app role + append-only audit triggers (idempotent)
pnpm db:rls

# 3. Canonical production seed — plans, modules, roles, permissions ONLY.
#    Contains NO demo users and NO auth shortcuts.
pnpm db:seed

# (1–3 combined:)  pnpm db:deploy

# 4. First platform admin (run ONCE; reads SUPERADMIN_* env)
pnpm --filter @hms/api bootstrap:superadmin

# 5. Start
pnpm start:api   # node dist/main.js
pnpm start:web   # next standalone server
```

With the prod compose this is automatic — the `migrate` one-shot service runs
`pnpm db:deploy` and the `api`/`web` services start after it completes:

```bash
cp infra/.env.production.example infra/.env.production   # then fill it in
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
# bootstrap the first Super Admin once:
docker compose -f infra/docker-compose.prod.yml run --rm api pnpm --filter @hms/api bootstrap:superadmin
```

After deploy, onboarding is fully UI-driven: the Super Admin signs in at `/platform`,
creates a hospital tenant, picks a plan/modules, and invites the Hospital Admin —
**no manual DB edits required**.

---

## 5. Health checks

`GET /health` (public) returns API process status, **database connectivity**, and
Firebase-config status:

```json
{ "status": "ok", "db": "up", "firebaseConfigured": true, "ts": "..." }
```

Both images declare a Docker `HEALTHCHECK` (API hits `/health`; web hits `/login`).
Wire your orchestrator's liveness/readiness probes to these. Run the post-deploy
smoke gate:

```bash
API_URL=https://api.your-domain.com WEB_URL=https://app.your-domain.com \
  ./infra/scripts/smoke.sh
```

---

## 6. Backups & restore

```bash
# Backup (compressed custom-format dump; verifies its own TOC)
DATABASE_URL=postgresql://owner:pw@host:5432/hms ./infra/scripts/backup.sh ./backups

# Restore INTO STAGING (refuses prod-named DBs unless ALLOW_PROD_RESTORE=1),
# then re-applies RLS and validates row counts
RESTORE_URL=postgresql://owner:pw@staging:5432/hms_restore \
  ./infra/scripts/restore.sh ./backups/hms-<stamp>.dump
```

Retention guidance: daily 30d / weekly 90d / monthly 1y (tune to compliance).
**Dumps contain tenant PHI/PII** — store only on encrypted-at-rest, access-controlled
storage; encrypt in transit. See `docs/data-export-offboarding.md` for tenant
offboarding exports.

---

## 7. Monitoring, logs, and errors

- **Structured logs**: every request is logged as a single JSON line
  (`requestId, method, path, status, durationMs, userId, tenantId`) by
  `RequestLoggerMiddleware`. The query string, headers, and request bodies are
  **never** logged, so tokens and PHI stay out of logs.
- **Correlation IDs**: each response carries `X-Request-Id`; 5xx errors are logged
  server-side with that id. Forward it from your edge/proxy for end-to-end tracing.
- **Error responses** use one shape (`{ statusCode, error, message }`) with no
  stack traces or internals (`GlobalHttpExceptionFilter`).
- **Audit logs are separate from app logs**: clinical/financial/security actions go
  to the append-only `audit_log` / `platform_audit_log` tables (DB-trigger + REVOKE
  protected), searchable via `/admin/audit` and `/platform/audit` — not stdout.
- **Error tracking hook**: set `SENTRY_DSN` (placeholder in `.env.example`) and wire
  your provider in `main.ts`/the exception filter. Ship container stdout to your log
  aggregator (Loki/CloudWatch/ELK). *(Provider SDK wiring is a documented future
  task — the env placeholders and correlation IDs are in place.)*

---

## 8. Firebase production setup

See `docs/firebase-production.md`.

---

## 9. Rollback

See `docs/rollback.md`.
