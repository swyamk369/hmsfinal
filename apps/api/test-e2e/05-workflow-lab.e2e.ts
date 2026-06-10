/**
 * Workflow 3: doctor consultation → lab order → sample → processing → result →
 * verify → report retrievable. Lifecycle transitions are enforced by the API.
 */
import { api, demoToken, ok, state, uniq } from './harness';

const T = () => state().demoTenantId;

describe('Workflow: lab order → sample → result → verified report', () => {
  let patientId: string;
  let encounterId: string;
  let orderId: string;
  let orderItemId: string;
  let resultId: string;

  beforeAll(async () => {
    const reception = await demoToken('reception');
    const doctorMe = await ok(await demoToken('doctor'), null, 'GET', '/auth/me');
    const providerId = doctorMe.tenants.find((t: any) => t.tenantId === T())!.providerId;
    const p = await ok(reception, T(), 'POST', '/patients', { fullName: uniq('Lab Patient'), sex: 'MALE', phone: '9000000010' });
    patientId = p.id;
    const enc = await ok(reception, T(), 'POST', '/encounters', { patientId, providerId, chiefComplaint: 'E2E lab work' });
    encounterId = enc.id;
    const doctor = await demoToken('doctor');
    await ok(doctor, T(), 'POST', `/encounters/${encounterId}/start`);
  });

  it('doctor orders a lab test from the catalog', async () => {
    const doctor = await demoToken('doctor');
    const catalog = await ok<any[]>(doctor, T(), 'GET', '/lab/catalog');
    expect(catalog.length).toBeGreaterThan(0);
    const test = catalog[0];
    const order = await ok(doctor, T(), 'POST', `/encounters/${encounterId}/lab-orders`, {
      patientId,
      tests: [{ testId: test.id, testName: test.name }],
    });
    orderId = order.id;
    orderItemId = order.items[0].id;
    expect(order.status).toBe('ORDERED');
  });

  it('lab tech collects the sample, then moves to processing', async () => {
    const lab = await demoToken('labtech');
    await ok(lab, T(), 'POST', `/lab/orders/${orderId}/sample`, { labOrderItemId: orderItemId, barcode: uniq('BC') });
    const after = await ok(lab, T(), 'GET', `/lab/orders/${orderId}`);
    expect(after.status).toBe('SAMPLE_COLLECTED');
    await ok(lab, T(), 'PATCH', `/lab/orders/${orderId}/status`, { status: 'PROCESSING' });
  });

  it('cannot skip straight to COMPLETED (lifecycle enforced)', async () => {
    const lab = await demoToken('labtech');
    // fresh order to prove ORDERED → COMPLETED is rejected
    const doctor = await demoToken('doctor');
    const catalog = await ok<any[]>(doctor, T(), 'GET', '/lab/catalog');
    const o2 = await ok(doctor, T(), 'POST', `/encounters/${encounterId}/lab-orders`, {
      patientId,
      tests: [{ testId: catalog[0].id, testName: catalog[0].name }],
    });
    const res = await api(lab, T(), 'PATCH', `/lab/orders/${o2.id}/status`, { status: 'COMPLETED' });
    expect(res.status).toBe(400);
  });

  it('lab tech enters a result with reference range and abnormal flag', async () => {
    const lab = await demoToken('labtech');
    const entered = await ok(lab, T(), 'POST', `/lab/orders/${orderId}/results`, {
      results: [
        {
          labOrderItemId: orderItemId,
          value: '14.2',
          unit: 'g/dL',
          referenceRange: '13-17',
          abnormalFlag: 'NORMAL',
        },
      ],
    });
    const flat = JSON.stringify(entered);
    expect(flat).toContain('14.2');
    const detail = await ok(lab, T(), 'GET', `/lab/orders/${orderId}`);
    resultId = detail.items.find((i: any) => i.id === orderItemId)?.results?.[0]?.id;
    expect(resultId).toBeTruthy();
  });

  it('lab tech verifies the result and the report is retrievable', async () => {
    const lab = await demoToken('labtech');
    await ok(lab, T(), 'POST', `/lab/results/${resultId}/verify`, {});
    const report = await api(lab, T(), 'GET', `/lab/reports/${orderId}`);
    expect(report.status).toBe(200);
  });

  it('doctor sees the verified result on the lab order (lab.read)', async () => {
    const doctor = await demoToken('doctor');
    const order = await ok(doctor, T(), 'GET', `/lab/orders/${orderId}`);
    expect(JSON.stringify(order)).toContain('14.2');
  });
});
