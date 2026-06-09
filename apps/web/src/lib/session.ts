// Client session storage helpers (active-tenant persistence). Kept separate from
// auth-context so the logic is unit-testable without React.

export const TENANT_STORAGE_KEY = 'hms_active_tenant';

function storage(explicit?: Storage): Storage | undefined {
  if (explicit) return explicit;
  return typeof window !== 'undefined' ? window.localStorage : undefined;
}

export function getStoredTenant(explicit?: Storage): string | null {
  return storage(explicit)?.getItem(TENANT_STORAGE_KEY) ?? null;
}

export function setStoredTenant(id: string, explicit?: Storage): void {
  storage(explicit)?.setItem(TENANT_STORAGE_KEY, id);
}

/** Clears all client auth/session state held in storage (used on logout). */
export function clearActiveTenant(explicit?: Storage): void {
  storage(explicit)?.removeItem(TENANT_STORAGE_KEY);
}
