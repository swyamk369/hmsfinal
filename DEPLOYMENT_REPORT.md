# HMS SaaS — Production Deployment Report & Runbook

**Prepared:** 2026-06-13 · **App:** `hms-saas` (multi-tenant Hospital Management System)
**Repo:** https://github.com/swyamk369/hmsfinal · **Branch:** `main` · **HEAD:** `fc1fd4d`
**Prepared by:** DevOps audit pass (Cowork)

> ⚠️ **Scope of this document.** This is a *verified production-readiness audit + executable
> runbook*. The actual production deploy, live key rotation, production-DB backup, and
> live smoke tests must be executed by you on your own infrastructure — they require host,
> cloud/Firebase-console, and production-DB credentials that are not available from this
> environment. Every command you need is below, in order, ready to run.

---

## 1. Executive summary

The repository is **well-engineered for production** and ships most of its own deployment
machinery: multi-stage Dockerfiles, a production compose file, a fail-fast environment
validator, RLS enforcement at the database layer, append-only audit tables, ops scripts
(backup/restore/smoke), and runbooks under `docs/`. The audit found **no committed secrets
and no secrets in git history**.

**Blockers to resolve before deploy (2):**

1. **Dirty working tree** — 24 modified files are uncommitted on `main`. Per your instruction
   they are treated as the release content, but they **must be committed and tagged** before a
   real deploy so the release is reproducible and rollback has a target. (See §3, §11.)
2. **No production secrets/infra are provisioned yet** — the only env on disk is the local
   **dev** config (`NODE_ENV=development`, `CORS_ORIGIN=http://localhost:4001`). Production
   needs its own DB, its own Firebase service account, its own Gemini key, and the real web
   domain (see §2, §4, §5).

Everything else (CORS enforcement, RLS, audit immutability, env validation, boot guards) is
already correct in code.

---

## 2. What gets deployed

| Component | Source | Runtime | Port | Notes |
|---|---|---|---|---|
| **API** (`@hms/api`, NestJS) | `apps/api/Dockerfile` | `pnpm start:api` (`start:prod`) | 4000 | Verifies Firebase tokens, enforces RLS via two DB roles, serves `/health`. |
| **Web** (`@hms/web`, Next.js 14 standalone) | `apps/web/Dockerfile` | `pnpm start:web` | 4001 | **`NEXT_PUBLIC_*` are baked at BUILD time** (build-args), not runtime. |
| **DB migrate job** (one-shot) | `hms-api:latest` running `pnpm db:deploy` | exits 0 | — | `migrate → RLS → canonical seed`. No demo users in prod seed. |
| **Postgres 16** | compose service *or managed* | — | 5432 | Prefer **managed Postgres** in real prod; drop the compose `postgres` service. |
| Shared/DB packages | `@hms/shared`, `@hms/db` | build deps | — | Must be built before api/web (`pnpm build` does this in order). |

**Build artifacts (from repo root):**

```bash
docker build -f apps/api/Dockerfile -t hms-api:<GIT_SHA> .
docker build -f apps/web/Dockerfile -t hms-web:<GIT_SHA> \
  --build-arg NEXT_PUBLIC_API_URL=https://api.YOUR-DOMAIN.com \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=<prod web key> \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<prod>.firebaseapp.com \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=<prod project id> \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID=<prod app id> .
```

> **Tag by immutable git SHA, never `latest`** — rollback (§11) depends on the previous tag
> still being pullable.

---

## 3. Release readiness (repo hygiene)

- **Branch/commit:** `main` @ `fc1fd4d` (Phase 22 complete; Phases 0–18, 21.1–21.2 done).
- **Uncommitted (the release content per your decision):** 24 files across
  `apps/api/src/{ai,auth,common,patient-public,support}`, API tests, and
  `apps/web/src/{app,components,lib}`. **Action required:** commit + tag before deploy.
