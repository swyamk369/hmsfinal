const DEFAULT_API_URL = 'http://localhost:4000';

export function apiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).trim().replace(/^['"]|['"]$/g, '');
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}
