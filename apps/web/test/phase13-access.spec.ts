/**
 * Phase 13 - Insurance and accounts route protection plus API client wiring.
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

import { insuranceApi } from '@/lib/insurance';
import { routeDecision } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('Phase 13 insurance API wrappers', () => {
  it('loads providers, policies, bills, claims, detail, and receivables', async () => {
    await insuranceApi.providers('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/insurance/providers', tenant: 't1' });

    await insuranceApi.policies('t1', { q: 'Jane' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/insurance/policies?q=Jane' });

    await insuranceApi.bills('t1', { patientId: 'pat1' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/insurance/bills?patientId=pat1' });

    await insuranceApi.claims('t1', { status: 'SUBMITTED' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/insurance/claims?status=SUBMITTED' });

    await insuranceApi.getClaim('t1', 'claim1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/insurance/claims/claim1' });

    await insuranceApi.receivables('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/insurance/receivables' });
  });

  it('policy and claim mutation wrappers hit the correct endpoints', async () => {
    await insuranceApi.createPolicy('t1', { patientId: 'pat1', providerId: 'prov1', policyNumber: 'POL-1' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/policies' });

    await insuranceApi.updatePolicy('t1', 'pol1', { active: false });
    expect(last()).toMatchObject({ fn: 'apiPatch', path: '/insurance/policies/pol1', body: { active: false } });

    await insuranceApi.createClaim('t1', { billId: 'bill1', patientPolicyId: 'pol1', submit: true });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims', body: { billId: 'bill1', patientPolicyId: 'pol1', submit: true } });

    await insuranceApi.submitClaim('t1', 'claim1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims/claim1/submit' });

    await insuranceApi.reviewClaim('t1', 'claim1');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims/claim1/review' });

    await insuranceApi.approveClaim('t1', 'claim1', { approvedAmount: 5000 });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims/claim1/approve', body: { approvedAmount: 5000 } });

    await insuranceApi.rejectClaim('t1', 'claim1', 'Not covered');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims/claim1/reject', body: { reason: 'Not covered' } });

    await insuranceApi.settleClaim('t1', 'claim1', { amount: 5000, transactionId: 'EFT-1' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims/claim1/settle', body: { amount: 5000, transactionId: 'EFT-1' } });

    await insuranceApi.cancelClaim('t1', 'claim1', 'Duplicate');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/insurance/claims/claim1/cancel', body: { reason: 'Duplicate' } });
  });
});

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['INSURANCE_STAFF'],
    permissions: [
      'insurance.read',
      'insurance.policy.manage',
      'insurance.claim.create',
      'insurance.claim.update',
      'insurance.claim.approve',
      'insurance.claim.settle',
      'reports.financial.read',
    ],
    modules: ['BILLING', 'INSURANCE'],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

const PAGES = {
  insurance: {
    requireModule: 'INSURANCE',
    allowedRoles: ['INSURANCE_STAFF', 'BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN'],
    requirePermission: ['insurance.read'],
  },
  claim: {
    requireModule: 'INSURANCE',
    allowedRoles: ['INSURANCE_STAFF', 'BILLING', 'ACCOUNTANT', 'HOSPITAL_ADMIN'],
    requirePermission: ['insurance.read'],
  },
  accounts: {
    requireModule: 'BILLING',
    allowedRoles: ['ACCOUNTANT', 'HOSPITAL_ADMIN'],
    requirePermission: ['reports.financial.read'],
  },
};

describe('Phase 13 route protection', () => {
  it('insurance staff can open insurance and claim detail', () => {
    const m = membership();
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.insurance)).toBeNull();
    expect(routeDecision(p, m, PAGES.claim)).toBeNull();
  });

  it('tenant without insurance is routed to module-disabled', () => {
    const m = membership({ modules: ['BILLING'], permissions: ['insurance.read'] });
    expect(routeDecision(profile(m), m, PAGES.insurance)).toBe('/module-disabled?module=INSURANCE');
  });

  it('missing insurance permission returns unauthorized', () => {
    const m = membership({ permissions: ['bill.read'], modules: ['BILLING', 'INSURANCE'] });
    expect(routeDecision(profile(m), m, PAGES.claim)).toBe('/unauthorized');
  });

  it('accountant can open accounts when billing and financial permission are present', () => {
    const m = membership({ roles: ['ACCOUNTANT'], permissions: ['reports.financial.read', 'insurance.read'], modules: ['BILLING', 'INSURANCE'] });
    expect(routeDecision(profile(m), m, PAGES.accounts)).toBeNull();
  });

  it('insurance staff cannot open accounts without accountant/admin role', () => {
    const m = membership();
    expect(routeDecision(profile(m), m, PAGES.accounts)).toBe('/unauthorized');
  });
});