- **17 Prisma migrations** present, latest `20260612040000_add_hospital_finance_thresholds`.
- **Test baseline (per CLAUDE.md, keep green):** API **278**, Web **276**.
- **CI** (`.github/workflows/ci.yml`): install → build → prisma validate → migrate/RLS/seed on
  ephemeral Postgres → tests, on every push/PR.

---

## 4. Required production environment variables

Secrets are **never** baked into images for the API; the web image bakes only the public
`NEXT_PUBLIC_*` values (which are non-secret by design — a Firebase web API key is a public
client identifier, not a credential). Production values must be **separate from dev**.

### 4a. API — runtime env (injected at run, e.g. `infra/.env.production`)

| Variable | Required | Purpose / rule |
|---|---|---|
| `NODE_ENV` | ✅ | Must be `production` (activates the strict boot guards). |
| `DATABASE_URL` | ✅ | **Owner** role — migrations, seed, platform/auth client. Bypasses RLS. |
| `APP_DATABASE_URL` | ✅ | **Non-owner** `hms_app` role — every tenant query. Must **differ** from `DATABASE_URL` and **must not** use the dev password `app_pw`. |
| `CORS_ORIGIN` | ✅ | Comma-separated prod web origin(s). **No localhost/loopback** — API refuses to boot otherwise. |
| `API_PORT` | ✅ | `4000`. |
| `THROTTLE_LIMIT` | ✅ | `300` (default). Must be ≤ 10000 in prod (>10000 rejected as an E2E override). |
| `THROTTLE_TTL_MS` | ✅ | `60000`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅* | Path to mounted Firebase service-account JSON (preferred). |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | ✅* | Alternative to the JSON file (\*one of the two Firebase paths is required). |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ (for AI chatbot) | Gemini key for the HMS Assistant. `GEMINI_API_KEY` accepted as fallback. Without it the chatbot returns a friendly "needs a key" message; rest of app works. |
| `GOOGLE_GENERATIVE_AI_MODEL` | optional | Override default model. |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` / `SUPERADMIN_NAME` | ⚙️ once | Used only by `bootstrap:superadmin` to create the first platform admin. Not needed at steady-state runtime. |
| `NOTIFICATION_*` (email/SMS/WhatsApp provider+key) | optional | Unset = external delivery recorded `SKIPPED`; in-app notifications still work. |
| `SENTRY_DSN`, `LOG_LEVEL` | optional | Error tracking / log verbosity. |

### 4b. Web — **build-time** args (baked into the image)

| Build arg | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Must point at the **production API domain** (e.g. `https://api.YOUR-DOMAIN.com`). Changing it later means **rebuilding the web image**. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase web SDK (public client key). |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | `<project>.firebaseapp.com`. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Prod Firebase project. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | Prod web app id. |

### 4c. Web — runtime env

| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | ✅ | `production`. |
| `PORT` | ✅ | `4001`. |

---

## 5. Secrets handling & key rotation

**Audit result — clean:**

- ✅ No `.env`, `CREDENTIALS.md`, or `firebase-service-account.json` is tracked in git, and a
  full `git log --all` diff scan found **none ever committed**.
- ✅ The only `AIza…` string in history is a Google **image** URL in extracted frontend HTML —
  not an API key (real Google keys start `AIzaSy`).
- ✅ `.gitignore` correctly excludes `.env*`, `*.local`, `CREDENTIALS.md`, and
  `**/firebase-service-account.json`.
- ✅ Source code contains no hardcoded secrets; `firebase-credentials.ts` is resolution logic only.
- ⚠️ Real secrets **do** live on disk (gitignored) in `apps/api/.env` and `apps/web/.env.local`,
  but that is the **dev** environment.

**Rotation guidance:**

- Nothing is *exposed*, so no emergency rotation is forced by a leak. **However**, production
  must use **brand-new, separate** credentials from dev — do **not** reuse the dev Gemini key,
  dev Firebase service account, or dev DB passwords in production.
