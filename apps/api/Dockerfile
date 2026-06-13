# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# HMS API — production image (NestJS + Prisma).
# Build from the REPO ROOT:  docker build -f apps/api/Dockerfile -t hms-api .
#
# The same image runs both the API (`node dist/main.js`) and the DB deploy
# tasks (prisma migrate deploy / rls / seed) via the @hms/db package it carries,
# so a migration job and the API share one artifact. No secrets are baked in —
# env and the Firebase service account are provided at runtime.
# ─────────────────────────────────────────────────────────────
ARG NODE_VERSION=22-bookworm-slim

# ---- Builder: install all deps, generate Prisma client, compile TS ----
FROM node:${NODE_VERSION} AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# Workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
# Install ONLY the API's dependency closure (api + db + shared and their deps).
# This excludes the web app's toolchain (Next.js, etc.), keeping the image small.
RUN pnpm install --frozen-lockfile --filter "@hms/api..."

# Source.
COPY packages/shared packages/shared
COPY packages/db packages/db
COPY apps/api apps/api

# Build order: shared → db (prisma generate + tsc) → api.
RUN pnpm --filter @hms/shared build \
 && pnpm --filter @hms/db build \
 && pnpm --filter @hms/api build

# NOTE: dev deps are intentionally kept so this same image can also run the DB
# deploy job (prisma CLI for migrate, ts-node for the canonical seed). The API
# process itself only needs the runtime deps. Slimming via `pnpm deploy` is a
# documented future optimization.

# ---- Runner: runtime (API + DB deploy job share one artifact) ----
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /repo

# Copy the built workspace. dumb-init for correct signal handling (PID 1).
# Ownership is set during COPY (--chown) so we avoid a giant `chown -R` layer
# over node_modules (slow, and it can exhaust the snapshotter on some hosts).
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init openssl postgresql-client \
 && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=builder /repo/node_modules ./node_modules
COPY --chown=node:node --from=builder /repo/package.json ./package.json
COPY --chown=node:node --from=builder /repo/tsconfig.base.json ./tsconfig.base.json
COPY --chown=node:node --from=builder /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --chown=node:node --from=builder /repo/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --chown=node:node --from=builder /repo/packages ./packages
COPY --chown=node:node --from=builder /repo/apps/api/node_modules ./apps/api/node_modules
COPY --chown=node:node --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /repo/apps/api/package.json ./apps/api/package.json

USER node

EXPOSE 4000
# Container-level healthcheck hits the API readiness endpoint (DB + Firebase).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||process.env.PORT||4000)+'/health').then(r=>r.json()).then(j=>process.exit(j.status==='ok'?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "pnpm db:deploy && node apps/api/dist/main.js"]
