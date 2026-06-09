import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolves Firebase Admin credentials from (in order): GOOGLE_APPLICATION_CREDENTIALS,
 * FIREBASE_SERVICE_ACCOUNT, a `firebase-service-account.json` in the cwd, or the
 * FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY env trio. The JSON file keeps the
 * private key out of .env entirely.
 */
export function serviceAccountPath(): string | null {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    'firebase-service-account.json',
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const resolved = path.isAbsolute(c) ? c : path.resolve(process.cwd(), c);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

export function firebaseConfigured(): boolean {
  if (serviceAccountPath()) return true;
  return Boolean(
    process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY,
  );
}

let cached: admin.app.App | null = null;

export function getFirebaseApp(): admin.app.App {
  if (cached) return cached;
  if (admin.apps.length) {
    cached = admin.app();
    return cached;
  }

  const saPath = serviceAccountPath();
  if (saPath) {
    cached = admin.initializeApp({ credential: admin.credential.cert(saPath) });
    return cached;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase credentials missing (service-account JSON file or FIREBASE_* env).');
  }
  cached = admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  return cached;
}
