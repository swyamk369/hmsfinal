/**
 * Workflow 2: Reception registers patient → walk-in encounter → doctor starts
 * and completes consultation → bill created → payment → PAID → timeline +
 * audit rows. Each actor uses their own real account.
 */
import { api, auditRows, demoToken, ok, state, uniq } from './harness';

const T = () => state().demoTenantId;

describe('Workflow: patient registration → OPD → consultation → billing → payment', () => {
  let patientId: string;
  let encounterId: string;
  let billId: string;
  const patientName = uniq('OPD Patient');

  it('reception registers the patient (MRN assigned)', async () => {
    const reception = await demoToken('reception');
    const p = await ok(reception, T(), 'POST', '/patients', {
      fullName: patientName,
      sex: 'FEMALE',
      dob: '1990-01-15',
      phone: '9000000001',
    });
    patientId = p.id;
    expect(p.mrn).toBeTruthy();
  });

  it('reception creates a walk-in encounter assigned to the doctor', async () => {
    const reception = await demoToken('reception');
    const doctorMe = await ok(await demoToken('doctor'), null, 'GET', '/auth/me');
    const providerId = doctorMe.tenants.find((t: any) => t.tenantId === T())!.providerId;
    expect(providerId).toBeTruthy();

    const enc = await ok(reception, T(), 'POST', '/encounters', {
      patientId,
      providerId,
      chiefComplaint: 'E2E: fever and headache',
    });
    encounterId = enc.id;
    expect(enc.status).toBe('CHECKED_IN');
    expect(enc.tokenNumber).toBeTruthy();
  });

  it('doctor sees the patient in the queue and completes the consultation', async () => {
    const doctor = await demoToken('doctor');
    const queue = await ok(doctor, T(), 'GET', '/encounters/queue');
    const inQueue = JSON.stringify(queue).includes(encounterId);
    expect(inQueue).toBe(true);

    await ok(doctor, T(), 'POST', `/encounters/${encounterId}/start`);
    await ok(doctor, T(), 'POST', `/encounters/${encounterId}/vitals`, {
      systolicBp: 120,
      diastolicBp: 80,
      pulse: 76,
      temperature: 38.2,
    });
    await ok(doctor, T(), 'POST', `/encounters/${encounterId}/diagnoses`, {
      description: 'E2E viral fever',
    });
    const done = await ok(doctor, T(), 'POST', `/encounters/${encounterId}/complete`, {});
    expect(done.status).toBe('COMPLETED');
  });

  it('billing creates the consultation bill and collects full payment → PAID', async () => {
    const billing = await demoToken('billing');
    const catalog = await ok<any[]>(billing, T(), 'GET', '/billing/catalog');
    const consult = catalog.find((c) => c.type === 'CONSULTATION') ?? catalog[0];
    expect(consult).toBeDefined();

    const bill = await ok(billing, T(), 'POST', '/billing/bills', {
      patientId,
      encounterId,
      items: [
        {
          catalogId: consult.id,
          name: consult.name,
          quantity: 1,
          unitPrice: consult.price,
          sourceType: 'CONSULTATION',
        },
      ],
    });
    billId = bill.id;
    expect(bill.status).toBe('UNPAID');

    const paid = await ok(billing, T(), 'POST', `/billing/bills/${billId}/payments`, {
      amount: bill.netAmount,
      method: 'CASH',
    });
    const finalBill = paid.bill ?? paid;
    expect(finalBill.status ?? paid.status).toBe('PAID');
  });

  it('patient timeline shows the encounter and the bill', async () => {
    const reception = await demoToken('reception');
    const timeline = await ok(reception, T(), 'GET', `/patients/${patientId}/timeline`);
    const flat = JSON.stringify(timeline);
    expect(flat).toContain(encounterId);
    expect(flat).toContain(billId);
  });

  it('audit rows exist for every step', async () => {
    const admin = await demoToken('admin');
    for (const [action, entityId] of [
      ['patient.create', patientId],
      ['encounter.complete', encounterId],
      ['bill.create', billId],
      ['payment.collect', null],
    ] as const) {
      const rows = await auditRows(admin, T(), action);
      const hit = rows.some((r) => (entityId ? r.entityId === entityId : JSON.stringify(r).includes(billId)));
      expect({ action, hit }).toEqual({ action, hit: true });
    }
  });

  it('invoice is retrievable', async () => {
    const billing = await demoToken('billing');
    const invoice = await api(billing, T(), 'GET', `/billing/bills/${billId}/invoice`);
    expect(invoice.status).toBe(200);
  });
});
