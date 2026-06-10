/**
 * Phase 14 - Reports and dashboards route protection plus client/export wiring.
 */
import fs from 'node:fs';
import path from 'node:path';

const calls: { fn: string; path: string; tenant: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, tenant });
    return Promise.resolve({});
  },
}));

import { routeDecision } from '@/lib/access';
import { csvFromRows, reportsApi } from '@/lib/reports';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('Phase 14 report API wrappers and CSV export', () => {
  it('loads dashboard, manager, and detailed reports from the correct endpoints', async () => {
    await reportsApi.dashboard('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/reports/dashboard', tenant: 't1' });

    await reportsApi.manager('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/reports/manager' });

    await reportsApi.operations('t1', { startDate: '2026-06-01', status: 'COMPLETED', endDate: '' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/reports/operations?startDate=2026-06-01&status=COMPLETED' });

    await reportsApi.financial('t1', { billStatus: 'PAID', paymentMethod: 'CASH' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/reports/financial?billStatus=PAID&paymentMethod=CASH' });

    await reportsApi.inventory('t1', { transactionType: 'STOCK_IN' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/reports/inventory?transactionType=STOCK_IN' });

    await reportsApi.clinical('t1', { startDate: '2026-06-01', endDate: '2026-06-30' });
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/reports/clinical?startDate=2026-06-01&endDate=2026-06-30' });
  });

  it('CSV export includes discovered headers and escapes commas, quotes, and new lines', () => {
    const csv = csvFromRows([
      { bill: 'INV-1', patient: 'Jane, Doe', note: 'A "quoted" note' },
      { bill: 'INV-2', amount: 2000, note: 'line\nbreak' },
    ]);
    expect(csv.split('\n')[0]).toContain('bill');
    expect(csv).toContain('"Jane, Doe"');
    expect(csv).toContain('"A ""quoted"" note"');
    expect(csv).toContain('line break');
  });
});

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['HOSPITAL_MANAGER'],
    permissions: [
      'reports.read',
      'reports.operational.read',
      'reports.financial.read',
      'reports.inventory.read',
      'reports.clinical.read',
      'bill.read',
      'inventory.read',
      'inventory.reports.read',
      'encounter.read',
      'lab.read',
    ],
    modules: ['REPORTS', 'BILLING', 'INVENTORY', 'LAB', 'IPD'],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

const PAGES = {
  dashboard: {},
  manager: { requireModule: 'REPORTS', allowedRoles: ['HOSPITAL_MANAGER', 'HOSPITAL_ADMIN'], requirePermission: ['reports.read', 'reports.operational.read'] },
  reports: {
    requireModule: 'REPORTS',
    allowedRoles: ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'ACCOUNTANT', 'BILLING', 'INVENTORY_MGR', 'DOCTOR', 'LAB_TECH'],
    requirePermission: ['reports.read', 'reports.operational.read', 'reports.financial.read', 'reports.inventory.read', 'reports.clinical.read', 'bill.read', 'inventory.read', 'lab.read', 'encounter.read'],
  },
  operations: { requireModule: 'REPORTS', allowedRoles: ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER'], requirePermission: ['reports.read', 'reports.operational.read'] },
  financial: { requireModule: 'REPORTS', allowedRoles: ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'ACCOUNTANT', 'BILLING'], requirePermission: ['reports.read', 'reports.financial.read', 'bill.read'] },
  inventory: { requireModule: 'REPORTS', allowedRoles: ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'INVENTORY_MGR'], requirePermission: ['reports.read', 'reports.inventory.read', 'inventory.reports.read', 'inventory.read'] },
  clinical: { requireModule: 'REPORTS', allowedRoles: ['HOSPITAL_ADMIN', 'HOSPITAL_MANAGER', 'DOCTOR', 'LAB_TECH'], requirePermission: ['reports.read', 'reports.clinical.read', 'encounter.read', 'lab.read'] },
};

describe('Phase 14 route protection', () => {
  it('manager can open dashboard and all report routes with report permissions', () => {
    const m = membership();
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.dashboard)).toBeNull();
    expect(routeDecision(p, m, PAGES.manager)).toBeNull();
    expect(routeDecision(p, m, PAGES.reports)).toBeNull();
    expect(routeDecision(p, m, PAGES.operations)).toBeNull();
    expect(routeDecision(p, m, PAGES.financial)).toBeNull();
    expect(routeDecision(p, m, PAGES.inventory)).toBeNull();
    expect(routeDecision(p, m, PAGES.clinical)).toBeNull();
  });

  it('tenant without REPORTS is routed to module-disabled for report routes but dashboard remains reachable', () => {
    const m = membership({ modules: ['BILLING', 'INVENTORY'] });
    expect(routeDecision(profile(m), m, PAGES.dashboard)).toBeNull();
    expect(routeDecision(profile(m), m, PAGES.reports)).toBe('/module-disabled?module=REPORTS');
  });

  it('missing report permission returns unauthorized', () => {
    const m = membership({ permissions: ['patient.read'], modules: ['REPORTS'] });
    expect(routeDecision(profile(m), m, PAGES.operations)).toBe('/unauthorized');
  });

  it('accountant can open financial report only with billing/report access', () => {
    const m = membership({ roles: ['ACCOUNTANT'], permissions: ['reports.financial.read'], modules: ['REPORTS', 'BILLING'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.financial)).toBeNull();
    expect(routeDecision(p, m, PAGES.inventory)).toBe('/unauthorized');
  });

  it('doctor can open clinical report with clinical permissions but cannot open manager command center', () => {
    const m = membership({ roles: ['DOCTOR'], permissions: ['reports.clinical.read', 'encounter.read'], modules: ['REPORTS', 'OPD', 'LAB'] });
    const p = profile(m);
    expect(routeDecision(p, m, PAGES.clinical)).toBeNull();
    expect(routeDecision(p, m, PAGES.manager)).toBe('/unauthorized');
  });
});

describe('Phase 14 pages are not placeholders', () => {
  it('dashboard, manager, reports, and detailed reports do not render PhasePlaceholder copy', () => {
    const files = [
      'src/app/dashboard/page.tsx',
      'src/app/manager/page.tsx',
      'src/app/reports/page.tsx',
      'src/app/reports/operations/page.tsx',
      'src/app/reports/financial/page.tsx',
      'src/app/reports/inventory/page.tsx',
      'src/app/reports/clinical/page.tsx',
    ];
    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(text).not.toContain('PhasePlaceholder');
      expect(text).not.toContain('Workflow coming');
      expect(text).not.toContain('upcoming phases');
    }
  });
});
