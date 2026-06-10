import { routeDecision } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['INVENTORY_MGR'],
    permissions: [],
    modules: ['PATIENT', 'OPD', 'BILLING', 'PHARMACY', 'INVENTORY'],
    providerId: null,
    ...over,
  };
}
function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

// Mirrors the <Protected> requirements on the Phase 11 procurement pages.
const PAGES = {
  suppliers: { requireModule: 'INVENTORY', allowedRoles: ['INVENTORY_MGR', 'HOSPITAL_ADMIN'] },
  purchases: { requireModule: 'INVENTORY', allowedRoles: ['INVENTORY_MGR', 'HOSPITAL_ADMIN'] },
  poDetail: { requireModule: 'INVENTORY', allowedRoles: ['INVENTORY_MGR', 'HOSPITAL_ADMIN'] },
};

describe('Phase 11 procurement protection', () => {
  it('inventory manager can open suppliers, purchases and PO detail', () => {
    const m = membership({ roles: ['INVENTORY_MGR'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.suppliers)).toBeNull();
    expect(routeDecision(p, m, PAGES.purchases)).toBeNull();
    expect(routeDecision(p, m, PAGES.poDetail)).toBeNull();
  });

  it('a tenant without INVENTORY is routed to /module-disabled for procurement', () => {
    const m = membership({ roles: ['INVENTORY_MGR'], modules: ['PATIENT', 'OPD', 'BILLING', 'PHARMACY'] });
    expect(routeDecision(profile(m), m, PAGES.purchases)).toBe('/module-disabled?module=INVENTORY');
  });

  it('a pharmacist (inventory.read only) cannot open the procurement pages', () => {
    const m = membership({ roles: ['PHARMACIST'] });
    expect(routeDecision(profile(m), m, PAGES.purchases)).toBe('/unauthorized');
    expect(routeDecision(profile(m), m, PAGES.suppliers)).toBe('/unauthorized');
  });

  it('hospital admin can open procurement', () => {
    const m = membership({ roles: ['HOSPITAL_ADMIN'] });
    expect(routeDecision(profile(m), m, PAGES.purchases)).toBeNull();
  });
});
