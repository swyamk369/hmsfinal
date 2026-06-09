import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

// Replace the cross-tenant identity client with an in-memory mock; keep the real
// constants (ROLES, ROLE_LANDING, etc.) so the service logic is unchanged.
jest.mock('@hms/db', () => {
  const actual = jest.requireActual('@hms/db');
  const model = () => ({
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    count: jest.fn(),
  });
  return {
    __esModule: true,
    ...actual,
    platformDb: {
      tenantUser: model(),
      user: model(),
      role: model(),
      userRole: model(),
      provider: model(),
      department: model(),
      permission: model(),
    },
  };
});

import { platformDb } from '@hms/db';
import { StaffService } from '../src/staff/staff.service';
import { AuditService } from '../src/common/audit.service';
import { FirebaseService } from '../src/common/firebase.service';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import type { Reflector } from '@nestjs/core';
import { DeactivateStaffDto } from '../src/staff/dto';
import { emptyContext, type RequestContext } from '../src/common/types';

const db = platformDb as any;

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}
function mockFirebase() {
  return {
    ensureUser: jest.fn().mockResolvedValue({ uid: 'fb-uid', created: true }),
    passwordResetLink: jest.fn().mockResolvedValue('https://reset.example/abc'),
  };
}
function makeService(audit = mockAudit(), fb = mockFirebase()) {
  return {
    svc: new StaffService(audit as unknown as AuditService, fb as unknown as FirebaseService),
    audit,
    fb,
  };
}
function ctx(): RequestContext {
  return { ...emptyContext(), userId: 'admin1', tenantId: 't1', db: {} as any };
}

const MEMBER = {
  id: 'tu9',
  userId: 'u9',
  active: true,
  deactivatedAt: null,
  deactivationReason: null,
  createdAt: new Date(),
  user: { fullName: 'Jane Doe', email: 'jane@h.org', phone: null },
  roles: [{ role: { code: 'RECEPTION' }, departmentId: null }],
};

beforeEach(() => {
  jest.clearAllMocks();
  // sensible defaults for the trailing getById() call and lookups
  db.tenantUser.findFirst.mockResolvedValue({ ...MEMBER });
  db.tenantUser.findUnique.mockResolvedValue(null);
  db.tenantUser.upsert.mockResolvedValue({ id: 'tu9' });
  db.tenantUser.update.mockResolvedValue({});
  db.tenantUser.count.mockResolvedValue(2);
  db.user.findUnique.mockResolvedValue(null);
  db.user.upsert.mockResolvedValue({ id: 'u9', email: 'jane@h.org' });
  db.user.update.mockResolvedValue({});
  db.userRole.deleteMany.mockResolvedValue({});
  db.userRole.createMany.mockResolvedValue({});
  db.provider.upsert.mockResolvedValue({});
  db.provider.updateMany.mockResolvedValue({});
  db.provider.findFirst.mockResolvedValue(null);
  db.department.findFirst.mockResolvedValue({ id: 'd1', tenantId: 't1' });
  db.department.findMany.mockResolvedValue([]);
});

