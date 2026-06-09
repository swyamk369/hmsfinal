import {
  modulesForPlan,
  PLAN_CODES,
  MODULES,
  ROLE_DEFS,
  ROLES,
  TENANT_PERMISSIONS,
  PLATFORM_PERMISSIONS,
  ALL_PERMISSIONS,
} from '@hms/db';

function rolePerms(code: string): string[] {
  return ROLE_DEFS.find((r) => r.code === code)?.permissions ?? [];
}

describe('canonical plan → module mapping', () => {
  it('STARTER includes core modules and excludes growth/pro modules', () => {
    const m = modulesForPlan(PLAN_CODES.STARTER);
    expect(m).toEqual(expect.arrayContaining([MODULES.ADMIN, MODULES.PATIENT, MODULES.OPD, MODULES.SCHEDULING, MODULES.BILLING]));
    expect(m).not.toContain(MODULES.LAB);
    expect(m).not.toContain(MODULES.IPD);
    expect(m).not.toContain(MODULES.INSURANCE);
  });

  it('GROWTH adds LAB and PHARMACY', () => {
    const m = modulesForPlan(PLAN_CODES.GROWTH);
    expect(m).toEqual(expect.arrayContaining([MODULES.LAB, MODULES.PHARMACY]));
    expect(m).not.toContain(MODULES.IPD);
  });

  it('ENTERPRISE enables every module', () => {
    const m = modulesForPlan(PLAN_CODES.ENTERPRISE);
    for (const code of Object.values(MODULES)) expect(m).toContain(code);
  });
});

describe('canonical role → permission mapping', () => {
  it('SUPER_ADMIN holds only platform permissions', () => {
    const perms = rolePerms(ROLES.SUPER_ADMIN);
    expect(perms.length).toBeGreaterThan(0);
    expect(perms.every((p) => p.startsWith('platform.'))).toBe(true);
  });

  it('HOSPITAL_ADMIN holds all tenant permissions and no platform permissions', () => {
    const perms = new Set(rolePerms(ROLES.HOSPITAL_ADMIN));
    for (const p of TENANT_PERMISSIONS) expect(perms.has(p)).toBe(true);
    expect([...perms].some((p) => PLATFORM_PERMISSIONS.includes(p as any))).toBe(false);
  });

  it('DOCTOR can prescribe and order labs but cannot manage staff', () => {
    const perms = new Set(rolePerms(ROLES.DOCTOR));
    expect(perms.has('prescription.write')).toBe(true);
    expect(perms.has('lab.order')).toBe(true);
    expect(perms.has('staff.invite')).toBe(false);
  });

  it('every role permission is a known canonical permission', () => {
    const known = new Set(ALL_PERMISSIONS);
    for (const def of ROLE_DEFS) {
      for (const p of def.permissions) expect(known.has(p)).toBe(true);
    }
  });
});
