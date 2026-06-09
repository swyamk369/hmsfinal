import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { TenantGuard } from '../src/common/guards/tenant.guard';
import { emptyContext, type RequestContext } from '../src/common/types';

// Builds a fake ExecutionContext carrying the given request context.
function execFor(ctx: Partial<RequestContext>): any {
  const full: RequestContext = { ...emptyContext(), ...ctx };
  return {
    switchToHttp: () => ({ getRequest: () => ({ ctx: full }) }),
    getHandler: () => function handler() {},
    getClass: () => class Cls {},
  };
}

// Reflector stub returning a fixed metadata value for getAllAndOverride.
function reflector(value: unknown): Reflector {
  return { getAllAndOverride: () => value } as unknown as Reflector;
}

describe('PermissionsGuard (admin write protection)', () => {
  it('allows when no permission is required', () => {
    const guard = new PermissionsGuard(reflector(undefined));
    expect(guard.canActivate(execFor({ userId: 'u1' }))).toBe(true);
  });

  it('allows a user holding the required permission', () => {
    const guard = new PermissionsGuard(reflector(['facility.write']));
    const ctx = { userId: 'u1', permissions: new Set(['facility.write']) };
    expect(guard.canActivate(execFor(ctx))).toBe(true);
  });

  it('blocks a non-admin tenant user missing the permission with 403', () => {
    const guard = new PermissionsGuard(reflector(['facility.write']));
    const ctx = { userId: 'u1', permissions: new Set(['patient.read']) };
    expect(() => guard.canActivate(execFor(ctx))).toThrow(ForbiddenException);
  });

  it('lets platform users bypass the permission check', () => {
    const guard = new PermissionsGuard(reflector(['facility.write']));
    expect(guard.canActivate(execFor({ userId: 'p1', isPlatform: true }))).toBe(true);
  });

  it('rejects an unauthenticated caller with 401', () => {
    const guard = new PermissionsGuard(reflector(['facility.write']));
    expect(() => guard.canActivate(execFor({ userId: null }))).toThrow(UnauthorizedException);
  });
});

describe('ModuleGuard (lab/insurance setup gating)', () => {
  it('allows when no module is required', () => {
    const guard = new ModuleGuard(reflector(undefined));
    expect(guard.canActivate(execFor({ tenantId: 't1' }))).toBe(true);
  });

  it('blocks a tenant without the required module entitlement', () => {
    const guard = new ModuleGuard(reflector('LAB'));
    const ctx = { tenantId: 't1', modules: new Set(['ADMIN', 'PATIENT']) };
    expect(() => guard.canActivate(execFor(ctx))).toThrow(ForbiddenException);
  });

  it('allows a tenant that has the module enabled', () => {
    const guard = new ModuleGuard(reflector('LAB'));
    const ctx = { tenantId: 't1', modules: new Set(['ADMIN', 'LAB']) };
    expect(guard.canActivate(execFor(ctx))).toBe(true);
  });

  it('lets platform users bypass the module check', () => {
    const guard = new ModuleGuard(reflector('INSURANCE'));
    expect(guard.canActivate(execFor({ isPlatform: true }))).toBe(true);
  });
});

describe('TenantGuard (membership + tenant status)', () => {
  const guard = new TenantGuard();

  it('passes through tenant-less routes', () => {
    expect(guard.canActivate(execFor({ userId: 'u1', tenantId: null }))).toBe(true);
  });

  it('blocks a user with no active membership for the tenant', () => {
    const ctx = { userId: 'u1', tenantId: 't1', membershipExists: false, membershipActive: false };
    expect(() => guard.canActivate(execFor(ctx))).toThrow(ForbiddenException);
  });

  it('blocks access to a SUSPENDED tenant even with active membership', () => {
    const ctx = {
      userId: 'u1',
      tenantId: 't1',
      membershipExists: true,
      membershipActive: true,
      tenantStatus: 'SUSPENDED',
    };
    expect(() => guard.canActivate(execFor(ctx))).toThrow(ForbiddenException);
  });

  it('allows an active member of an ACTIVE tenant', () => {
    const ctx = {
      userId: 'u1',
      tenantId: 't1',
      membershipExists: true,
      membershipActive: true,
      tenantStatus: 'ACTIVE',
    };
    expect(guard.canActivate(execFor(ctx))).toBe(true);
  });

  it('lets platform users through without a membership', () => {
    expect(guard.canActivate(execFor({ isPlatform: true, tenantId: 't1' }))).toBe(true);
  });
});
