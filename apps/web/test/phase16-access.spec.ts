/**
 * Phase 16 — Audit, Compliance, And Safety: /admin/audit route protection,
 * audit API client wiring, and security headers in the web config.
 */
import fs from 'node:fs';
import path from 'node:path';

const calls: { fn: string; path: string; body: unknown; tenant: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, body: undefined, tenant });
    return Promise.resolve({ total: 0, page: 1, pageSize: 50, rows: [] });
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

import { routeDecision } from '@/lib/access';
import { adminApi } from '@/lib/admin';
import type { Membership, Profile } from '@/lib/types';

const last = () => calls[calls.length - 1];

beforeEach(() => {
  calls.length = 0;
});

function membership(over: Partial<Membership> = {}): Membership {
  return {
    tenantId: 't1',
    tenantName: 'Demo',
    tenantSlug: 'demo',
    status: 'ACTIVE',
    roles: ['HOSPITAL_ADMIN'],
    permissions: [],
    modules: [],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'a@b.org', fullName: 'A', isPlatform: false, tenants: [m] };
}

describe('Phase 16 audit API wrapper', () => {
  it('builds the audit search query string from filters', async () => {
    await adminApi.audit('t1', { action: 'bill.cancel', entity: 'bill', page: 2, pageSize: 25 });
    expect(last()).toMatchObject({
      fn: 'apiGet',
      path: '/admin/audit?action=bill.cancel&entity=bill&page=2&pageSize=25',
      tenant: 't1',
    });
  });

  it('omits empty filters', async () => {
    await adminApi.audit('t1');
    expect(last()).toMatchObject({ fn: 'apiGet', path: '/admin/audit', tenant: 't1' });
  });
});

describe('Phase 16 /admin/audit route protection', () => {
  it('allows a Hospital Admin', () => {
    const m = membership();
    expect(routeDecision(profile(m), m, { allowedRoles: ['HOSPITAL_ADMIN'] })).toBeNull();
  });

  it('blocks non-admin tenant roles', () => {
    const m = membership({ roles: ['DOCTOR'] });
    expect(routeDecision(profile(m), m, { allowedRoles: ['HOSPITAL_ADMIN'] })).toBe('/unauthorized');
  });

  it('still enforces tenant suspension', () => {
    const m = membership({ status: 'SUSPENDED' });
    expect(routeDecision(profile(m), m, { allowedRoles: ['HOSPITAL_ADMIN'] })).toBe('/tenant-suspended');
  });
});

describe('Phase 16 audit page and shell', () => {
  it('audit page is read-only and admin-gated', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'src/app/admin/audit/page.tsx'), 'utf8');
    expect(text).toContain("allowedRoles={['HOSPITAL_ADMIN']}");
    // Forensic view only — no mutation affordances.
    expect(text).not.toMatch(/apiPost|apiPatch|apiDelete/);
  });

  it('AdminTabs links to the audit page', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'src/components/AdminTabs.tsx'), 'utf8');
    expect(text).toContain("href: '/admin/audit'");
  });

  it('next.config sets the security headers', () => {
    const text = fs.readFileSync(path.join(process.cwd(), 'next.config.mjs'), 'utf8');
    expect(text).toContain('X-Frame-Options');
    expect(text).toContain('X-Content-Type-Options');
    expect(text).toContain('Referrer-Policy');
  });
});
