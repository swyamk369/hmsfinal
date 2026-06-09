/**
 * Phase 8 — destructive-action wiring.
 *
 * The web harness is logic-only (no jsdom/RTL), so instead of rendering the
 * reason modals we assert the contract they depend on: every destructive API
 * wrapper threads the operator-supplied `reason` (and `amount` for refunds)
 * into the request body. If a wrapper ever stopped sending `reason`, a modal
 * could "succeed" while the server rejected it — this test prevents that.
 *
 * The server-side enforcement (400 when reason is empty, refund <= paid,
 * paid bills not casually cancelled) is covered in apps/api clinical.spec.ts.
 */
const calls: { fn: string; path: string; body: unknown; tenant: unknown }[] = [];

jest.mock('@/lib/api', () => ({
  apiGet: (path: string, tenant: unknown) => {
    calls.push({ fn: 'apiGet', path, body: undefined, tenant });
    return Promise.resolve({});
  },
  apiPost: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPost', path, body, tenant });
    return Promise.resolve({});
  },
  apiPatch: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiPatch', path, body, tenant });
    return Promise.resolve({});
  },
  apiDelete: (path: string, body: unknown, tenant: unknown) => {
    calls.push({ fn: 'apiDelete', path, body, tenant });
    return Promise.resolve({});
  },
}));

import { patientsApi } from '@/lib/patients';
import { billingApi } from '@/lib/billing';
import { opdApi } from '@/lib/opd';

const REASON = 'Operator-entered reason';
function lastCall() {
  return calls[calls.length - 1];
}
beforeEach(() => {
  calls.length = 0;
});

describe('Phase 8 destructive actions thread a reason', () => {
  it('archive patient sends reason in the body', async () => {
    await patientsApi.archive('t1', 'p1', REASON);
    const c = lastCall();
    expect(c.fn).toBe('apiDelete');
    expect(c.path).toBe('/patients/p1');
    expect(c.body).toEqual({ reason: REASON });
  });

  it('cancel appointment sends reason', async () => {
    await opdApi.cancelAppointment('t1', 'a1', REASON);
    expect(lastCall().path).toBe('/appointments/a1/cancel');
    expect(lastCall().body).toEqual({ reason: REASON });
  });

  it('reschedule appointment sends reason + scheduledAt', async () => {
    await opdApi.rescheduleAppointment('t1', 'a1', '2026-06-10T09:00:00.000Z', REASON);
    expect(lastCall().path).toBe('/appointments/a1/reschedule');
    expect(lastCall().body).toMatchObject({ reason: REASON, scheduledAt: '2026-06-10T09:00:00.000Z' });
  });

  it('cancel encounter sends reason', async () => {
    await opdApi.cancelEncounter('t1', 'e1', REASON);
    expect(lastCall().path).toBe('/encounters/e1/cancel');
    expect(lastCall().body).toEqual({ reason: REASON });
  });

  it('cancel bill sends reason', async () => {
    await billingApi.cancel('t1', 'b1', REASON);
    expect(lastCall().path).toBe('/billing/bills/b1/cancel');
    expect(lastCall().body).toEqual({ reason: REASON });
  });

  it('refund sends both amount and reason', async () => {
    await billingApi.refund('t1', 'b1', 50000, REASON);
    expect(lastCall().path).toBe('/billing/bills/b1/refunds');
    expect(lastCall().body).toEqual({ amount: 50000, reason: REASON });
  });

  it('every destructive call carries the active tenant scope', async () => {
    await patientsApi.archive('tenant-x', 'p1', REASON);
    expect(lastCall().tenant).toBe('tenant-x');
  });
});
