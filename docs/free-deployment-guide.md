# Free Demo Deployment Guide

This is the zero/near-zero cost path for a public demo or staging environment.
Do not use free-tier services for real patient PHI. Move to paid plans with
proper compliance, backups, and support before production use.

## Stack

- Render Free web service: API
- Render Free web service: Web
- Neon Free Postgres: database
- Firebase Spark: authentication
- Gemini free tier: HMS Assistant

## What you need to provide

1. GitHub access
   - Render must be allowed to access `swyamk369/hmsfinal`.

2. Neon Postgres
   - Create one Neon free project.
   - Copy the owner connection string.
   - Pick a strong app-role password for `hms_app`.
   - Provide these two values:
     - `DATABASE_URL`
     - `APP_DATABASE_URL`

3. Firebase
   - Create or choose a Firebase project.
   - Enable Email/Password sign-in.
   - Create a Web app and provide:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - Generate a Firebase Admin service account and provide:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_CLIENT_EMAIL`
     - `FIREBASE_PRIVATE_KEY`

4. Gemini
   - Rotate any key that was pasted into chat.
   - Provide only the new key:
     - `GOOGLE_GENERATIVE_AI_API_KEY`

5. Render
   - Create a Render account.
   - Use the repo's `render.yaml` Blueprint.
   - Keep both services on the Free plan.
   - When Render asks for `sync: false` values, paste the secrets above.

6. First platform admin
   - Choose:
     - `SUPERADMIN_EMAIL`
     - `SUPERADMIN_PASSWORD`
     - `SUPERADMIN_NAME`

## Expected service URLs

The Blueprint uses these default Render URLs:

- API: `https://hms-final-api.onrender.com`
- Web: `https://hms-final-web.onrender.com`

If Render changes either URL because the name is unavailable, update:

- API service `CORS_ORIGIN`
- Web service `NEXT_PUBLIC_API_URL`

Then redeploy both services.

## Database URLs

Use Neon's pooled or direct connection string with SSL.

Owner URL:

```text
DATABASE_URL=postgresql://<owner>:<owner-password>@<neon-host>/<db>?sslmode=require&schema=public
```

App URL:

```text
APP_DATABASE_URL=postgresql://hms_app:<strong-app-password>@<neon-host>/<db>?sslmode=require&schema=public
```

The API pre-deploy command runs `pnpm db:deploy`, which applies migrations, RLS,
and the canonical seed. The RLS script creates/updates the `hms_app` role using
the password from `APP_DATABASE_URL`.

## Bootstrap super admin

After the API deploy succeeds, run one Render Shell command on the API service:

```bash
SUPERADMIN_EMAIL="admin@example.com" \
SUPERADMIN_PASSWORD="replace-with-a-strong-password" \
SUPERADMIN_NAME="Platform Super Admin" \
pnpm --filter @hms/api bootstrap:superadmin
```

Then log in at:

```text
https://hms-final-web.onrender.com/login
```

## Free-tier caveats

- Free services can sleep and cold-start.
- Free databases/platforms are not a compliance posture for healthcare records.
- Keep `NOTIFICATION_DRY_RUN=1` until you add real email/SMS/WhatsApp provider keys.
- Move to paid infrastructure before storing real patient data.
