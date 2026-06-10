# Firebase Production Setup

Auth is **Firebase-only**. Firebase holds login identity; the app database holds
all authorization (tenants, memberships, roles, permissions, modules, providers).

## 1. Project

1. Create (or select) a production Firebase project.
2. **Authentication → Sign-in method**: enable **Email/Password**.
3. **Authentication → Settings → Authorized domains**: add your production web
   domain(s) (e.g. `app.your-hospital-domain.com`). Login fails from any domain
   not listed here.

## 2. Web client config (build-time, public)

From **Project settings → General → Your apps → Web app**, copy the config into the
web image build args (they are inlined into the client bundle — public by design):

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

## 3. Admin service account (server-side, SECRET)

From **Project settings → Service accounts → Generate new private key**:

- Preferred: mount the JSON file and set `GOOGLE_APPLICATION_CREDENTIALS` to its
  path (the prod compose mounts it read-only at
  `/run/secrets/firebase-service-account.json`).
- Alternative: set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
  `FIREBASE_PRIVATE_KEY` (one line, literal `\n` for newlines).

**Never commit the service account** (it is gitignored and excluded from images).
Rotate it if it was ever pasted into a chat, ticket, or shared doc.

## 4. First platform admin bootstrap

Run once after the DB is deployed. It creates the Firebase user (if missing) and
the platform `User` row marked `isPlatform`:

```bash
SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... SUPERADMIN_NAME="Platform Admin" \
  pnpm --filter @hms/api bootstrap:superadmin
```

All subsequent users (Hospital Admins, staff) are created through the in-app invite
flows, which call the Firebase Admin SDK server-side.

## 5. Password reset / email templates

Staff password resets use Firebase's `passwordResetLink` (via the staff
reset-password endpoint). Customize the reset/verification email templates and the
sender name under **Authentication → Templates** in the Firebase console. Set a
custom action-handler domain there if you want reset links hosted on your domain.

## 6. Verify

After deploy, the smoke gate confirms `firebaseConfigured: true`; the optional
authenticated check (`FIREBASE_API_KEY` + a real user) proves `/auth/me` resolves:

```bash
FIREBASE_API_KEY=<web api key> SMOKE_EMAIL=... SMOKE_PASSWORD=... \
  API_URL=https://api.your-domain.com WEB_URL=https://app.your-domain.com \
  ./infra/scripts/smoke.sh
```
