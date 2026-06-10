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

import { routeDecision } from '@/lib/access';
import { staffApi } from '@/lib/staff';
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
    permissions: ['role.read', 'role.write'],
    modules: ['ADMIN'],
    providerId: null,
    ...over,
  };
}

function profile(m: Membership): Profile {
  return { id: 'u1', email: 'admin@h.org', fullName: 'Admin', isPlatform: false, tenants: [m] };
}

describe('tenant role permission management', () => {
  it('updates a role permission matrix with a reason', async () => {
    await staffApi.updateRolePermissions('t1', 'role-doctor', {
      permissions: ['patient.read', 'lab.read'],
      reason: 'Hospital policy change',
    });

    expect(last()).toMatchObject({
      fn: 'apiPatch',
      path: '/roles/role-doctor/permissions',
      tenant: 't1',
      body: { permissions: ['patient.read', 'lab.read'], reason: 'Hospital policy change' },
    });
  });

  it('requires role.write for the Hospital Admin roles page', () => {
    const allowed = membership();
    expect(
      routeDecision(profile(allowed), allowed, {
        allowedRoles: ['HOSPITAL_ADMIN'],
        requirePermission: ['role.write'],
      }),
    ).toBeNull();

    const missingWrite = membership({ permissions: ['role.read'] });
    expect(
      routeDecision(profile(missingWrite), missingWrite, {
        allowedRoles: ['HOSPITAL_ADMIN'],
        requirePermission: ['role.write'],
      }),
    ).toBe('/unauthorized');
  });
});
