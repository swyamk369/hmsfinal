import fs from 'node:fs';
import path from 'node:path';
import { visibleNav } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

const calls: { fn: string; path: string; body?: unknown; tenant?: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, tenant });
    return Promise.resolve([]);
  },
  apiPost: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPost', path, body, tenant });
    return Promise.resolve({});
  },
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

import { financeApi } from '@/lib/finance';
import { opdApi } from '@/lib/opd';

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo Hospital',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['RECEPTION'],
    permissions: [],
    modules: ['BILLING'],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@demo.local', fullName: 'Aarti Admin', isPlatform: false, tenants: [m] };
}

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('Phase 20 finance client wiring', () => {
  it('loads finance dashboard, patient account, pending charges, bills, and ledgers with tenant context', async () => {
    await financeApi.dashboard('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/finance/dashboard', tenant: 't1' });

    await financeApi.patientAccount('t1', 'patient1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/finance/patient-accounts/patient1', tenant: 't1' });

    await financeApi.pendingCharges('t1', { patientId: 'patient1', sourceModule: 'LAB' });
    expect(last()).toMatchObject({
      fn: 'apiGet',
      path: '/finance/pending-charges?patientId=patient1&sourceModule=LAB',
      tenant: 't1',
    });

    await financeApi.bills('t1', { status: 'UNPAID' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/finance/bills?status=UNPAID', tenant: 't1' });

    await financeApi.payments('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/finance/payments', tenant: 't1' });

    await financeApi.refunds('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/finance/refunds', tenant: 't1' });
  });

  it('posts bill-from-charges, payments, refunds, cancellations, day close, and approval decisions', async () => {
    await financeApi.billFromCharges('t1', { chargeIds: ['charge1'], notes: 'checkout' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/bills/from-charges', body: { chargeIds: ['charge1'], notes: 'checkout' }, tenant: 't1' });

    await financeApi.pay('t1', 'bill1', { amount: 5000, method: 'CASH' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/bills/bill1/payments', body: { amount: 5000, method: 'CASH' } });

    await financeApi.refund('t1', 'bill1', 1000, 'Patient overpaid');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/bills/bill1/refunds', body: { amount: 1000, reason: 'Patient overpaid' } });

    await financeApi.cancelBill('t1', 'bill1', 'Duplicate bill');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/bills/bill1/cancel', body: { reason: 'Duplicate bill' } });

    await financeApi.closeDay('t1', { businessDate: '2026-06-10', notes: 'Matched cash drawer' });
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/day-close' });

    await financeApi.approve('t1', 'approval1', 'Approved by finance manager');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/approvals/approval1/approve', body: { reason: 'Approved by finance manager' } });

    await financeApi.reject('t1', 'approval1', 'Need documents');
    expect(last()).toMatchObject({ fn: 'apiPost', path: '/finance/approvals/approval1/reject', body: { reason: 'Need documents' } });

    await opdApi.chargeConsultation('t1', 'enc1', { name: 'OPD consultation', unitPrice: 5000 });
    expect(last()).toMatchObject({
      fn: 'apiPost',
      path: '/encounters/enc1/consultation-charge',
      body: { name: 'OPD consultation', unitPrice: 5000 },
      tenant: 't1',
    });
  });
});

describe('Phase 20 finance route and navigation surface', () => {
  it('exposes all Finance workspace routes and preserves old billing/accounts URLs', () => {
    const files = [
      'src/app/finance/page.tsx',
      'src/app/finance/cashier/page.tsx',
      'src/app/finance/bills/page.tsx',
      'src/app/finance/bills/[id]/page.tsx',
      'src/app/finance/patient-accounts/[patientId]/page.tsx',
      'src/app/finance/pending-charges/page.tsx',
      'src/app/finance/payments/page.tsx',
      'src/app/finance/refunds/page.tsx',
      'src/app/finance/insurance-receivables/page.tsx',
      'src/app/finance/day-close/page.tsx',
      'src/app/finance/approvals/page.tsx',
      'src/app/finance/reports/page.tsx',
      'src/app/billing/page.tsx',
      'src/app/accounts/page.tsx',
    ];
    for (const file of files) expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true);
  });

  it('shows Finance to reception/cashier users by permission and hides legacy sidebar entries', () => {
    const m = membership({ permissions: ['finance.cashier', 'payment.collect'] });
    const hrefs = visibleNav(profile(m), m).map((item) => item.href);
    expect(hrefs).toContain('/finance');
    expect(hrefs).not.toContain('/billing');
    expect(hrefs).not.toContain('/accounts');
  });

  it('patient profile links bills and current journey to Finance', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'src/app/patients/[id]/page.tsx'), 'utf8');
    expect(text).toContain('/finance/bills/');
    expect(text).toContain('/finance/patient-accounts/');
    expect(text).toContain('Pending charges');
  });
});
