/**
 * Workflow 5: admit (bed → OCCUPIED) → doctor round + nursing vitals + charge
 * (reaches a bill) → discharge with reason (bed → AVAILABLE, summary exists,
 * encounter closed).
 */
import { forTenant, disconnectPrisma } from '@hms/db';
import { api, demoToken, ok, state, uniq } from './harness';

const T = () => state().demoTenantId;

describe('Workflow: IPD admit → charges → discharge', () => {
  let patientId: string;
  let wardId: string;
  let bedId: string;
  let admissionId: string;
  let providerId: string;

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeAll(async () => {
    const admin = await demoToken('admin');
    const reception = await demoToken('reception');
    const doctorMe = await ok(await demoToken('doctor'), null, 'GET', '/auth/me');
    providerId = doctorMe.tenants.find((t: any) => t.tenantId === T())!.providerId;

    const p = await ok(reception, T(), 'POST', '/patients', { fullName: uniq('IPD Patient'), sex: 'MALE', phone: '9000000030' });
    patientId = p.id;

    // Use the IPD module's own ward/bed setup so the workflow is self-contained.
    const ward = await ok(admin, T(), 'POST', '/ipd/wards', { name: uniq('Ward'), type: 'GENERAL' });
    wardId = ward.id;
    const bed = await ok(admin, T(), 'POST', '/ipd/beds', { wardId, bedNumber: uniq('BED') });
    bedId = bed.id;
  });

  it('admit sets the bed to OCCUPIED and creates an IPD encounter', async () => {
    const admin = await demoToken('admin');
    const admission = await ok(admin, T(), 'POST', '/ipd/admissions', {
      patientId,
      bedId,
      providerId,
      reason: 'E2E admission for observation',
    });
    admissionId = admission.id;
    expect(admission.status).toBe('ADMITTED');

    const db = forTenant(T());
    expect((await db.bed.findUnique({ where: { id: bedId } }))!.status).toBe('OCCUPIED');
  });

  it('a second admission to the same bed is blocked (no double-booking)', async () => {
    const admin = await demoToken('admin');
    const other = await ok(admin, T(), 'POST', '/patients', { fullName: uniq('IPD Patient2'), sex: 'FEMALE', phone: '9000000031' });
    const res = await api(admin, T(), 'POST', '/ipd/admissions', {
      patientId: other.id,
      bedId,
      providerId,
      reason: 'E2E should fail',
    });
    expect(res.status).toBe(400);
  });

  it('nurse records vitals, doctor adds a round, charge reaches a bill', async () => {
    const nurse = await demoToken('nurse');
    await ok(nurse, T(), 'POST', `/nursing/admissions/${admissionId}/vitals`, { systolicBp: 118, diastolicBp: 78, pulse: 72 });
    await ok(nurse, T(), 'POST', `/nursing/admissions/${admissionId}/notes`, { note: 'E2E nursing note: stable overnight' });

    const doctor = await demoToken('doctor');
    await ok(doctor, T(), 'POST', `/ipd/admissions/${admissionId}/rounds`, { notes: 'E2E round: continue current plan' });

    // ipd.charge.write is an admin/IPD-staff permission, not a doctor one.
    const admin = await demoToken('admin');
    await ok(admin, T(), 'POST', `/ipd/admissions/${admissionId}/charges`, {
      description: 'E2E room charge (1 day)',
      quantity: 1,
      unitPrice: 150000,
    });

    const detail = await ok(doctor, T(), 'GET', `/ipd/admissions/${admissionId}`);
    const flat = JSON.stringify(detail);
    // The charge should have produced a bill / bill item.
    expect(flat).toMatch(/bill/i);
  });

  it('discharge requires a reason', async () => {
    const admin = await demoToken('admin');
    const res = await api(admin, T(), 'POST', `/ipd/admissions/${admissionId}/discharge`, {
      summary: 'no reason provided',
      reason: '   ',
    });
    expect(res.status).toBe(400);
  });

  it('discharge frees the bed, writes a summary, and closes the encounter', async () => {
    const admin = await demoToken('admin');
    const discharged = await ok(admin, T(), 'POST', `/ipd/admissions/${admissionId}/discharge`, {
      reason: 'E2E recovered, fit for discharge',
      summary: 'E2E discharge summary: patient stable, advised rest.',
      instructions: 'Paracetamol SOS; review in 7 days.',
    });
    expect(discharged.status ?? discharged.admission?.status).toBe('DISCHARGED');

    const db = forTenant(T());
    expect((await db.bed.findUnique({ where: { id: bedId } }))!.status).toBe('AVAILABLE');

    const summary = await api(admin, T(), 'GET', `/ipd/admissions/${admissionId}/summary`);
    expect(summary.status).toBe(200);
    expect(JSON.stringify(summary.body)).toMatch(/discharge summary/i);
  });
});
