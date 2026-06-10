/**
 * Module entitlement on the GROWTH tenant (E2E Clinic B): disabled modules
 * block the API, /auth/me excludes them, and platform toggles flip access live.
 */
import { api, ok, signIn, state, superAdminToken } from './harness';

const B = () => state().clinicB.tenantId;
const bAdmin = () => signIn(state().clinicB.adminEmail, state().clinicB.adminPassword);

describe('Module entitlement (GROWTH tenant)', () => {
  it('disabled module APIs return 403', async () => {
    const token = await bAdmin();
    for (const path of ['/insurance/claims', '/ipd/wards', '/inventory/items', '/reports/operations']) {
      const res = await api(token, B(), 'GET', path);
      expect({ path, status: res.status }).toEqual({ path, status: 403 });
    }
  });

  it('entitled module APIs work', async () => {
    const token = await bAdmin();
    expect((await api(token, B(), 'GET', '/lab/orders')).status).toBe(200);
    expect((await api(token, B(), 'GET', '/pharmacy/prescriptions')).status).toBe(200);
    expect((await api(token, B(), 'GET', '/patients')).status).toBe(200);
  });

  it('/auth/me module list matches the plan', async () => {
    const me = await ok(await bAdmin(), null, 'GET', '/auth/me');
    const m = me.tenants.find((t: any) => t.tenantId === B());
    for (const mod of ['ADMIN', 'PATIENT', 'OPD', 'SCHEDULING', 'BILLING', 'LAB', 'PHARMACY']) {
      expect(m.modules).toContain(mod);
    }
    for (const mod of ['INSURANCE', 'IPD', 'INVENTORY', 'REPORTS']) {
      expect(m.modules).not.toContain(mod);
    }
  });

  it('platform module toggle flips API access on and off', async () => {
    const sa = await superAdminToken();
    const token = await bAdmin();

    await ok(sa, null, 'POST', `/platform/tenants/${B()}/modules`, { moduleCode: 'INSURANCE', enabled: true });
    try {
      expect((await api(token, B(), 'GET', '/insurance/claims')).status).toBe(200);
    } finally {
      await ok(sa, null, 'POST', `/platform/tenants/${B()}/modules`, { moduleCode: 'INSURANCE', enabled: false });
    }
    expect((await api(token, B(), 'GET', '/insurance/claims')).status).toBe(403);
  });
});
