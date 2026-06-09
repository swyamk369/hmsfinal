import { TENANT_STORAGE_KEY, getStoredTenant, setStoredTenant, clearActiveTenant } from '@/lib/session';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

describe('session storage helpers', () => {
  it('stores and reads the active tenant', () => {
    const s = fakeStorage();
    setStoredTenant('t-42', s);
    expect(s.getItem(TENANT_STORAGE_KEY)).toBe('t-42');
    expect(getStoredTenant(s)).toBe('t-42');
  });

  it('clearActiveTenant removes the stored tenant (logout)', () => {
    const s = fakeStorage();
    setStoredTenant('t-42', s);
    clearActiveTenant(s);
    expect(getStoredTenant(s)).toBeNull();
  });
});