- Generate for production: a **new Firebase service-account key** (Firebase console → Project
  settings → Service accounts), a **new Gemini API key** (Google AI Studio / Cloud console),
  and **strong, unique** `DATABASE_URL` / `APP_DATABASE_URL` passwords (the `hms_app` password
  must not be `app_pw` — the boot guard rejects it).
- Store the service-account JSON on the host at a restricted path (e.g.
  `/opt/hms/secrets/firebase-service-account.json`, `chmod 600`) and mount it read-only; never
  put the private key in a committed file.
- If the dev keys in `apps/api/.env` / `apps/web/.env.local` were ever shared (screen-share,
  chat, etc.), rotate those too as a precaution.

---

## 6. Firebase setup (verified)

- **Admin (API):** `apps/api/src/common/firebase-credentials.ts` resolves credentials in order:
  `GOOGLE_APPLICATION_CREDENTIALS` → `FIREBASE_SERVICE_ACCOUNT` → `firebase-service-account.json`
  in cwd → `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`. The prod compose mounts the JSON at
  `/run/secrets/firebase-service-account.json`. The boot guard **fails fast** if none resolve.
- **Web:** `NEXT_PUBLIC_FIREBASE_*` baked at build time (§4b).
- Auth is **Firebase-only in all environments** — there is no dev-header bypass to disable.
- Reference: `docs/firebase-production.md`.

---

## 7. AI / Gemini chatbot setup (verified)

- API-side only (`apps/api/src/ai/ai.service.ts`), using `@ai-sdk/google`
  (`createGoogleGenerativeAI`). Key read from `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`).
- The assistant can raise support tickets via a tool call (verify in smoke tests, §10).
- System prompt explicitly forbids revealing secrets/keys/credentials/PHI and respects tenant
  boundaries — good. Missing key degrades gracefully (chatbot only), no crash.

---

## 8. CORS & API URL (verified)

- **CORS** (`apps/api/src/main.ts`): origin allow-list from `CORS_ORIGIN` (comma-split, trimmed),
  `credentials: true`, restricted allowed headers. `env.validation.ts` **rejects boot** in
  production if `CORS_ORIGIN` is missing or contains `localhost`/`127.0.0.1`/`0.0.0.0`.
  → **Set `CORS_ORIGIN` to exactly your production web origin(s).**
- **`NEXT_PUBLIC_API_URL`** is **build-time** for the web image → must be set to the production
  API domain in the `docker build` args (§2/§4b). It cannot be changed without a rebuild.

---

## 9. Database: migrations, RLS, seed (verified)

`pnpm db:deploy` = `db:migrate` → `db:rls` → `db:seed`:

