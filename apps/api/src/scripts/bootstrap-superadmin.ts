import '../load-env';
import * as admin from 'firebase-admin';
import { platformDb } from '@hms/db';
import { getFirebaseApp, firebaseConfigured } from '../common/firebase-credentials';

/**
 * Creates (or re-links) the first platform Super Admin: a Firebase auth user and
 * an `isPlatform` app user. Idempotent. The ONLY way a platform user enters the
 * system — there is no fake/seeded admin.
 *
 *   SUPERADMIN_EMAIL=you@co.com SUPERADMIN_PASSWORD=secret \
 *     pnpm --filter @hms/api bootstrap:superadmin
 */
async function main(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL || process.argv[2];
  const password = process.env.SUPERADMIN_PASSWORD || process.argv[3];
  const fullName = process.env.SUPERADMIN_NAME || process.argv[4] || 'Platform Super Admin';

  if (!email || !password) {
    console.error(
      'Usage: SUPERADMIN_EMAIL=.. SUPERADMIN_PASSWORD=.. [SUPERADMIN_NAME=..] ' +
        'pnpm --filter @hms/api bootstrap:superadmin',
    );
    process.exit(1);
  }

  if (!firebaseConfigured()) {
    console.error('Firebase is not configured (service-account JSON file or FIREBASE_* env).');
    process.exit(1);
  }
  const auth = admin.auth(getFirebaseApp());

  let uid: string;
  try {
    const existing = await auth.getUserByEmail(email);
    uid = existing.uid;
    console.log(`Firebase user already exists: ${uid}`);
  } catch {
    const created = await auth.createUser({ email, password, displayName: fullName });
    uid = created.uid;
    console.log(`Created Firebase user: ${uid}`);
  }
  await auth.setCustomUserClaims(uid, { platform: true });

  const user = await platformDb.user.upsert({
    where: { email },
    update: { fullName, isPlatform: true, firebaseUid: uid, disabledAt: null },
    create: { email, fullName, isPlatform: true, firebaseUid: uid },
  });

  console.log(`✓ Super Admin ready: ${user.email} (app id ${user.id}, isPlatform=true)`);
  await platformDb.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
