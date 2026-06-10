import { getActiveMembership, landingPath, visibleNav, routeDecision, breadcrumbs } from '@/lib/access';
import { ROLE_LANDING, SEGMENT_LABELS } from '@/lib/constants';
import type { Membership, Profile } from '@/lib/types';

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo Hospital',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['HOSPITAL_ADMIN'],
    permissions: [],
    modules: ['ADMIN', 'PATIENT', 'OPD'],
    providerId: null,
    ...over,
  };
}
function profile(over: Partial<Profile> = {}): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A B', isPlatform: false, tenants: [membership()], ...over };
}

describe('landingPath', () => {
  it('routes platform users to /platform', () => {
    expect(landingPath(profile({ isPlatform: true, tenants: [] }), null)).toBe('/platform');
  });

  it('routes each tenant role to its landing page', () => {
    const cases: Record<string, string> = {
      HOSPITAL_ADMIN: '/admin',
      HOSPITAL_MANAGER: '/manager',
      RECEPTION: '/reception',
      DOCTOR: '/doctor',
      NURSE: '/nursing',
      LAB_TECH: '/lab',
      PHARMACIST: '/pharmacy',
      INVENTORY_MGR: '/inventory',
      BILLING: '/finance',
      ACCOUNTANT: '/finance',
      INSURANCE_STAFF: '/insurance',
    };
    for (const [role, path] of Object.entries(cases)) {
      const p = profile({ tenants: [membership({ roles: [role] })] });
      expect(landingPath(p, 't1')).toBe(path);
      // and the shared map agrees
      expect(ROLE_LANDING[role]).toBe(path);
    }
  });

  it('returns /login when there is no profile', () => {
    expect(landingPath(null, null)).toBe('/login');
  });

  it('falls back to /dashboard when role has no mapping', () => {
    expect(landingPath(profile({ tenants: [membership({ roles: ['UNKNOWN_ROLE'] })] }), 't1')).toBe('/dashboard');
  });
});

describe('getActiveMembership', () => {
  it('returns the membership for the active tenant (not the first)', () => {
    const p = profile({
      tenants: [membership({ tenantId: 't1', roles: ['DOCTOR'] }), membership({ tenantId: 't2', roles: ['NURSE'] })],
    });
    expect(getActiveMembership(p, 't2')?.tenantId).toBe('t2');
    expect(getActiveMembership(p, 't2')?.roles).toEqual(['NURSE']);
  });

  it('falls back to the first membership when active id is missing/unknown', () => {
    const p = profile({ tenants: [membership({ tenantId: 't1' }), membership({ tenantId: 't2' })] });
    expect(getActiveMembership(p, null)?.tenantId).toBe('t1');
    expect(getActiveMembership(p, 'nope')?.tenantId).toBe('t1');
  });

  it('returns null when there are no memberships', () => {
    expect(getActiveMembership(profile({ tenants: [] }), 't1')).toBeNull();
    expect(getActiveMembership(null, 't1')).toBeNull();
  });
});

describe('visibleNav', () => {
  it('shows only platform nav for platform users', () => {
    const items = visibleNav(profile({ isPlatform: true, tenants: [] }), null);
    expect(items.map((i) => i.href)).toEqual(['/platform', '/platform/plans', '/platform/audit']);
  });

  it('filters tenant nav by role and module', () => {
    const m = membership({ roles: ['DOCTOR'], modules: ['PATIENT', 'OPD', 'LAB'] });
    const hrefs = visibleNav(profile({ tenants: [m] }), m).map((i) => i.href);
    expect(hrefs).toContain('/doctor');
    expect(hrefs).toContain('/lab');
    expect(hrefs).toContain('/patients');
    expect(hrefs).not.toContain('/admin'); // role-gated
    expect(hrefs).not.toContain('/pharmacy'); // module not enabled
  });

  it('hides a module the tenant does not have even if role would allow it', () => {
    const m = membership({ roles: ['LAB_TECH'], modules: ['PATIENT'] }); // no LAB
    const hrefs = visibleNav(profile({ tenants: [m] }), m).map((i) => i.href);
    expect(hrefs).not.toContain('/lab');
  });

  it('shows Admin for a Hospital Admin', () => {
    const m = membership({ roles: ['HOSPITAL_ADMIN'], modules: ['ADMIN'] });
    expect(visibleNav(profile({ tenants: [m] }), m).map((i) => i.href)).toContain('/admin');
  });

  it('shows Finance by permission without requiring Accountant role', () => {
    const m = membership({
      roles: ['RECEPTION'],
      modules: ['BILLING'],
      permissions: ['finance.cashier', 'payment.collect'],
    });
    const hrefs = visibleNav(profile({ tenants: [m] }), m).map((i) => i.href);
    expect(hrefs).toContain('/finance');
    expect(hrefs).not.toContain('/billing');
    expect(hrefs).not.toContain('/accounts');
  });

  it('hides Finance when the user has no finance, billing, payment, or report permission', () => {
    const m = membership({ roles: ['RECEPTION'], modules: ['BILLING'], permissions: ['patient.read'] });
    expect(visibleNav(profile({ tenants: [m] }), m).map((i) => i.href)).not.toContain('/finance');
  });
});

