import fs from 'node:fs';
import path from 'node:path';

const calls: { fn: string; path: string; tenant: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, tenant });
    return Promise.resolve({ items: [] });
  },
  apiPost: jest.fn(),
  apiPatch: jest.fn(),
  apiDelete: jest.fn(),
}));

import { operationsApi } from '@/lib/operations';
import { patientsApi } from '@/lib/patients';
import { visibleNav } from '@/lib/access';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

describe('Phase 19 operations client wiring', () => {
  it('loads work queue, summary, blockers, and recent activity with tenant context', async () => {
    await operationsApi.workQueue('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/operations/work-queue', tenant: 't1' });

    await operationsApi.summary('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/operations/work-queue/summary', tenant: 't1' });

    await operationsApi.blockers('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/operations/blockers', tenant: 't1' });

    await operationsApi.recentActivity('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/operations/recent-activity', tenant: 't1' });
  });

  it('loads patient journey from the patient profile endpoint', async () => {
    await patientsApi.journey('t1', 'p1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/patients/p1/journey', tenant: 't1' });
  });
});

describe('Phase 19 dashboard and support screens', () => {
  it('adds operations work queues to every role dashboard', () => {
    const files = [
      'src/app/dashboard/page.tsx',
      'src/app/manager/page.tsx',
      'src/app/reception/page.tsx',
      'src/app/doctor/page.tsx',
      'src/app/nursing/page.tsx',
      'src/app/lab/page.tsx',
      'src/app/pharmacy/page.tsx',
      'src/app/inventory/page.tsx',
      'src/app/billing/page.tsx',
      'src/app/accounts/page.tsx',
      'src/app/insurance/page.tsx',
      'src/app/admin/page.tsx',
    ];

    for (const file of files) {
      const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(text).toContain('WorkQueuePanel');
      expect(text).toContain('HelpTip');
    }
  });

  it('adds patient journey to the patient profile page', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'src/app/patients/[id]/page.tsx'), 'utf8');
    expect(text).toContain('patientsApi.journey');
    expect(text).toContain('Current patient journey');
    expect(text).toContain('JourneyStrip');
  });

  it('creates support routes and links the sidebar support item', () => {
    for (const file of [
      'src/app/support/page.tsx',
      'src/app/support/workflows/page.tsx',
      'src/app/support/roles/page.tsx',
      'src/app/support/troubleshooting/page.tsx',
    ]) {
      expect(fs.existsSync(path.join(process.cwd(), file))).toBe(true);
    }

    const shell = fs.readFileSync(path.join(process.cwd(), 'src/components/app-shell.tsx'), 'utf8');
    expect(shell).toContain('href="/support"');
  });

  it('shows the live OPD queue route to reception users', () => {
    const membership: Membership = {
      tenantId: 't1',
      tenantName: 'Demo Hospital',
      tenantSlug: 'demo',
      status: 'ACTIVE',
      roles: ['RECEPTION'],
      permissions: ['queue.read', 'encounter.read'],
      modules: ['OPD'],
      providerId: null,
    };
    const profile: Profile = {
      id: 'u1',
      email: 'frontdesk@demo.local',
      fullName: 'Reception User',
      isPlatform: false,
      tenants: [membership],
    };

    expect(visibleNav(profile, membership).map((item) => item.href)).toEqual(expect.arrayContaining(['/reception', '/opd']));
  });
});
