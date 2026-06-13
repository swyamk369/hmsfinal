const DEFAULT_API_URL = 'http://localhost:4000';

function inferRenderApiUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (!host.endsWith('.onrender.com')) return null;
  return `https://${host.replace(/-web(\.onrender\.com)$/i, '-api$1')}`;
}

function cleanApiUrl(rawValue: string): string {
  let raw = rawValue
    .trim()
    .replace(/^NEXT_PUBLIC_API_URL\s*=\s*/i, '')
    .trim()
    .replace(/^['"`]|['"`]$/g, '')
    .trim();

  const httpMatch = raw.match(/https?:\/\/[^\s'"`]+/i);
  if (httpMatch) raw = httpMatch[0];

  const renderHostMatch = raw.match(/[a-z0-9-]+\.onrender\.com/i);
  if (!httpMatch && renderHostMatch) raw = renderHostMatch[0];

  return raw;
}

export function apiBaseUrl(): string {
  const fallback = inferRenderApiUrl() ?? DEFAULT_API_URL;
  const raw = cleanApiUrl(process.env.NEXT_PUBLIC_API_URL || fallback);
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return fallback;
  }
}
