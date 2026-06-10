// Applies sql/rls.sql against the owner connection (DATABASE_URL) using psql.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(dir, '..', 'sql', 'rls.sql');

// Load DATABASE_URL from packages/db/.env if not already in the environment.
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(dir, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  }
}

loadEnv();

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error('DATABASE_URL is not set (checked env and packages/db/.env).');
  process.exit(1);
}
// libpq (psql) does not understand Prisma's ?schema= query param — strip it.
const url = rawUrl.split('?')[0];

// Keep the hms_app role password in sync with APP_DATABASE_URL so production's
// strong password is applied automatically (defaults to dev's 'app_pw').
function appPassword() {
  const appUrl = process.env.APP_DATABASE_URL;
  if (appUrl) {
    try {
      const pw = new URL(appUrl).password;
      if (pw) return decodeURIComponent(pw);
    } catch {
      /* fall through to default */
    }
  }
  return 'app_pw';
}

try {
  execFileSync(
    'psql',
    [url, '-v', 'ON_ERROR_STOP=1', '-v', `app_password=${appPassword()}`, '-f', sqlPath],
    { stdio: 'inherit' },
  );
  console.log('✓ RLS policies + audit trigger applied.');
} catch (err) {
  console.error('Failed to apply RLS.', err.message);
  process.exit(1);
}
