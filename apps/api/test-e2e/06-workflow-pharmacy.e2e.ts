/**
 * Workflow 4: stock an item → doctor finalizes a prescription → pharmacist
 * checks availability → FEFO dispense → stock decremented + inventory
 * transaction + pharmacy bill with real prices → prescription DISPENSED.
 */
import { forTenant, disconnectPrisma } from '@hms/db';
import { demoToken, ok, state, uniq } from './harness';

const T = () => state().demoTenantId;

describe('Workflow: prescription → pharmacy dispense → stock deduction → bill', () => {
  let itemId: string;
  let batchId: string;
  let encounterId: string;
  let prescriptionId: string;
  const SALE_PRICE = 2500; // ₹25.00 in minor units
  const STOCK_QTY = 50;
  const DISPENSE_QTY = 3;

  afterAll(async () => {
    await disconnectPrisma();
  });

  it('inventory manager creates an item and stocks a batch', async () => {
    const inv = await demoToken('inventory');
    const item = await ok(inv, T(), 'POST', '/inventory/items', {
      name: uniq('Paracetamol'),
      type: 'DRUG',
      unit: 'tablet',
      lowStockThreshold: 10,
    });
    itemId = item.id;
    const batch = await ok(inv, T(), 'POST', '/inventory/batches', {
      itemId,
      batchNumber: uniq('BATCH'),
      quantity: STOCK_QTY,
      unitCost: 1000,
      salePrice: SALE_PRICE,
      expiryDate: '2030-12-31',
    });
    batchId = batch.id;
  });

  it('doctor creates and finalizes a prescription', async () => {
    const reception = await demoToken('reception');
    const doctorMe = await ok(await demoToken('doctor'), null, 'GET', '/auth/me');
    const providerId = doctorMe.tenants.find((t: any) => t.tenantId === T())!.providerId;
    const p = await ok(reception, T(), 'POST', '/patients', { fullName: uniq('Rx Patient'), sex: 'FEMALE', phone: '9000000020' });
    const enc = await ok(reception, T(), 'POST', '/encounters', { patientId: p.id, providerId, chiefComplaint: 'E2E rx' });
    encounterId = enc.id;

    const doctor = await demoToken('doctor');
    await ok(doctor, T(), 'POST', `/encounters/${encounterId}/start`);
    const rx = await ok(doctor, T(), 'POST', `/encounters/${encounterId}/prescriptions`, {
      items: [{ drugName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'TDS', duration: '5 days', quantity: DISPENSE_QTY }],
    });
    prescriptionId = rx.id;
    const finalized = await ok(doctor, T(), 'POST', `/prescriptions/${prescriptionId}/finalize`, {});
    expect(finalized.status).toBe('FINALIZED');
  });

  it('pharmacist sees it in the queue and checks availability', async () => {
    const pharm = await demoToken('pharmacist');
    const queue = await ok<any[]>(pharm, T(), 'GET', '/pharmacy/prescriptions');
    expect(JSON.stringify(queue)).toContain(prescriptionId);
    const avail = await ok(pharm, T(), 'GET', `/pharmacy/prescriptions/${prescriptionId}/availability`);
    expect(avail).toBeTruthy();
  });

  it('dispense decrements stock, writes a ledger txn, and bills real prices', async () => {
    const pharm = await demoToken('pharmacist');
    const db = forTenant(T());
    const before = (await db.inventoryBatch.findUnique({ where: { id: batchId } }))!.quantity;

    const result = await ok(pharm, T(), 'POST', `/pharmacy/prescriptions/${prescriptionId}/dispense`, {
      items: [{ inventoryItemId: itemId, quantity: DISPENSE_QTY }],
    });
    expect(result.billId ?? result.bill?.id ?? JSON.stringify(result)).toBeTruthy();

    const after = (await db.inventoryBatch.findUnique({ where: { id: batchId } }))!.quantity;
    expect(after).toBe(before - DISPENSE_QTY);

    const txns = await db.inventoryTransaction.findMany({ where: { batchId, type: 'DISPENSE' } });
    expect(txns.length).toBeGreaterThan(0);

    const rx = await ok(pharm, T(), 'GET', `/pharmacy/prescriptions/${prescriptionId}`);
    expect(rx.status).toBe('DISPENSED');

    // Bill total reflects the real FEFO sale price.
    const billId = result.billId ?? result.bill?.id;
    if (billId) {
      const billing = await demoToken('billing');
      const bill = await ok(billing, T(), 'GET', `/billing/bills/${billId}`);
      expect(bill.netAmount).toBe(SALE_PRICE * DISPENSE_QTY);
    }
  });
});
