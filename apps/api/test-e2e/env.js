/**
 * E2E env loader (CommonJS so jest globalSetup can use it without transforms).
 *
 * Required to run `pnpm --filter @hms/api test:e2e`:
 *  - live API on :4000 and Postgres on :5433 (`pnpm dev` / `pnpm services:up`)
 *  - apps/api/.env       → DATABASE_URL, APP_DATABASE_URL, SUPERADMIN_EMAIL/PASSWORD
 *  - apps/web/.env.local → NEXT_PUBLIC_FIREBASE_API_KEY (Firebase REST sign-in)
 * No secrets live in this directory; everything is read from the env files above.
 */
const fs = require('node:fs');
const path = require('node:path');

function loadDotenvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function loadE2eEnv() {
  const apiDir = path.resolve(__dirname, '..');
  loadDotenvFile(path.join(apiDir, '.env'));
  loadDotenvFile(path.resolve(apiDir, '../web/.env.local'));
  // firebase-service-account.json is referenced relative to apps/api.
  const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (cred && cred.startsWith('./')) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(apiDir, cred.slice(2));
  }
}

const API_URL = process.env.E2E_API_URL || 'http://localhost:4000';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:4001';
const STATE_FILE = path.join(__dirname, '.state.json');

module.exports = { loadE2eEnv, API_URL, WEB_URL, STATE_FILE };
