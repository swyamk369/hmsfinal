import { routeDecision } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['RECEPTION'],
    permissions: [],
    modules: ['PATIENT', 'OPD', 'BILLING'],
    providerId: null,
    ...over,
  };
}
function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

// Mirrors the <Protected> requirements declared on each Phase 8 page.
const PAGES = {
  patients: { requireModule: 'PATIENT' },
  reception: { requireModule: 'OPD', allowedRoles: ['RECEPTION', 'HOSPITAL_ADMIN'] },
  opd: { requireModule: 'OPD', allowedRoles: ['RECEPTION', 'DOCTOR', 'HOSPITAL_ADMIN'] },
  doctorConsult: { requireModule: 'OPD', allowedRoles: ['DOCTOR', 'HOSPITAL_ADMIN'] },
  billing: { requireModule: 'BILLING', allowedRoles: ['BILLING', 'ACCOUNTANT', 'RECEPTION', 'HOSPITAL_ADMIN'] },
};

describe('Phase 8 page protection', () => {
  it('reception can open patients, reception, opd, billing — but not the doctor consult', () => {
    const m = membership({ roles: ['RECEPTION'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.patients)).toBeNull();
    expect(routeDecision(p, m, PAGES.reception)).toBeNull();
    expect(routeDecision(p, m, PAGES.opd)).toBeNull();
    expect(routeDecision(p, m, PAGES.billing)).toBeNull();
    expect(routeDecision(p, m, PAGES.doctorConsult)).toBe('/unauthorized');
  });

  it('doctor can open the consult workspace but not reception', () => {
    const m = membership({ roles: ['DOCTOR'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.doctorConsult)).toBeNull();
    expect(routeDecision(p, m, PAGES.opd)).toBeNull();
    expect(routeDecision(p, m, PAGES.reception)).toBe('/unauthorized');
  });

  it('a STARTER tenant without BILLING is routed to /module-disabled for billing', () => {
    const m = membership({ roles: ['BILLING'], modules: ['PATIENT', 'OPD'] });
    expect(routeDecision(profile(m), m, PAGES.billing)).toBe('/module-disabled?module=BILLING');
  });

  it('patients page is blocked when the PATIENT module is off', () => {
    const m = membership({ roles: ['RECEPTION'], modules: ['OPD'] });
    expect(routeDecision(profile(m), m, PAGES.patients)).toBe('/module-disabled?module=PATIENT');
  });
});
