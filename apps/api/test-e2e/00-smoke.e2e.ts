/** Stack + fixture sanity: tokens resolve, both tenants exist, web is up. */
import { api, demoToken, signIn, state, superAdminToken } from './harness';

describe('E2E smoke', () => {
  it('demo admin and super admin resolve via /auth/me', async () => {
    const me = await api(await demoToken('admin'), null, 'GET', '/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.isPlatform).toBe(false);
    expect(me.body.tenants.some((t: any) => t.tenantId === state().demoTenantId)).toBe(true);

    const sa = await api(await superAdminToken(), null, 'GET', '/auth/me');
    expect(sa.status).toBe(200);
    expect(sa.body.isPlatform).toBe(true);
  });

  it('Clinic B exists on GROWTH with a working admin login', async () => {
    const { clinicB } = state();
    const token = await signIn(clinicB.adminEmail, clinicB.adminPassword);
    const me = await api(token, null, 'GET', '/auth/me');
    expect(me.status).toBe(200);
    const m = me.body.tenants.find((t: any) => t.tenantId === clinicB.tenantId);
    expect(m).toBeDefined();
    expect(m.roles).toContain('HOSPITAL_ADMIN');
    // GROWTH plan: lab+pharmacy yes, IPD/insurance/inventory/reports no.
    expect(m.modules).toEqual(expect.arrayContaining(['LAB', 'PHARMACY', 'PATIENT', 'OPD', 'BILLING', 'ADMIN']));
    expect(m.modules).not.toContain('INSURANCE');
    expect(m.modules).not.toContain('IPD');
  });

  it('unauthenticated and garbage tokens are rejected', async () => {
    expect((await api(null, null, 'GET', '/patients')).status).toBe(401);
    expect((await api('garbage-token', null, 'GET', '/patients')).status).toBe(401);
  });
});