describe('StaffService.invite', () => {
  it('invites a RECEPTION without creating a Provider', async () => {
    db.role.findMany.mockResolvedValue([{ id: 'r1', code: 'RECEPTION' }]);
    const { svc, audit } = makeService();

    await svc.invite(ctx(), { fullName: 'Reck', email: 'reck@h.org', roles: ['RECEPTION'] });

    expect(db.provider.upsert).not.toHaveBeenCalled();
    expect(db.tenantUser.upsert).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'staff.invite' }));
  });

  it('rejects a DOCTOR invite with no departmentId (400) before any Firebase call', async () => {
    const { svc, fb } = makeService();
    await expect(svc.invite(ctx(), { fullName: 'Doc', email: 'doc@h.org', roles: ['DOCTOR'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fb.ensureUser).not.toHaveBeenCalled();
  });

  it('creates a DOCTOR Provider when departmentId is supplied', async () => {
    db.role.findMany.mockResolvedValue([{ id: 'r2', code: 'DOCTOR' }]);
    const { svc } = makeService();

    await svc.invite(ctx(), { fullName: 'Doc', email: 'doc@h.org', roles: ['DOCTOR'], departmentId: 'd1' });

    expect(db.provider.upsert).toHaveBeenCalledTimes(1);
    expect(db.provider.upsert.mock.calls[0][0].create.type).toBe('DOCTOR');
  });

  it('creates a NURSE Provider when departmentId is supplied', async () => {
    db.role.findMany.mockResolvedValue([{ id: 'r3', code: 'NURSE' }]);
    const { svc } = makeService();

    await svc.invite(ctx(), { fullName: 'Nina', email: 'nina@h.org', roles: ['NURSE'], departmentId: 'd1' });

    expect(db.provider.upsert.mock.calls[0][0].create.type).toBe('NURSE');
  });

  it('returns a clean 409 when the person is already an active member', async () => {
    db.role.findMany.mockResolvedValue([{ id: 'r1', code: 'RECEPTION' }]);
    db.user.findUnique.mockResolvedValue({ id: 'u9', isPlatform: false });
    db.tenantUser.findUnique.mockResolvedValue({ id: 'tu9', active: true });
    const { svc } = makeService();

    await expect(
      svc.invite(ctx(), { fullName: 'Dup', email: 'jane@h.org', roles: ['RECEPTION'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('StaffService roles / lifecycle', () => {
  it('updateRoles replaces UserRole links', async () => {
    db.role.findMany.mockResolvedValue([{ id: 'r1', code: 'RECEPTION' }]);
    const { svc, audit } = makeService();

    await svc.updateRoles(ctx(), 'tu9', { roles: ['RECEPTION'] });

    expect(db.userRole.deleteMany).toHaveBeenCalledWith({ where: { tenantUserId: 'tu9' } });
    expect(db.userRole.createMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'staff.roles.update' }));
  });

  it('deactivate sets inactive fields (no hard delete) and audits', async () => {
    const { svc, audit } = makeService();

    await svc.deactivate(ctx(), 'tu9', 'Left the hospital');

    const updateArg = db.tenantUser.update.mock.calls[0][0];
    expect(updateArg.data.active).toBe(false);
    expect(updateArg.data.deactivationReason).toBe('Left the hospital');
    expect(updateArg.data.deactivatedAt).toBeInstanceOf(Date);
    expect(db.tenantUser.delete).toBeUndefined();
    expect(db.provider.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', userId: 'u9' },
      data: { active: false },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'staff.deactivate' }));
  });

  it('blocks deactivating your own account', async () => {
    db.tenantUser.findFirst.mockResolvedValue({ ...MEMBER, userId: 'admin1' });
    const { svc } = makeService();
    await expect(svc.deactivate(ctx(), 'tu9', 'because')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks deactivating the last active Hospital Admin', async () => {
    db.tenantUser.findFirst.mockResolvedValue({
      ...MEMBER,
      userId: 'u9',
      roles: [{ role: { code: 'HOSPITAL_ADMIN' }, departmentId: null }],
    });
    db.tenantUser.count.mockResolvedValue(1);
    const { svc } = makeService();
    await expect(svc.deactivate(ctx(), 'tu9', 'oops')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reactivate restores the membership', async () => {
    db.tenantUser.findFirst.mockResolvedValue({ ...MEMBER, active: false });
    const { svc, audit } = makeService();

    await svc.reactivate(ctx(), 'tu9');

    const updateArg = db.tenantUser.update.mock.calls[0][0];
    expect(updateArg.data.active).toBe(true);
    expect(updateArg.data.deactivatedAt).toBeNull();
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'staff.reactivate' }));
  });

  it('reset password calls the Firebase reset flow and audits', async () => {
    db.tenantUser.findFirst.mockResolvedValue({ ...MEMBER, user: { ...MEMBER.user, email: 'jane@h.org' } });
    const { svc, fb, audit } = makeService();

    const res = await svc.resetPassword(ctx(), 'tu9');

    expect(fb.passwordResetLink).toHaveBeenCalledWith('jane@h.org');
    expect(res.resetLink).toBe('https://reset.example/abc');
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'staff.reset_password' }));
  });
});

describe('StaffService providers / context', () => {
  it('providers/me returns the current provider for a doctor', async () => {
    db.provider.findFirst.mockResolvedValue({
      id: 'p1',
      userId: 'admin1',
      type: 'DOCTOR',
      departmentId: null,
      active: true,
      user: { fullName: 'Dr A', email: 'a@h.org' },
    });
    const { svc } = makeService();

    const me = await svc.myProvider(ctx());
    expect(me?.type).toBe('DOCTOR');
  });

  it('a platform user without tenant context cannot mutate', async () => {
    const noTenant: RequestContext = { ...emptyContext(), userId: 'p1', isPlatform: true };
    const { svc, fb } = makeService();
    await expect(
      svc.invite(noTenant, { fullName: 'X', email: 'x@h.org', roles: ['RECEPTION'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fb.ensureUser).not.toHaveBeenCalled();
  });
});

describe('Staff RBAC + reason enforcement', () => {
  function exec(c: Partial<RequestContext>): any {
    const full = { ...emptyContext(), ...c };
    return {
      switchToHttp: () => ({ getRequest: () => ({ ctx: full }) }),
      getHandler: () => () => {},
      getClass: () => class {},
    };
  }
  const reflector = (v: unknown) => ({ getAllAndOverride: () => v }) as unknown as Reflector;

  it('non-admin without staff.invite is blocked (403)', () => {
    const guard = new PermissionsGuard(reflector(['staff.invite']));
    expect(() => guard.canActivate(exec({ userId: 'u', permissions: new Set(['patient.read']) }))).toThrow(
      ForbiddenException,
    );
  });

  it('admin with staff.invite is allowed', () => {
    const guard = new PermissionsGuard(reflector(['staff.invite']));
    expect(guard.canActivate(exec({ userId: 'u', permissions: new Set(['staff.invite']) }))).toBe(true);
  });

  it('deactivate requires a non-empty reason (DTO validation → 400)', async () => {
    const empty = await validate(plainToInstance(DeactivateStaffDto, { reason: '' }));
    expect(empty.length).toBeGreaterThan(0);
    const ok = await validate(plainToInstance(DeactivateStaffDto, { reason: 'valid reason' }));
    expect(ok.length).toBe(0);
  });
});
