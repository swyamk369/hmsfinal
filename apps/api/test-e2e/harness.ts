/**
 * Shared helpers for E2E suites. Everything runs against the LIVE dev stack
 * with REAL Firebase tokens — no mocks, no dev auth.
 *
 * Created records use the E2E- prefix so they are recognizable and never
 * confused with demo workflow data.
 */
import fs from 'node:fs';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadE2eEnv, API_URL, WEB_URL, STATE_FILE } = require('./env');

loadE2eEnv();

export interface E2eState {
  apiUrl: string;
  webUrl: string;
  webUp: boolean;
  demoTenantId: string;
  clinicB: {
    tenantId: string;
    slug: string;
    adminEmail: string;
    adminPassword: string;
    created: boolean;
  };
}

export function state(): E2eState {
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

export const DEMO_PASSWORD = 'Demo-2026!';
export const DEMO_USERS = {
  admin: 'admin@demo.local',
  manager: 'manager@demo.local',
  reception: 'reception@demo.local',
  doctor: 'doctor@demo.local',
  nurse: 'nurse@demo.local',
  labtech: 'labtech@demo.local',
  pharmacist: 'pharmacist@demo.local',
  inventory: 'inventory@demo.local',
  billing: 'billing@demo.local',
  accountant: 'accountant@demo.local',
  insurance: 'insurance@demo.local',
} as const;
export type DemoRoleKey = keyof typeof DEMO_USERS;

const tokenCache = new Map<string, string>();

export async function signIn(email: string, password: string): Promise<string> {
  const cached = tokenCache.get(email);
  if (cached) return cached;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = (await res.json()) as any;
  if (!res.ok) throw new Error(`Firebase sign-in failed for ${email}: ${JSON.stringify(body.error ?? body)}`);
  tokenCache.set(email, body.idToken);
  return body.idToken;
}

export async function demoToken(role: DemoRoleKey): Promise<string> {
  return signIn(DEMO_USERS[role], DEMO_PASSWORD);
}

export async function superAdminToken(): Promise<string> {
  return signIn(process.env.SUPERADMIN_EMAIL!, process.env.SUPERADMIN_PASSWORD!);
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Light per-call spacing as a courtesy to the rate limiter. The dev API used
// for E2E runs with THROTTLE_LIMIT raised (see test:e2e docs), so this only
// needs to avoid pathological bursts — not a hard cap. Stateless on purpose
// (an earlier promise-chain pacer could wedge in the long-lived jest process).
const SPACING_MS = 40;

/**
 * Raw API call. Spaced to be gentle on the rate limiter; retries on a 429 or a
 * transient socket abort. New connection per request + a hard 20s ceiling so a
 * wedged socket can never block the 120s jest timeout.
 */
export async function api<T = any>(
  token: string | null,
  tenantId: string | null,
  method: string,
  pathName: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  for (let attempt = 0; ; attempt++) {
    await sleep(SPACING_MS);
    let res: Response;
    // Hard ceiling via a manually-cleared controller so a wedged socket can't
    // block the 120s jest timeout, and no stray timer leaks past the request.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      res = await fetch(`${API_URL}${pathName}`, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
      });
    } catch (err) {
      if (attempt < 2) continue; // transient socket/abort — retry on a fresh connection
      throw new Error(`${method} ${pathName} failed after retries: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429 && attempt < 2) {
      const reset = Number(res.headers.get('x-ratelimit-reset') ?? 30);
      await new Promise((r) => setTimeout(r, Math.min(reset, 61) * 1000));
      continue;
    }
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, body: json as T };
  }
}

/** Asserts 2xx and returns the body — use for workflow steps that must work. */
export async function ok<T = any>(
  token: string,
  tenantId: string | null,
  method: string,
  pathName: string,
  body?: unknown,
): Promise<T> {
  const res = await api<T>(token, tenantId, method, pathName, body);
  if (res.status >= 300) {
    throw new Error(`${method} ${pathName} → ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

export function uniq(prefix: string): string {
  return `E2E-${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
}

/** Fetch a web route's HTTP status (page render sanity, not content assertions). */
export async function webStatus(routePath: string): Promise<number> {
  const res = await fetch(`${WEB_URL}${routePath}`).catch(() => null);
  return res ? res.status : 0;
}

/** Audit assertion helper: newest tenant audit rows matching an action. */
export async function auditRows(adminToken: string, tenantId: string, action: string): Promise<any[]> {
  const res = await ok<{ rows: any[] }>(adminToken, tenantId, 'GET', `/admin/audit?action=${encodeURIComponent(action)}&pageSize=20`);
  return res.rows;
}

export const stateFileExists = () => fs.existsSync(path.join(__dirname, '.state.json'));
