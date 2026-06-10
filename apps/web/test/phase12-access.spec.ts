/**
 * Phase 12 - IPD/Nursing route protection and client wiring.
 */
const calls: { fn: string; path: string; body: unknown; tenant: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, body: undefined, tenant });
    return Promise.resolve([]);
  },
  apiPost: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPost', path, body, tenant });
    return Promise.resolve({});
  },
  apiPatch: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPatch', path, body, tenant });
    return Promise.resolve({});
  },
}));

import { ipdApi } from '@/lib/ipd';
import { nursingApi } from '@/lib/nursing';
import { routeDecision } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('Phase 12 IPD API wrappers', () => {
  it('loads occupancy, admissions, admission detail, and printable summary', async () => {
    await ipdApi.occupancy('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/ipd/occupancy', tenant: 't1' });

    await ipdApi.listAdmissions('t1', { status: 'ADMITTED', q: 'Jane' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/ipd/admissions?status=ADMITTED&q=Jane' });

    await ipdApi.getAdmission('t1', 'adm1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/ipd/admissions/adm1' });

    await ipdApi.summary('t1', 'adm1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/ipd/admissions/adm1/summary' });
  });

  it('admit, transfer, charge, round, and discharge wrappers hit the correct endpoints', async () => {
    await ipdApi.admit('t1', { patientId: 'pat1', bedId: 'bed1', reason: 'Observation' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/ipd/admissions', body: { patientId: 'pat1', bedId: 'bed1', reason: 'Observation' } });

    await ipdApi.transfer('t1', 'adm1', 'bed2', 'Needs isolation');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/ipd/admissions/adm1/transfer', body: { toBedId: 'bed2', reason: 'Needs isolation' } });

    await ipdApi.addRound('t1', 'adm1', 'Stable overnight');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/ipd/admissions/adm1/rounds', body: { notes: 'Stable overnight' } });

    await ipdApi.addCharge('t1', 'adm1', { description: 'Room', quantity: 1, unitPrice: 5000 });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/ipd/admissions/adm1/charges', body: { description: 'Room', quantity: 1, unitPrice: 5000 } });

    await ipdApi.discharge('t1', 'adm1', { reason: 'Recovered', summary: 'Stable', instructions: 'Review', followUpDate: '2026-06-20' });
    expect(last()).toMatchObject({
      fn: 'apiPost',
      path: '/ipd/admissions/adm1/discharge',
      body: { reason: 'Recovered', summary: 'Stable', instructions: 'Review', followUpDate: '2026-06-20' },
    });
  });

  it('/ipd/admit ward and bed wrappers are available', async () => {
    await ipdApi.listWards('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/ipd/wards' });
    await ipdApi.listBeds('t1', 'ward1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/ipd/beds?wardId=ward1' });
  });
});

describe('Phase 12 nursing API wrappers', () => {
  it('dashboard and admission wrappers hit nursing endpoints', async () => {
    await nursingApi.dashboard('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/nursing/dashboard' });

    await nursingApi.getAdmission('t1', 'adm1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/nursing/admissions/adm1' });
  });

  it('vitals, notes, medication create, medication update wrappers use correct endpoints', async () => {
    await nursingApi.addVitals('t1', 'adm1', { pulse: 80, spo2: 98 });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/nursing/admissions/adm1/vitals', body: { pulse: 80, spo2: 98 } });

    await nursingApi.addNote('t1', 'adm1', 'Observed');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/nursing/admissions/adm1/notes', body: { note: 'Observed' } });

    await nursingApi.listMedications('t1', 'adm1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/nursing/admissions/adm1/medications' });

    await nursingApi.addMedication('t1', 'adm1', { status: 'ADMINISTERED', notes: 'Given' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/nursing/admissions/adm1/medications', body: { status: 'ADMINISTERED', notes: 'Given' } });

    await nursingApi.updateMedication('t1', 'med1', { status: 'HELD', notes: 'NPO' });
    expect(last()).toMatchObject({ fn: 'apiPatch', path: '/nursing/medications/med1', body: { status: 'HELD', notes: 'NPO' } });
  });
});

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['NURSE'],
    permissions: ['ipd.read', 'nursing.read', 'vitals.write', 'nursing.note.write', 'medication.administer'],
    modules: ['PATIENT', 'OPD', 'BILLING', 'IPD'],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

const PAGES = {
  ipd: { requireModule: 'IPD', allowedRoles: ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'], requirePermission: ['ipd.read'] },
  admit: { requireModule: 'IPD', allowedRoles: ['DOCTOR', 'HOSPITAL_ADMIN', 'NURSE'], requirePermission: ['ipd.admit'] },
  admission: { requireModule: 'IPD', allowedRoles: ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'], requirePermission: ['ipd.read'] },
  discharge: { requireModule: 'IPD', allowedRoles: ['DOCTOR', 'HOSPITAL_ADMIN'], requirePermission: ['ipd.discharge'] },
  summary: { requireModule: 'IPD', allowedRoles: ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'], requirePermission: ['ipd.read'] },
  nursing: { requireModule: 'IPD', allowedRoles: ['NURSE', 'HOSPITAL_ADMIN'], requirePermission: ['nursing.read'] },
};

describe('Phase 12 route protection', () => {
  it('nurse can open nursing and read-only IPD admission/summary routes', () => {
    const m = membership();
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.ipd)).toBeNull();
    expect(routeDecision(p, m, PAGES.admission)).toBeNull();
    expect(routeDecision(p, m, PAGES.summary)).toBeNull();
    expect(routeDecision(p, m, PAGES.nursing)).toBeNull();
  });

  it('tenant without IPD is routed to module-disabled', () => {
    const m = membership({ modules: ['PATIENT', 'OPD'], permissions: ['ipd.read', 'nursing.read'] });
    expect(routeDecision(profile(m), m, PAGES.nursing)).toBe('/module-disabled?module=IPD');
  });

  it('missing permissions block protected IPD actions', () => {
    const m = membership({ roles: ['DOCTOR'], permissions: ['ipd.read'], modules: ['IPD'] });
    expect(routeDecision(profile(m), m, PAGES.admit)).toBe('/unauthorized');
    expect(routeDecision(profile(m), m, PAGES.discharge)).toBe('/unauthorized');
  });

  it('doctor cannot open nursing workspace without the nursing role', () => {
    const m = membership({ roles: ['DOCTOR'], permissions: ['ipd.read'], modules: ['IPD'] });
    expect(routeDecision(profile(m), m, PAGES.nursing)).toBe('/unauthorized');
  });

  it('hospital admin can open every Phase 12 screen when permissions are present', () => {
    const m = membership({
      roles: ['HOSPITAL_ADMIN'],
      permissions: ['ipd.read', 'ipd.admit', 'ipd.discharge', 'nursing.read'],
      modules: ['IPD'],
    });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.ipd)).toBeNull();
    expect(routeDecision(p, m, PAGES.admit)).toBeNull();
    expect(routeDecision(p, m, PAGES.discharge)).toBeNull();
    expect(routeDecision(p, m, PAGES.nursing)).toBeNull();
  });
});
