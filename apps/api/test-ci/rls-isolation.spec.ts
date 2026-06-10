/**
 * CI-runnable RLS isolation proof — needs a real Postgres (DATABASE_URL /
 * APP_DATABASE_URL) with migrations + rls.sql applied, but NO Firebase and NO
 * running API. Proves Postgres Row Level Security isolates two tenants through
 * the forTenant() client.
 *
 * Run: pnpm --filter @hms/api test:rls   (CI does this after db migrate/rls/seed)
 */
import { randomUUID } from 'node:crypto';
import { forTenant, platformDb, disconnectPrisma } from '@hms/db';

const A = randomUUID();
const B = randomUUID();
const mrnA = `CI-${A.slice(0, 8)}`;
let patientIdA: string;

beforeAll(async () => {
  const dbA = forTenant(A);
  const p = await dbA.patient.create({
    data: { tenantId: A, mrn: mrnA, fullName: 'CI RLS Patient', sex: 'MALE', phone: '0' },
  });
  patientIdA = p.id;
});

afterAll(async () => {
  // Cleanup as owner (bypasses RLS); audit_log is append-only and untouched.
  await platformDb.patient.deleteMany({ where: { id: patientIdA } }).catch(() => undefined);
  await disconnectPrisma();
});

describe('Postgres RLS tenant isolation', () => {
  it('tenant A can read its own patient', async () => {
    const dbA = forTenant(A);
    expect(await dbA.patient.findFirst({ where: { id: patientIdA } })).not.toBeNull();
  });

  it('tenant B cannot see tenant A patient (findFirst/findMany)', async () => {
    const dbB = forTenant(B);
    expect(await dbB.patient.findFirst({ where: { id: patientIdA } })).toBeNull();
    expect(await dbB.patient.findMany({ where: { id: patientIdA } })).toHaveLength(0);
  });

  it('tenant B cannot update or delete tenant A patient by id', async () => {
    const dbB = forTenant(B);
    expect((await dbB.patient.updateMany({ where: { id: patientIdA }, data: { fullName: 'HACK' } })).count).toBe(0);
    expect((await dbB.patient.deleteMany({ where: { id: patientIdA } })).count).toBe(0);
    const dbA = forTenant(A);
    expect((await dbA.patient.findFirst({ where: { id: patientIdA } }))!.fullName).toBe('CI RLS Patient');
  });

  it('WITH CHECK blocks writing a row tagged with another tenant', async () => {
    const dbB = forTenant(B);
    await expect(
      dbB.patient.create({ data: { tenantId: A, mrn: `CI-${B.slice(0, 8)}`, fullName: 'Smuggled', sex: 'MALE', phone: '0' } }),
    ).rejects.toThrow();
  });

  it('the app role cannot UPDATE or DELETE audit_log (append-only)', async () => {
    const dbA = forTenant(A);
    await dbA.auditLog.create({
      data: { tenantId: A, actorId: null, action: 'ci.rls.probe', entity: 'patient', entityId: patientIdA },
    });
    // Raw UPDATE/DELETE must be rejected by the trigger + REVOKE.
    await expect(dbA.$executeRawUnsafe(`UPDATE audit_log SET action='x' WHERE tenant_id='${A}'`)).rejects.toThrow();
    await expect(dbA.$executeRawUnsafe(`DELETE FROM audit_log WHERE tenant_id='${A}'`)).rejects.toThrow();
  });
});
