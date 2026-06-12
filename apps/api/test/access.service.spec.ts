jest.mock('@hms/db', () => ({
  __esModule: true,
  platformDb: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    tenantUser: { findUnique: jest.fn() },
    moduleEntitlement: { findMany: jest.fn() },
    provider: { findFirst: jest.fn() },
  },
}));

import { platformDb } from '@hms/db';
import { AccessService, SUPPORT_TENANT_PERMISSIONS } from '../src/common/access.service';

const db = platformDb as any;

function activeTenant() {
  db.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', name: 'Demo Hospital', slug: 'demo', status: 'ACTIVE' });
  db.moduleEntitlement.findMany.mockResolvedValue([{ moduleCode: 'ADMIN' }, { moduleCode: 'PATIENT' }]);
  db.provider.findFirst.mockResolvedValue(null);
}

function membership(active = true) {
  return {
    active,
    roles: [
      {
        role: {
          code: 'DOCTOR',
          permissions: [{ permission: { key: 'encounter.write' } }, { permission: { key: 'patient.read' } }],
        },
      },
    ],
  };
}

describe('AccessService support access', () => {
  let service: AccessService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessService();
    activeTenant();
  });

  it('gives support staff without membership only the restricted non-PHI triage permissions', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'support-1', isSupport: true });
    db.tenantUser.findUnique.mockResolvedValue(null);

    const access = await service.resolveActive('support-1', 'tenant-1');

    expect(access.roles).toEqual(['PLATFORM_SUPPORT']);
    expect(access.permissions).toEqual(expect.arrayContaining([...SUPPORT_TENANT_PERMISSIONS]));
    expect(access.permissions).not.toContain('SYSTEM_ADMIN');
    expect(access.permissions).not.toContain('patient.read');
    expect(access.permissions).not.toContain('encounter.write');
    expect(access.membershipExists).toBe(true);
    expect(access.membershipActive).toBe(true);
  });

  it('uses an active hospital-granted membership instead of the support triage role', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'support-1', isSupport: true });
    db.tenantUser.findUnique.mockResolvedValue(membership(true));

    const access = await service.resolveActive('support-1', 'tenant-1');

    expect(access.roles).toEqual(['DOCTOR']);
    expect(access.permissions).toEqual(expect.arrayContaining(['encounter.write', 'patient.read']));
    expect(access.roles).not.toContain('PLATFORM_SUPPORT');
    expect(access.membershipExists).toBe(true);
    expect(access.membershipActive).toBe(true);
  });

  it('falls back to restricted support triage after a temporary membership is revoked', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'support-1', isSupport: true });
    db.tenantUser.findUnique.mockResolvedValue(membership(false));

    const access = await service.resolveActive('support-1', 'tenant-1');

    expect(access.roles).toEqual(['PLATFORM_SUPPORT']);
    expect(access.permissions).toEqual(expect.arrayContaining([...SUPPORT_TENANT_PERMISSIONS]));
    expect(access.permissions).not.toContain('encounter.write');
    expect(access.membershipExists).toBe(true);
    expect(access.membershipActive).toBe(true);
  });
});