1. **`prisma migrate deploy`** — applies the 17 migrations transactionally.
2. **RLS** (`packages/db/sql/rls.sql` via `apply-rls.mjs`) — creates the non-owner `hms_app`
   role, then `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy
   (`tenant_id = current_setting('app.current_tenant_id')`) on **66 tenant tables**
   (patient, appointment, encounter, bill, prescription, lab_*, ipd_*, insurance_*, online_booking,
   prescription_refill_request, …). Also installs append-only triggers on `audit_log` /
   `platform_audit_log` and grants the app role INSERT/SELECT-only there. **Idempotent.**
3. **Seed** (`prisma/seed.ts`) — canonical permissions, roles, plans, modules **only**
   (no demo users). First Super Admin is created separately via
   `pnpm --filter @hms/api bootstrap:superadmin`.

> **Two distinct DB roles are mandatory** for RLS to enforce. If `DATABASE_URL` ==
> `APP_DATABASE_URL` the boot guard refuses to start (RLS would never isolate tenants).

**Always back up immediately before any deploy that includes a migration** (§10 step 4,
`infra/scripts/backup.sh`).

---

## 10. Deployment runbook (execute in this order)

### Pre-deploy gates (run locally / in CI before building images)

```bash
pnpm install --frozen-lockfile
pnpm --config.verifyDepsBeforeRun=false lint
pnpm --config.verifyDepsBeforeRun=false --filter @hms/api exec jest --runInBand   # expect 278 green
pnpm --config.verifyDepsBeforeRun=false --filter @hms/web exec jest --runInBand   # expect 276 green
pnpm --filter @hms/db exec prisma validate
pnpm --config.verifyDepsBeforeRun=false build
```

> Do **not** run `pnpm --filter @hms/web build` while `next dev` is live (shared `.next`
> corrupts dev manifests — see CLAUDE.md ritual).

### Step 1 — Freeze the release

```bash
git add -A && git commit -m "release: production deploy <date>"   # commit the 24 changes
git tag -a v<X.Y.Z> -m "production release"
git push origin main --tags
GIT_SHA=$(git rev-parse --short HEAD)
```

### Step 2 — Provision production secrets/env

- Create `infra/.env.production` from `infra/.env.production.example` (never commit it).
- Place the **prod** Firebase service-account JSON at `FIREBASE_SERVICE_ACCOUNT_FILE` (host path, `chmod 600`).
- Set strong `POSTGRES_PASSWORD`, `DATABASE_URL`, `APP_DATABASE_URL` (distinct roles/passwords),
  `CORS_ORIGIN=https://app.YOUR-DOMAIN.com`, `GOOGLE_GENERATIVE_AI_API_KEY`.

### Step 3 — Build images (tag by SHA)

See §2. Pass the prod `NEXT_PUBLIC_*` as web build-args.

### Step 4 — **Back up the database** (skip only on a truly empty first deploy)

```bash
DATABASE_URL="<owner conn>" ./infra/scripts/backup.sh ./backups
# encrypt the dump and ship it off-host before proceeding
```

### Step 5 — Deploy in order: DB → API → Web

The compose enforces boot order `postgres (healthy) → migrate (db:deploy) → api → web`:

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production up -d
# the one-shot `migrate` job runs `pnpm db:deploy` (migrate → RLS → seed) and exits 0
```

Confirm the migrate job exited 0:
```bash
docker compose -f infra/docker-compose.prod.yml logs migrate | tail -20
pnpm --filter @hms/db exec prisma migrate status   # against the prod DB
```

### Step 6 — First Super Admin (first deploy only)

```bash
SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... pnpm --filter @hms/api bootstrap:superadmin
```

### Step 7 — Automated smoke gate

```bash
API_URL=https://api.YOUR-DOMAIN.com WEB_URL=https://app.YOUR-DOMAIN.com \
  ./infra/scripts/smoke.sh
# optional authenticated check:
FIREBASE_API_KEY=<web key> SMOKE_EMAIL=<staff> SMOKE_PASSWORD=<pw> \
  API_URL=... WEB_URL=... ./infra/scripts/smoke.sh
