/**
 * Phase 9 — Lab client wiring + route protection.
 *
 * The web harness is logic-only (no jsdom/RTL), so we assert (a) the lab API
 * wrappers hit the correct endpoints/bodies, and (b) the <Protected> contract
 * declared on the lab pages gates the LAB module + roles correctly.
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
  apiDelete: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiDelete', path, body, tenant });
    return Promise.resolve({});
  },
}));

import { labApi } from '@/lib/lab';
import { routeDecision } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];
beforeEach(() => {
  calls.length = 0;
});

describe('Lab API wrappers hit the right endpoints', () => {
  it('lists orders, fetches one, and reads stats/catalog', async () => {
    await labApi.orders('t1', { status: 'ORDERED' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/lab/orders?status=ORDERED', tenant: 't1' });
    await labApi.order('t1', 'o1');
    expect(last().path).toBe('/lab/orders/o1');
    await labApi.stats('t1');
    expect(last().path).toBe('/lab/stats');
    await labApi.catalog('t1');
    expect(last().path).toBe('/lab/catalog');
  });

  it('creates an order with patient + tests', async () => {
    await labApi.create('t1', { patientId: 'p1', tests: [{ testId: 'c1', testName: 'CBC' }] });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/lab/orders' });
    expect(last().body).toMatchObject({ patientId: 'p1', tests: [{ testId: 'c1', testName: 'CBC' }] });
  });

  it('collects a sample, advances status, enters results, and verifies', async () => {
    await labApi.collectSample('t1', 'o1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/lab/orders/o1/sample' });

    await labApi.setStatus('t1', 'o1', 'PROCESSING');
    expect(last()).toMatchObject({ fn: 'apiPatch', path: '/lab/orders/o1/status', body: { status: 'PROCESSING', reason: undefined } });

    await labApi.enterResults('t1', 'o1', [{ labOrderItemId: 'i1', value: '13.4', abnormalFlag: 'CRITICAL' }]);
    expect(last().path).toBe('/lab/orders/o1/results');
    expect(last().body).toEqual({ results: [{ labOrderItemId: 'i1', value: '13.4', abnormalFlag: 'CRITICAL' }] });

    await labApi.verifyResult('t1', 'r1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/lab/results/r1/verify' });
  });

  it('orders from an encounter and reads encounter orders', async () => {
    await labApi.orderFromEncounter('t1', 'e1', { tests: [{ testId: 'c1', testName: 'CBC' }] });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/encounters/e1/lab-orders' });
    await labApi.encounterOrders('t1', 'e1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/encounters/e1/lab-orders' });
  });

  it('reads the printable report', async () => {
    await labApi.report('t1', 'o1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/lab/reports/o1' });
  });
});

// Mirrors the <Protected> requirements on the lab pages.
const LAB_PAGE = { requireModule: 'LAB', allowedRoles: ['LAB_TECH', 'DOCTOR', 'NURSE', 'HOSPITAL_ADMIN'] };
const LAB_REPORT_PAGE = {
  ...LAB_PAGE,
  requirePermission: ['lab.report.print', 'lab.read'],
};

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['LAB_TECH'],
    permissions: [],
    modules: ['PATIENT', 'OPD', 'LAB'],
    providerId: null,
    ...over,
  };
}
function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

describe('Lab page protection', () => {
  it('lab tech with LAB enabled can open the lab workspace', () => {
    const m = membership({ roles: ['LAB_TECH'] });
    expect(routeDecision(profile(m), m, LAB_PAGE)).toBeNull();
  });

  it('routes to module-disabled when LAB is not in the plan', () => {
    const m = membership({ roles: ['LAB_TECH'], modules: ['PATIENT', 'OPD'] });
    expect(routeDecision(profile(m), m, LAB_PAGE)).toBe('/module-disabled?module=LAB');
  });

  it('blocks a role with no lab access (e.g. BILLING) with unauthorized', () => {
    const m = membership({ roles: ['BILLING'] });
    expect(routeDecision(profile(m), m, LAB_PAGE)).toBe('/unauthorized');
  });

  it('lets a doctor with lab.read open lab report detail', () => {
    const m = membership({ roles: ['DOCTOR'], permissions: ['lab.read'] });
    expect(routeDecision(profile(m), m, LAB_REPORT_PAGE)).toBeNull();
  });
});
