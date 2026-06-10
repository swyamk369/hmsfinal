import { routeDecision } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['PHARMACIST'],
    permissions: [],
    modules: ['PATIENT', 'OPD', 'BILLING', 'PHARMACY', 'INVENTORY'],
    providerId: null,
    ...over,
  };
}
function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

const PAGES = {
  pharmacy: { requireModule: 'PHARMACY', allowedRoles: ['PHARMACIST', 'HOSPITAL_ADMIN'] },
  dispense: { requireModule: 'PHARMACY', allowedRoles: ['PHARMACIST', 'HOSPITAL_ADMIN'] },
  inventory: { requireModule: 'INVENTORY', allowedRoles: ['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN'] },
  items: { requireModule: 'INVENTORY', allowedRoles: ['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN'] },
};

describe('Phase 10 pharmacy/inventory protection', () => {
  it('pharmacist can open pharmacy + dispense + inventory', () => {
    const m = membership({ roles: ['PHARMACIST'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.pharmacy)).toBeNull();
    expect(routeDecision(p, m, PAGES.dispense)).toBeNull();
    expect(routeDecision(p, m, PAGES.inventory)).toBeNull();
    expect(routeDecision(p, m, PAGES.items)).toBeNull();
  });

  it('a GROWTH tenant without INVENTORY is routed to /module-disabled for inventory', () => {
    const m = membership({ roles: ['PHARMACIST'], modules: ['PATIENT', 'OPD', 'BILLING', 'PHARMACY'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.pharmacy)).toBeNull();
    expect(routeDecision(p, m, PAGES.inventory)).toBe('/module-disabled?module=INVENTORY');
  });

  it('a STARTER tenant without PHARMACY is blocked from the pharmacy queue', () => {
    const m = membership({ roles: ['PHARMACIST'], modules: ['PATIENT', 'OPD', 'BILLING'] });
    expect(routeDecision(profile(m), m, PAGES.pharmacy)).toBe('/module-disabled?module=PHARMACY');
  });

  it('a doctor cannot open the pharmacy or inventory screens', () => {
    const m = membership({ roles: ['DOCTOR'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.pharmacy)).toBe('/unauthorized');
    expect(routeDecision(p, m, PAGES.inventory)).toBe('/unauthorized');
  });

  it('an inventory manager reaches inventory but not the pharmacy queue', () => {
    const m = membership({ roles: ['INVENTORY_MGR'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.inventory)).toBeNull();
    expect(routeDecision(p, m, PAGES.pharmacy)).toBe('/unauthorized');
  });
});
