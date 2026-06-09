import { getFirebaseIdToken } from './firebase';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function buildHeaders(tenantId?: string | null, json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (tenantId) h['X-Tenant-Id'] = tenantId;

  const token = await getFirebaseIdToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
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
  const res = await fetch(`${API}${path}`, { headers: await buildHeaders(tenantId), cache: 'no-store' });
  return handle(res);
}

export async function apiPost<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiPatch<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

export async function apiDelete<T = any>(path: string, body?: unknown, tenantId?: string | null): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: await buildHeaders(tenantId, true),
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}
