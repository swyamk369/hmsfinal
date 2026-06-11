import { getFirebaseIdToken } from './firebase';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Hard ceiling on every request. Without it a hung socket (API mid-restart,
// wedged dev proxy, dead DB connection) leaves fetch pending forever and the
// app stuck on a permanent "Loading…" screen.
const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Token fetch with a ceiling — a hung Firebase token refresh must not hang the app. */
async function tokenWithTimeout(): Promise<string | null> {
  return Promise.race([
    getFirebaseIdToken(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), TOKEN_TIMEOUT_MS)),
  ]).catch(() => null);
}

export async function buildHeaders(tenantId?: string | null, json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (tenantId) h['X-Tenant-Id'] = tenantId;

  const token = await tokenWithTimeout();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** fetch with a timeout; turns aborts/network failures into a clear ApiError(0). */
async function fetchSafe(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === 'AbortError';
    throw new ApiError(0, aborted ? 'The server took too long to respond.' : 'Could not reach the server.');
  } finally {
    clearTimeout(timer);
  }
}

async function handle(res: Response) {
  if (!res.ok) {
    let msg: string = res.statusText;
    try {
      const body = await res.json();
      msg = Array.isArray(body.message) ? body.message.join(', ') : body.message || msg;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function apiGet<T = any>(path: string, tenantId?: string | null): Promise<T> {
  const res = await fetchSafe(`${API}${path}`, { headers: await buildHeaders(tenantId), cache: 'no-store' });
  return handle(res);
}

export async function apiPost<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetchSafe(`${API}${path}`, {
    method: 'POST',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiPatch<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetchSafe(`${API}${path}`, {
    method: 'PATCH',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiPut<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetchSafe(`${API}${path}`, {
    method: 'PUT',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiDelete<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetchSafe(`${API}${path}`, {
    method: 'DELETE',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}
