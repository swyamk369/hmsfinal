/**
 * Phase 17 — frontend route protection matrix. Hermetic: drives routeDecision
 * (the single source of truth Protected uses) across every protected landing
 * route × representative roles, plus module/suspension/platform edge cases.
 *
 * Requirements mirror the actual <Protected> wrappers on each page.
 */
import { routeDecision } from '@/lib/access';
import type { AccessRequirement } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

const ALL_MODULES = [
  'ADMIN', 'PATIENT', 'OPD', 'SCHEDULING', 'BILLING', 'LAB', 'PHARMACY', 'INVENTORY', 'IPD', 'INSURANCE', 'REPORTS',
];

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['HOSPITAL_ADMIN'],
    permissions: [],
    modules: ALL_MODULES,
    providerId: null,
    ...over,
  };
}
function tenantProfile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}
function platformProfile(): Profile {
  return { id: 'p1', email: 'sa@hms', fullName: 'SA', isPlatform: true, tenants: [] };
}

// Route → the exact requirement its page declares.
const ROUTES: Record<string, AccessRequirement> = {
  '/admin': { allowedRoles: ['HOSPITAL_ADMIN'] },
  '/admin/audit': { allowedRoles: ['HOSPITAL_ADMIN'] },
  '/manager': { requireModule: 'REPORTS', allowedRoles: ['HOSPITAL_MANAGER', 'HOSPITAL_ADMIN'] },
  '/reception': { requireModule: 'OPD', allowedRoles: ['RECEPTION', 'HOSPITAL_ADMIN'] },
  '/opd': { requireModule: 'OPD', allowedRoles: ['RECEPTION', 'DOCTOR', 'HOSPITAL_ADMIN'] },
  '/doctor': { requireModule: 'OPD', allowedRoles: ['DOCTOR', 'HOSPITAL_ADMIN'] },
  '/nursing': { requireModule: 'IPD', allowedRoles: ['NURSE', 'HOSPITAL_ADMIN'] },
  '/lab': { requireModule: 'LAB', allowedRoles: ['LAB_TECH', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'] },
  '/pharmacy': { requireModule: 'PHARMACY', allowedRoles: ['PHARMACIST', 'HOSPITAL_ADMIN'] },
  '/inventory': { requireModule: 'INVENTORY', allowedRoles: ['INVENTORY_MGR', 'PHARMACIST', 'HOSPITAL_ADMIN'] },
  '/billing': { requireModule: 'BILLING', allowedRoles: ['BILLING', 'ACCOUNTANT', 'RECEPTION', 'HOSPITAL_ADMIN'] },
  '/accounts': { requireModule: 'BILLING', allowedRoles: ['ACCOUNTANT', 'HOSPITAL_ADMIN'] },
  '/insurance': { requireModule: 'INSURANCE', allowedRoles: ['INSURANCE_STAFF', 'BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN'] },
  '/ipd': { requireModule: 'IPD', allowedRoles: ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'] },
};

const ALL_ROLES = [
  'HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'RECEPTION', 'DOCTOR', 'NURSE', 'LAB_TECH',
  'PHARMACIST', 'INVENTORY_MGR', 'BILLING', 'ACCOUNTANT', 'INSURANCE_STAFF',
];

describe('Phase 17 route × role matrix (full modules)', () => {
  for (const [route, req] of Object.entries(ROUTES)) {
    for (const role of ALL_ROLES) {
      const allowed = req.allowedRoles?.includes(role) ?? true;
      it(`${role} ${allowed ? 'reaches' : 'is blocked from'} ${route}`, () => {
        const decision = routeDecision(tenantProfile(membership({ roles: [role] })), membership({ roles: [role] }), req);
        if (allowed) expect(decision).toBeNull();
        else expect(decision).toBe('/unauthorized');
      });
    }
  }
});

describe('Phase 17 module gating', () => {
  it('redirects to module-disabled when the tenant lacks the module', () => {
    const m = membership({ roles: ['INSURANCE_STAFF'], modules: ['ADMIN', 'PATIENT', 'OPD', 'BILLING'] });
    expect(routeDecision(tenantProfile(m), m, ROUTES['/insurance'])).toBe('/module-disabled?module=INSURANCE');
  });

  it('module gate is checked even for an allowed role', () => {
    const m = membership({ roles: ['DOCTOR'], modules: ['ADMIN', 'PATIENT', 'BILLING'] }); // no OPD
    expect(routeDecision(tenantProfile(m), m, ROUTES['/doctor'])).toBe('/module-disabled?module=OPD');
  });
});

describe('Phase 17 platform + suspension edges', () => {
  it('tenant users cannot reach /platform', () => {
    const m = membership({ roles: ['HOSPITAL_ADMIN'] });
    expect(routeDecision(tenantProfile(m), m, { requirePlatform: true })).toBe('/unauthorized');
  });

  it('platform user reaches /platform', () => {
    expect(routeDecision(platformProfile(), null, { requirePlatform: true })).toBeNull();
  });

  it('suspended tenant is redirected from every route', () => {
    const m = membership({ status: 'SUSPENDED' });
    for (const req of Object.values(ROUTES)) {
      expect(routeDecision(tenantProfile(m), m, req)).toBe('/tenant-suspended');
    }
  });

  it('logged-out user is redirected to login', () => {
    expect(routeDecision(null, null, ROUTES['/admin'])).toBe('/login');
  });
});
