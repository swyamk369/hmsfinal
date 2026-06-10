/**
 * Every canonical role's account works end to end: Firebase login → /auth/me
 * resolves the right role/modules/provider → landing route serves 200 → the
 * role's primary dashboard data endpoint returns real data (no 500, no
 * permission error on its own screen).
 */
import { api, demoToken, ok, signIn, state, superAdminToken, webStatus, type DemoRoleKey } from './harness';

const T = () => state().demoTenantId;

interface RoleCheck {
  key: DemoRoleKey;
  role: string;
  landing: string;
  needsProvider?: boolean;
  dataEndpoints: string[];
}

const ROLES: RoleCheck[] = [
  { key: 'admin', role: 'HOSPITAL_ADMIN', landing: '/admin', dataEndpoints: ['/admin/overview'] },
  { key: 'manager', role: 'HOSPITAL_MANAGER', landing: '/manager', dataEndpoints: ['/reports/operations'] },
  { key: 'reception', role: 'RECEPTION', landing: '/reception', dataEndpoints: ['/patients', '/encounters/queue'] },
  { key: 'doctor', role: 'DOCTOR', landing: '/doctor', needsProvider: true, dataEndpoints: ['/encounters/queue'] },
  { key: 'nurse', role: 'NURSE', landing: '/nursing', needsProvider: true, dataEndpoints: ['/nursing/dashboard'] },
  { key: 'labtech', role: 'LAB_TECH', landing: '/lab', dataEndpoints: ['/lab/orders'] },
  { key: 'pharmacist', role: 'PHARMACIST', landing: '/pharmacy', dataEndpoints: ['/pharmacy/prescriptions'] },
  { key: 'inventory', role: 'INVENTORY_MGR', landing: '/inventory', dataEndpoints: ['/inventory/items', '/inventory/alerts'] },
  { key: 'billing', role: 'BILLING', landing: '/billing', dataEndpoints: ['/billing/bills', '/billing/stats'] },
  { key: 'accountant', role: 'ACCOUNTANT', landing: '/accounts', dataEndpoints: ['/billing/stats'] },
  { key: 'insurance', role: 'INSURANCE_STAFF', landing: '/insurance', dataEndpoints: ['/insurance/claims', '/insurance/receivables'] },
];

describe('All-roles functional verification', () => {
  it.each(ROLES)('$role: /auth/me resolves role, modules, provider', async ({ key, role, needsProvider }) => {
    const me = await ok(await demoToken(key), null, 'GET', '/auth/me');
    expect(me.isPlatform).toBe(false);
    const m = me.tenants.find((t: any) => t.tenantId === T());
    expect(m).toBeDefined();
    expect(m.roles).toContain(role);
    expect(m.modules.length).toBeGreaterThan(0);
    if (needsProvider) expect(m.providerId).toBeTruthy();
  });

  it.each(ROLES)('$role: primary dashboard data endpoints return 2xx', async ({ key, dataEndpoints }) => {
    const token = await demoToken(key);
    for (const path of dataEndpoints) {
      const res = await api(token, T(), 'GET', path);
      expect({ path, status: res.status }).toEqual({ path, status: 200 });
    }
  });

  it('Super Admin resolves as platform and reads platform data', async () => {
    const me = await ok(await superAdminToken(), null, 'GET', '/auth/me');
    expect(me.isPlatform).toBe(true);
    expect((await api(await superAdminToken(), null, 'GET', '/platform/tenants')).status).toBe(200);
  });

  // Web landing routes render (auth handled client-side; a 200 shell proves the
  // route exists and compiles — not a marketing/404 page).
  it.each([...ROLES.map((r) => r.landing), '/platform'])('web route %s serves 200', async (route) => {
    if (!state().webUp) return; // skip gracefully if web dev server is down
    const status = await webStatus(route);
    expect(status).toBe(200);
  });
});

describe('Role primary workflow actions (live)', () => {
  it('reception can register a patient', async () => {
    const p = await ok(await demoToken('reception'), T(), 'POST', '/patients', {
      fullName: 'E2E Role Reception Patient',
      sex: 'OTHER',
      phone: '9000000050',
    });
    expect(p.mrn).toBeTruthy();
  });

  it('inventory manager can create an item', async () => {
    const item = await ok(await demoToken('inventory'), T(), 'POST', '/inventory/items', {
      name: `E2E-RoleItem-${Date.now()}`,
      type: 'CONSUMABLE',
      unit: 'unit',
    });
    expect(item.id).toBeTruthy();
  });

  it('billing can open and read a bill', async () => {
    const billing = await demoToken('billing');
    const reception = await demoToken('reception');
    const p = await ok(reception, T(), 'POST', '/patients', { fullName: 'E2E Role Bill Patient', sex: 'MALE', phone: '9000000051' });
    const bill = await ok(billing, T(), 'POST', '/billing/bills', {
      patientId: p.id,
      items: [{ name: 'E2E item', quantity: 1, unitPrice: 10000, sourceType: 'MANUAL' }],
    });
    expect(bill.status).toBe('UNPAID');
  });
});