describe('routeDecision', () => {
  it('redirects to /login with no profile', () => {
    expect(routeDecision(null, null, {})).toBe('/login');
  });

  it('redirects suspended tenants to /tenant-suspended', () => {
    const m = membership({ status: 'SUSPENDED' });
    expect(routeDecision(profile({ tenants: [m] }), m, {})).toBe('/tenant-suspended');
  });

  it('blocks tenant users from platform-only routes', () => {
    const m = membership();
    expect(routeDecision(profile({ tenants: [m] }), m, { requirePlatform: true })).toBe('/unauthorized');
  });

  it('lets platform users through platform-only routes', () => {
    expect(routeDecision(profile({ isPlatform: true, tenants: [] }), null, { requirePlatform: true })).toBeNull();
  });

  it('redirects tenant users with no memberships to /unauthorized', () => {
    expect(routeDecision(profile({ tenants: [] }), null, {})).toBe('/unauthorized');
  });

  it('blocks the wrong role with /unauthorized', () => {
    const m = membership({ roles: ['NURSE'] });
    expect(routeDecision(profile({ tenants: [m] }), m, { allowedRoles: ['HOSPITAL_ADMIN'] })).toBe('/unauthorized');
  });

  it('redirects a disabled module to /module-disabled', () => {
    const m = membership({ modules: ['PATIENT'] });
    expect(routeDecision(profile({ tenants: [m] }), m, { requireModule: 'LAB' })).toBe('/module-disabled?module=LAB');
  });

  it('blocks a missing permission with /unauthorized', () => {
    const m = membership({ permissions: ['patient.read'] });
    expect(routeDecision(profile({ tenants: [m] }), m, { requirePermission: ['staff.invite'] })).toBe('/unauthorized');
  });

  it('returns null when all requirements are met', () => {
    const m = membership({ roles: ['DOCTOR'], modules: ['OPD'], permissions: ['encounter.write'] });
    expect(
      routeDecision(profile({ tenants: [m] }), m, {
        allowedRoles: ['DOCTOR'],
        requireModule: 'OPD',
        requirePermission: ['encounter.write'],
      }),
    ).toBeNull();
  });

  it('platform users bypass role/module checks', () => {
    expect(
      routeDecision(profile({ isPlatform: true, tenants: [] }), null, { allowedRoles: ['DOCTOR'], requireModule: 'LAB' }),
    ).toBeNull();
  });
});

describe('breadcrumbs', () => {
  it('builds a labelled trail', () => {
    expect(breadcrumbs('/admin/staff', SEGMENT_LABELS)).toEqual([
      { label: 'Admin', href: '/admin' },
      { label: 'Staff', href: '/admin/staff' },
    ]);
  });

  it('collapses opaque ids to a Detail crumb', () => {
    const crumbs = breadcrumbs('/platform/tenants/3f2504e0-4f89-41d3-9a0c-0305e82c3301', SEGMENT_LABELS);
    expect(crumbs.map((c) => c.label)).toEqual(['Platform', 'Tenants', 'Detail']);
  });
});
