/**
 * RBAC per role against the live API. 403 means the guard blocked it; a
 * 400/404 on a probe id means the permission PASSED and the handler rejected
 * the fake payload — that distinction proves where enforcement happens.
 */
import { api, demoToken, state, superAdminToken, type DemoRoleKey } from './harness';

const NIL = '00000000-0000-0000-0000-000000000000';
const T = () => state().demoTenantId;

async function call(role: DemoRoleKey, method: string, path: string, body?: unknown) {
  return api(await demoToken(role), T(), method, path, body);
}

describe('RBAC: allowed routes return 2xx', () => {
  const allowed: Array<[DemoRoleKey, string, string]> = [
    ['admin', 'GET', '/admin/overview'],
    ['manager', 'GET', '/reports/operations'],
    ['reception', 'GET', '/patients'],
    ['reception', 'GET', '/encounters/queue'],
    ['doctor', 'GET', '/encounters/queue'],
    ['nurse', 'GET', '/nursing/dashboard'],
    ['labtech', 'GET', '/lab/orders'],
    ['pharmacist', 'GET', '/pharmacy/prescriptions'],
    ['inventory', 'GET', '/inventory/items'],
    ['billing', 'GET', '/billing/bills'],
    ['accountant', 'GET', '/billing/stats'],
    ['insurance', 'GET', '/insurance/claims'],
  ];

  it.each(allowed)('%s can %s %s', async (role, method, path) => {
    const res = await call(role, method, path);
    expect(res.status).toBeLessThan(300);
  });
});

describe('RBAC: forbidden routes return 403', () => {
  const forbidden: Array<[DemoRoleKey, string, string, unknown?]> = [
    // doctor cannot manage staff or read audit
    ['doctor', 'POST', '/staff', { fullName: 'X', email: 'x@x.local', roles: ['NURSE'] }],
    ['doctor', 'GET', '/admin/audit'],
    // reception cannot enter lab results
    ['reception', 'POST', `/lab/orders/${NIL}/results`, { results: [{ labOrderItemId: NIL }] }],
    // lab tech cannot dispense
    ['labtech', 'POST', `/pharmacy/prescriptions/${NIL}/dispense`, { items: [{ inventoryItemId: NIL, quantity: 1 }] }],
    // pharmacist cannot adjust stock
    ['pharmacist', 'POST', '/inventory/adjustments', { batchId: NIL, delta: -1, reason: 'x' }],
    // manager is read-only
    ['manager', 'POST', '/patients', { fullName: 'X' }],
    ['manager', 'POST', '/billing/bills', { patientId: NIL, items: [] }],
    // billing/accountant/insurance cannot register patients
    ['billing', 'POST', '/patients', { fullName: 'X' }],
    ['accountant', 'POST', '/patients', { fullName: 'X' }],
    ['insurance', 'POST', '/patients', { fullName: 'X' }],
    // nurse cannot bill
    ['nurse', 'POST', '/billing/bills', { patientId: NIL, items: [] }],
  ];

  // Plain loop of it() rather than it.each: a ragged tuple array (rows with and
  // without a body) confuses jest-each's arg binding and wedges the runner.
  for (const [role, method, path, body] of forbidden) {
    it(`${role} is blocked from ${method} ${path}`, async () => {
      const res = await call(role, method, path, body);
      expect(res.status).toBe(403);
    });
  }

  it('403 keeps the standard error shape', async () => {
    const res = await call('manager', 'POST', '/patients', { fullName: 'X' });
    expect(res.body).toMatchObject({ statusCode: 403 });
    expect(typeof res.body.message === 'string' || Array.isArray(res.body.message)).toBe(true);
  });
});

describe('RBAC: permission passes but handler validates (403 vs 400/404 distinction)', () => {
  it('accountant MAY refund (guard passes, fake bill rejected by handler)', async () => {
    const res = await call('accountant', 'POST', `/billing/bills/${NIL}/refunds`, {
      amount: 100,
      reason: 'rbac probe — fake bill id',
    });
    expect(res.status).not.toBe(403);
    expect([400, 404]).toContain(res.status);
  });

  it('inventory manager MAY adjust stock (guard passes, fake batch rejected)', async () => {
    const res = await call('inventory', 'POST', '/inventory/adjustments', {
      batchId: NIL,
      delta: -1,
      reason: 'rbac probe — fake batch id',
    });
    expect(res.status).not.toBe(403);
    expect([400, 404]).toContain(res.status);
  });
});

describe('RBAC: platform boundary', () => {
  it('Hospital Admin cannot reach platform routes', async () => {
    const res = await call('admin', 'GET', '/platform/tenants');
    expect(res.status).toBe(403);
  });

  it('Super Admin cannot read or write tenant clinical data', async () => {
    const sa = await superAdminToken();
    const read = await api(sa, T(), 'GET', '/patients');
    expect(read.status).toBe(403);
    const write = await api(sa, T(), 'POST', '/patients', { fullName: 'SA-PROBE', sex: 'MALE', phone: '1' });
    expect(write.status).toBe(403);
  });

  it('Super Admin keeps platform access', async () => {
    const sa = await superAdminToken();
    expect((await api(sa, null, 'GET', '/platform/tenants')).status).toBe(200);
  });
});
