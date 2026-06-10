# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# HMS Web — production image (Next.js App Router, standalone output).
# Build from the REPO ROOT:  docker build -f apps/web/Dockerfile -t hms-web .
#
# NOTE: NEXT_PUBLIC_* values are inlined at BUILD time. Pass them as build args
# (the API URL and Firebase web config). They are NOT secrets — the Firebase web
# config is public by design; the Admin service account (API side) is the secret.
# ─────────────────────────────────────────────────────────────
ARG NODE_VERSION=22-bookworm-slim

# ---- Builder ----
FROM node:${NODE_VERSION} AS builder
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
WORKDIR /repo

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @hms/web... --filter @hms/shared

COPY packages/shared packages/shared
COPY apps/web apps/web

# Public build-time config (inlined into the client bundle).
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_FIREBASE_API_KEY=
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=
ARG NEXT_PUBLIC_FIREBASE_APP_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

RUN pnpm --filter @hms/shared build && pnpm --filter @hms/web build

# ---- Runner: Next standalone server ----
FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production
ENV PORT=4001 HOSTNAME=0.0.0.0
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init \
 && rm -rf /var/lib/apt/lists/*

# Standalone bundle + static assets (tracing root is the repo, so paths are nested).
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4001)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
