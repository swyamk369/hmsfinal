/**
 * Small HTTP helper for delivery adapters. Wraps an injectable fetch with a
 * timeout (AbortController) and turns non-2xx responses into thrown Errors whose
 * message is safe to store in `notification_delivery_attempt.errorMessage`
 * (truncated, no secrets - adapters never put the API key in the body text).
 */
import type { FetchImpl } from './types';

export interface HttpResult {
  status: number;
  body: string;
  header: (name: string) => string | null;
}

export async function httpSend(
  fetchImpl: FetchImpl,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  timeoutMs = 10_000,
): Promise<HttpResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${truncate(body)}`);
    }
    return { status: res.status, body, header: (n) => res.headers.get(n) };
  } catch (err) {
    const e = err as Error;
    if (e.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function truncate(s: string, max = 300): string {
  const flat = (s ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

export function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

export function form(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') usp.append(k, v);
  }
  return usp.toString();
}
