/**
 * Production environment validation. Pure and testable: `validateEnv` returns
 * the list of problems; `assertEnv` throws on the first boot so a misconfigured
 * production deploy fails fast instead of running insecurely.
 */
import { firebaseConfigured } from './firebase-credentials';

export interface EnvInput {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  APP_DATABASE_URL?: string;
  CORS_ORIGIN?: string;
  API_PORT?: string;
  THROTTLE_LIMIT?: string;
  THROTTLE_TTL_MS?: string;
  // Firebase presence is resolved via firebaseConfigured() so both the
  // service-account-file and FIREBASE_* env paths are accepted.
  firebaseConfigured?: boolean;
}

const LOCAL_ORIGIN = /(localhost|127\.0\.0\.1|0\.0\.0\.0)/i;

/** Returns an array of human-readable problems. Empty array = valid. */
export function validateEnv(env: EnvInput): string[] {
  const problems: string[] = [];
  const isProd = env.NODE_ENV === 'production';

  // Always required — the app cannot run without a DB or auth.
  for (const key of ['DATABASE_URL', 'APP_DATABASE_URL'] as const) {
    if (!env[key]) problems.push(`Missing required environment variable: ${key}`);
  }
  const fb = env.firebaseConfigured ?? firebaseConfigured();
  if (!fb) {
    problems.push(
      'Firebase Auth is mandatory but not configured. Provide a service-account JSON ' +
        '(GOOGLE_APPLICATION_CREDENTIALS / firebase-service-account.json) or the FIREBASE_* env.',
    );
  }

  if (env.DATABASE_URL && env.APP_DATABASE_URL && env.DATABASE_URL === env.APP_DATABASE_URL) {
    problems.push(
      'DATABASE_URL and APP_DATABASE_URL must differ: the app role must be a NON-owner so Postgres FORCE RLS isolates tenants.',
    );
  }

  // Production-only guards: refuse insecure defaults.
  if (isProd) {
    if (!env.CORS_ORIGIN) {
      problems.push('CORS_ORIGIN is required in production (comma-separated allow-list of web origins).');
    } else if (env.CORS_ORIGIN.split(',').some((o) => LOCAL_ORIGIN.test(o.trim()))) {
      problems.push('CORS_ORIGIN must not contain localhost/loopback origins in production.');
    }
    if (env.APP_DATABASE_URL && /:app_pw@/.test(env.APP_DATABASE_URL)) {
      problems.push(
        'APP_DATABASE_URL still uses the default dev password (app_pw); set a strong password in production.',
      );
    }
    if (env.THROTTLE_LIMIT && Number(env.THROTTLE_LIMIT) > 10_000) {
      problems.push(`THROTTLE_LIMIT=${env.THROTTLE_LIMIT} is too high for production (looks like an E2E override).`);
    }
  }

  return problems;
}

/** Throws a single aggregated error if the environment is invalid. */
export function assertEnv(env: EnvInput = process.env as EnvInput): void {
  const problems = validateEnv(env);
  if (problems.length) {
    throw new Error(`Environment validation failed:\n  - ${problems.join('\n  - ')}`);
  }
}
