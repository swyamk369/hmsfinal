// Shared display formatting helpers.

const SYMBOLS: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'AED ', SGD: 'S$' };

export function money(minor: number, currency = 'INR'): string {
  const sym = SYMBOLS[currency] ?? `${currency} `;
  return sym + (minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Display amount (major units) → minor units integer; null if invalid. */
export function toMinor(input: string): number | null {
  const cleaned = String(input)
    .replace(/[^0-9.]/g, '')
    .trim();
  if (cleaned === '' || Number.isNaN(Number(cleaned))) return null;
  return Math.round(Number(cleaned) * 100);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return '—';
  const d = new Date(dob);
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  return `${years}Y`;
}
