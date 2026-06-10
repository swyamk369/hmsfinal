/**
 * Tenant isolation — proven at the DATABASE level (Postgres RLS through
 * forTenant) and at the API level (real tokens, cross-tenant probes).
 */
import { forTenant, disconnectPrisma } from '@hms/db';
import { api, demoToken, ok, signIn, state, uniq } from './harness';

const A = () => state().demoTenantId; // Demo Hospital
const B = () => state().clinicB.tenantId; // E2E Clinic B

describe('RLS tenant isolation (DB level)', () => {
  let patientIdA: string;

  beforeAll(async () => {
    const dbA = forTenant(A());
    const patient = await dbA.patient.create({
      data: { tenantId: A(), mrn: uniq('MRN'), fullName: uniq('RLS Patient'), sex: 'MALE', phone: '0000000001' },
    });
    patientIdA = patient.id;
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('tenant B cannot read tenant A patients', async () => {
    const dbB = forTenant(B());
    expect(await dbB.patient.findFirst({ where: { id: patientIdA } })).toBeNull();
    expect(await dbB.patient.findMany({ where: { id: patientIdA } })).toHaveLength(0);
  });

  it('tenant B cannot mutate tenant A patients by id', async () => {
    const dbB = forTenant(B());
    const upd = await dbB.patient.updateMany({ where: { id: patientIdA }, data: { fullName: 'HACKED' } });
    expect(upd.count).toBe(0);
    const del = await dbB.patient.deleteMany({ where: { id: patientIdA } });
    expect(del.count).toBe(0);
    const dbA = forTenant(A());
    expect((await dbA.patient.findFirst({ where: { id: patientIdA } }))!.fullName).not.toBe('HACKED');
  });

  it('tenant B writes cannot be smuggled into tenant A (WITH CHECK)', async () => {
    const dbB = forTenant(B());
    await expect(
      dbB.patient.create({
        data: { tenantId: A(), mrn: uniq('MRN'), fullName: uniq('Smuggled'), sex: 'MALE', phone: '0' },
      }),
    ).rejects.toThrow();
  });

  it.each(['bill', 'labOrder', 'admission', 'inventoryItem', 'notification', 'auditLog'] as const)(
    'tenant B sees zero tenant A rows in %s',
    async (model) => {
      const dbA = forTenant(A());
      const dbB = forTenant(B());
      const anyA = await (dbA as any)[model].findFirst({ select: { id: true } });
      if (anyA) {
        expect(await (dbB as any)[model].findFirst({ where: { id: anyA.id } })).toBeNull();
      }
      // And B's view filtered to A's tenantId is always empty.
      expect(await (dbB as any)[model].findMany({ where: { tenantId: A() } })).toHaveLength(0);
    },
  );
});

describe('RLS tenant isolation (API level)', () => {
  let patientIdA: string;

  beforeAll(async () => {
    const reception = await demoToken('reception');
    const p = await ok(reception, A(), 'POST', '/patients', {
      fullName: uniq('API Iso Patient'),
      sex: 'FEMALE',
      phone: '0000000002',
    });
    patientIdA = p.id;
  });

  it("tenant B admin cannot read or mutate tenant A's record by id", async () => {
    const bAdmin = await signIn(state().clinicB.adminEmail, state().clinicB.adminPassword);
    const read = await api(bAdmin, B(), 'GET', `/patients/${patientIdA}`);
    expect([403, 404]).toContain(read.status);
    const write = await api(bAdmin, B(), 'PATCH', `/patients/${patientIdA}`, { fullName: 'HACKED' });
    expect([403, 404]).toContain(write.status);
  });

  it('tenant A user with tenant B header is rejected (no membership)', async () => {
    const reception = await demoToken('reception');
    const res = await api(reception, B(), 'GET', '/patients');
    expect(res.status).toBe(403);
  });
});
