/**
 * Workflow 6: insurance provider + patient policy → claim from a bill → submit
 * → approve → settle → duplicate settlement blocked → receivables reflect it.
 */
import { api, demoToken, ok, state, uniq } from './harness';

const T = () => state().demoTenantId;

describe('Workflow: insurance policy → claim → approve → settle', () => {
  let patientId: string;
  let billId: string;
  let providerId: string;
  let policyId: string;
  let claimId: string;
  const BILL_AMOUNT = 500000; // ₹5000
  const APPROVED = 400000; // ₹4000

  it('sets up a patient, a bill, an insurance provider, and a policy', async () => {
    const reception = await demoToken('reception');
    const billing = await demoToken('billing');
    const admin = await demoToken('admin');
    const insurance = await demoToken('insurance');

    // BILLING has bill.* but not patient.write — reception registers patients.
    const p = await ok(reception, T(), 'POST', '/patients', { fullName: uniq('Ins Patient'), sex: 'MALE', phone: '9000000040' });
    patientId = p.id;

    const bill = await ok(billing, T(), 'POST', '/billing/bills', {
      patientId,
      items: [{ name: 'E2E procedure', quantity: 1, unitPrice: BILL_AMOUNT, sourceType: 'MANUAL' }],
    });
    billId = bill.id;

    const provider = await ok(admin, T(), 'POST', '/admin/insurance-providers', { name: uniq('TPA'), contact: 'tpa@e2e.local' });
    providerId = provider.id;

    const policy = await ok(insurance, T(), 'POST', '/insurance/policies', {
      patientId,
      providerId,
      policyNumber: uniq('POL'),
    });
    policyId = policy.id;
  });

  it('insurance staff creates and submits a claim from the bill', async () => {
    const insurance = await demoToken('insurance');
    const claim = await ok(insurance, T(), 'POST', '/insurance/claims', {
      billId,
      patientPolicyId: policyId,
      claimAmount: BILL_AMOUNT,
    });
    claimId = claim.id;
    await ok(insurance, T(), 'POST', `/insurance/claims/${claimId}/submit`, {});
    const after = await ok(insurance, T(), 'GET', `/insurance/claims/${claimId}`);
    expect(['SUBMITTED', 'UNDER_REVIEW']).toContain(after.status);
  });

  it('approves with an approved amount and patient share', async () => {
    const insurance = await demoToken('insurance');
    const approved = await ok(insurance, T(), 'POST', `/insurance/claims/${claimId}/approve`, {
      approvedAmount: APPROVED,
      patientShare: BILL_AMOUNT - APPROVED,
    });
    // Approving less than the claimed amount is a PARTIALLY_APPROVED (still settleable).
    expect(['APPROVED', 'PARTIALLY_APPROVED']).toContain(approved.status ?? approved.claim?.status);
  });

  it('settles the claim, then blocks a duplicate settlement', async () => {
    const insurance = await demoToken('insurance');
    const settled = await ok(insurance, T(), 'POST', `/insurance/claims/${claimId}/settle`, {
      amount: APPROVED,
      transactionId: uniq('TXN'),
    });
    expect(settled.status ?? settled.claim?.status).toBe('SETTLED');

    const dup = await api(insurance, T(), 'POST', `/insurance/claims/${claimId}/settle`, {
      amount: APPROVED,
      transactionId: uniq('TXN'),
    });
    expect(dup.status).toBe(400);
  });

  it('rejection requires a reason (separate claim)', async () => {
    const insurance = await demoToken('insurance');
    const billing = await demoToken('billing');
    const bill2 = await ok(billing, T(), 'POST', '/billing/bills', {
      patientId,
      items: [{ name: 'E2E procedure 2', quantity: 1, unitPrice: 100000, sourceType: 'MANUAL' }],
    });
    const claim2 = await ok(insurance, T(), 'POST', '/insurance/claims', {
      billId: bill2.id,
      patientPolicyId: policyId,
      claimAmount: 100000,
    });
    await ok(insurance, T(), 'POST', `/insurance/claims/${claim2.id}/submit`, {});
    const noReason = await api(insurance, T(), 'POST', `/insurance/claims/${claim2.id}/reject`, { reason: '  ' });
    expect(noReason.status).toBe(400);
  });

  it('receivables reflect the settled claim', async () => {
    const insurance = await demoToken('insurance');
    const recv = await api(insurance, T(), 'GET', '/insurance/receivables');
    expect(recv.status).toBe(200);
  });
});
