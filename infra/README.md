# Infrastructure

## Local stack

`docker-compose.yml` (repo root) provides:

| Service | Host port | Notes |
|---|---|---|
| Postgres 16 | 5433 | db `hms`; volume `hms_pgdata` |
| Redis 7 | 6380 | reserved for future use |

```bash
pnpm services:up      # start Postgres + Redis
pnpm db:setup         # migrate + apply RLS + seed
```

Ports 5433/6380 (and API/web on 4000/4001) are intentionally offset to avoid collisions with any other local stack on 3000/3001/5432/6379.

## Database roles (required for RLS)

- `postgres` (owner) — used by migrations, seed, and `platformDb`. Bypasses RLS.
- `hms_app` (non-owner) — used by tenant-scoped queries. `FORCE ROW LEVEL SECURITY` applies.

`pnpm db:rls` creates `hms_app`, grants, RLS policies, and the append-only `audit_log` trigger (`packages/db/sql/rls.sql`).

## Secrets

- API: `apps/api/firebase-service-account.json` (gitignored) via `GOOGLE_APPLICATION_CREDENTIALS`.
- Web: `NEXT_PUBLIC_FIREBASE_*` in `apps/web/.env.local`.
- Never commit `.env`, the service account, or `CREDENTIALS.md` (all gitignored).

## CI

`.github/workflows/ci.yml` runs install → build all packages → Prisma validate → migrate/rls/seed (ephemeral Postgres) → tests on every push/PR.

## Production (Phase 18, not yet built)

Managed Postgres, environment validation on boot (`requireEnv` + `firebaseConfigured`), CORS allow-list, rate limiting, backups, health checks (`GET /health`).