```

`smoke.sh` checks: `/health` = ok + `db:up` + `firebaseConfigured:true`; unauth `/patients` → 401;
web `/login` → 200; optional `/auth/me` → 200 with a real token.

### Step 8 — Manual smoke checklist (your required flows)

| Flow | Pass criterion |
|---|---|
| Staff login | `/login` → lands on role page (e.g. admin → `/admin`). |
| Platform super admin login | logs in → `/platform`; tenant routes 403. |
| Platform support login | support user reaches support queue; **no PHI** visible. |
| Patient portal login | `/patient/login` → `/patient/dashboard`, **no 500**. |
| Tenant creates manual support ticket | ticket created in tenant scope. |
| Ticket appears in Platform Global Support | visible in `/platform/support`. |
| Open ticket detail + reply | tenant can read/reply on `/support/[id]`. |
| AI chatbot answers basics | returns a helpful answer (Gemini key set). |
| AI chatbot raises a ticket | tool call creates a support ticket. |
| Patient portal no 500 | all portal tabs render. |
| Patient booking | booking writes an Appointment into the correct tenant. |
| Booking approve/reject/reschedule | staff action sends notification. |
| Patient refill request → Pharmacy queue | appears in pharmacy queue. |
| Pharmacy approve/reject/dispense refill | state transitions work. |
| Support cannot access PHI | confirmed by absence of any tenant-data endpoint for platform users (see §12). |

---

## 11. Rollback plan

Order: cheapest/most-reversible first (full detail in `docs/rollback.md`).

1. **Tag the current good release** (Step 1) and keep the **previous** `hms-api`/`hms-web` SHA
   images pullable. Always deploy by SHA, never `latest`.
2. **App-only rollback (no schema change):** repoint api/web to the previous SHA and restart:
   ```bash
   docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.production \
     up -d --no-deps api web    # using hms-api:<prev>, hms-web:<prev>
   ```
   then re-run `smoke.sh`.
3. **Failed migration:** do not run the new image against a half-migrated DB; inspect with
   `prisma migrate status`; fix forward in a new migration — never edit an applied migration.
4. **Data corruption / irreversible migration (last resort):** take a forensic backup, drain
   traffic, restore the pre-deploy dump (validate in **staging first** via
   `infra/scripts/restore.sh`; prod restore needs `ALLOW_PROD_RESTORE=1`); RLS is re-applied
   automatically by the restore script.

**Decision rule:** app deploy bad but schema unchanged → roll back API/web only. Restore the DB
**only** if a migration caused schema/data damage.

---

## 12. Known warnings & gaps

- **Dirty tree must be committed + tagged** before deploy (§3). Non-negotiable for reproducibility.
- **PHI / support access — by design, no in-app "support mode".** Platform/support staff have
  *no tenant membership and no endpoint* that returns clinical/financial records, so the
  "support cannot access PHI" requirement holds **by construction**. The flip side: there is no
  time-boxed, audited in-app support read access — any incident inspection is a **manual
  owner-credential DB operation** that must be logged to `platform_audit_log`
  (`action = support.access`) with written tenant consent (`docs/support-access-policy.md`).
  If you need self-service temporary tenant access for support, that feature does not yet exist.
- **`NEXT_PUBLIC_API_URL` and Firebase web config are build-time** — wrong values mean a web
  rebuild, not just a restart. Double-check build-args before pushing the web image.
- **Use managed Postgres in real production** and drop the compose `postgres` service; point
  both DB URLs at the managed instance.
- **DB dumps contain PHI/PII** — encrypt at rest and in transit, restrict access, apply retention.
- **Phase 22 follow-ups (non-blocking):** portal prescriptions are read-only; request-access
  links are staff-approved (no auto-link); booking email/SMS notifications depend on configuring
  `NOTIFICATION_*` (otherwise in-app only); file-upload validation is light.
- **Logs:** the AI system prompt forbids leaking secrets, and there are no secret-printing log
  lines in the audited paths; still, set `LOG_LEVEL=info` (not debug) in prod and confirm your
  log aggregator scrubs `Authorization` headers.
- **Tests/build were not executed in this pass** (you chose audit + runbook only). Run the §10
  pre-deploy gates and confirm **API 278 / Web 276 green** before building images.

---

## 13. URLs (fill in at deploy time)

| Surface | URL |
|---|---|
| Web app | `https://app.YOUR-DOMAIN.com` |
| API | `https://api.YOUR-DOMAIN.com` |
| Health check | `https://api.YOUR-DOMAIN.com/health` |
| Staff login | `…/login` |
| Patient portal | `…/patient/login` |
| Platform | `…/platform` |

---

## 14. Reference docs in repo

`docs/deployment.md` · `docs/rollback.md` · `docs/firebase-production.md` ·
`docs/support-access-policy.md` · `docs/data-export-offboarding.md` · `infra/README.md` ·
`infra/scripts/{backup,restore,smoke}.sh` · `CLAUDE.md` · `PROJECT_IMPLEMENTATION_PLAN.md`.
