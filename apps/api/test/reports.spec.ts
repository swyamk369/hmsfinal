import { ForbiddenException } from '@nestjs/common';
import { MODULES, PERMISSIONS } from '@hms/db';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';
import { MODULE_KEY, PERMISSION_KEY } from '../src/common/decorators';
import { ModuleGuard } from '../src/common/guards/module.guard';
import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  };
}

function db(): Record<string, any> {
  return {
    facility: model(),
    department: model(),
    tenantUser: model(),
    patient: model(),
    serviceCatalog: model(),
    appointment: model(),
    encounter: model(),
    bill: model(),
    payment: model(),
    refund: model(),
    labOrder: model(),
    labResult: model(),
    prescription: model(),
    dispenseRecord: model(),
    inventoryItem: model(),
    inventoryBatch: model(),
    inventoryTransaction: model(),
    purchaseOrder: model(),
    supplier: model(),
    bed: model(),
    admission: model(),
    vitals: model(),
    medicationAdministration: model(),
    nursingNote: model(),
    insuranceClaim: model(),
    diagnosis: model(),
    ipdRound: model(),
    dischargeSummary: model(),
  };
}

function ctx(overrides: Partial<RequestContext> = {}, d = db()): RequestContext {
  return {
    ...emptyContext(),
    userId: 'u1',
    tenantId: 't1',
    tenantStatus: 'ACTIVE',
    membershipExists: true,
    membershipActive: true,
    roles: ['HOSPITAL_MANAGER'],
    permissions: new Set<string>([
      PERMISSIONS.REPORTS_READ,
      PERMISSIONS.REPORTS_OPERATIONAL_READ,
      PERMISSIONS.REPORTS_FINANCIAL_READ,
      PERMISSIONS.REPORTS_INVENTORY_READ,
      PERMISSIONS.REPORTS_CLINICAL_READ,
      PERMISSIONS.PATIENT_READ,
      PERMISSIONS.QUEUE_READ,
      PERMISSIONS.APPOINTMENT_READ,
      PERMISSIONS.BILL_READ,
      PERMISSIONS.LAB_READ,
      PERMISSIONS.PHARMACY_READ,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_REPORTS_READ,
      PERMISSIONS.IPD_READ,
      PERMISSIONS.NURSING_READ,
      PERMISSIONS.INSURANCE_READ,
      PERMISSIONS.ENCOUNTER_READ,
    ]),
    modules: new Set<string>([
      MODULES.PATIENT,
      MODULES.OPD,
      MODULES.SCHEDULING,
      MODULES.BILLING,
      MODULES.LAB,
      MODULES.PHARMACY,
      MODULES.INVENTORY,
      MODULES.IPD,
      MODULES.INSURANCE,
      MODULES.REPORTS,
    ]),
    db: d as any,
    ...overrides,
  };
}

function execFor(context: Partial<RequestContext>): any {
  const full = { ...emptyContext(), ...context };
  return {
    switchToHttp: () => ({ getRequest: () => ({ ctx: full }) }),
    getHandler: () => function handler() {},
    getClass: () => class Cls {},
  };
}

function reflector(value: unknown): any {
  return { getAllAndOverride: () => value };
}

describe('Reports guards and metadata', () => {
  it('detailed report endpoints require the REPORTS module', () => {
    expect(Reflect.getMetadata(MODULE_KEY, ReportsController.prototype.manager)).toBe(MODULES.REPORTS);
    expect(Reflect.getMetadata(MODULE_KEY, ReportsController.prototype.operations)).toBe(MODULES.REPORTS);
    expect(Reflect.getMetadata(MODULE_KEY, ReportsController.prototype.financial)).toBe(MODULES.REPORTS);
    expect(Reflect.getMetadata(MODULE_KEY, ReportsController.prototype.inventory)).toBe(MODULES.REPORTS);
    expect(Reflect.getMetadata(MODULE_KEY, ReportsController.prototype.clinical)).toBe(MODULES.REPORTS);
    expect(Reflect.getMetadata(MODULE_KEY, ReportsController.prototype.dashboard)).toBeUndefined();
  });

  it('report endpoints declare permission gates', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, ReportsController.prototype.operations)).toContain(PERMISSIONS.REPORTS_OPERATIONAL_READ);
    expect(Reflect.getMetadata(PERMISSION_KEY, ReportsController.prototype.financial)).toContain(PERMISSIONS.REPORTS_FINANCIAL_READ);
    expect(Reflect.getMetadata(PERMISSION_KEY, ReportsController.prototype.inventory)).toContain(PERMISSIONS.REPORTS_INVENTORY_READ);
    expect(Reflect.getMetadata(PERMISSION_KEY, ReportsController.prototype.clinical)).toContain(PERMISSIONS.REPORTS_CLINICAL_READ);
  });

  it('REPORTS disabled tenant returns 403 through the module guard', () => {
    const guard = new ModuleGuard(reflector(MODULES.REPORTS));
    expect(() => guard.canActivate(execFor({ tenantId: 't1', modules: new Set([MODULES.OPD]) }))).toThrow(ForbiddenException);
  });

  it('missing report permission returns 403 through the permission guard', () => {
    const guard = new PermissionsGuard(reflector([PERMISSIONS.REPORTS_OPERATIONAL_READ]));
    expect(() => guard.canActivate(execFor({ userId: 'u1', permissions: new Set([PERMISSIONS.PATIENT_READ]) }))).toThrow(ForbiddenException);
  });
});

describe('Reports service', () => {
  let svc: ReportsService;
  let d: Record<string, any>;

  beforeEach(() => {
    svc = new ReportsService();
    d = db();
  });

  it('dashboard excludes disabled modules instead of querying their tables', async () => {
    d.patient.count.mockResolvedValue(4);
    const out = await svc.dashboard(
      ctx(
        {
          modules: new Set([MODULES.PATIENT, MODULES.OPD, MODULES.BILLING]),
          permissions: new Set([PERMISSIONS.PATIENT_READ, PERMISSIONS.QUEUE_READ, PERMISSIONS.APPOINTMENT_READ, PERMISSIONS.BILL_READ]),
        },
        d,
      ),
    );

    expect(out.lab).toBeNull();
    expect(out.inventory).toBeNull();
    expect(d.labOrder.findMany).not.toHaveBeenCalled();
    expect(d.inventoryItem.findMany).not.toHaveBeenCalled();
  });

  it('operations report aggregates live workflow rows in the requested range', async () => {
    const now = new Date('2026-06-10T09:00:00.000Z');
    d.patient.findMany.mockResolvedValue([{ id: 'p1', createdAt: now }]);
    d.appointment.findMany.mockResolvedValue([{ id: 'a1', status: 'SCHEDULED', scheduledAt: now }]);
    d.encounter.findMany.mockResolvedValue([{ id: 'e1', type: 'OPD', status: 'COMPLETED', createdAt: now, endedAt: now }]);
    d.labOrder.findMany.mockResolvedValue([{ id: 'l1', status: 'ORDERED', createdAt: now }]);
    d.dispenseRecord.findMany.mockResolvedValue([{ id: 'dr1', status: 'DISPENSED', createdAt: now }]);
    d.admission.findMany.mockResolvedValue([{ id: 'adm1', status: 'DISCHARGED', admittedAt: now, dischargedAt: now }]);

    const out = await svc.operations(ctx({}, d), { startDate: '2026-06-01', endDate: '2026-06-30' });

    expect(out.totals).toMatchObject({ registrations: 1, appointments: 1, encounters: 1, consultationsCompleted: 1, labOrders: 1, dispenses: 1, admissions: 1, discharges: 1 });
    expect(out.encounterStatus.COMPLETED).toBe(1);
    expect(out.rows.map((row) => row.type)).toEqual(expect.arrayContaining(['Appointment', 'Encounter', 'Lab order', 'Pharmacy dispense']));
  });

  it('financial report includes billing and insurance receivables when modules permit it', async () => {
    const now = new Date('2026-06-10T10:00:00.000Z');
    d.bill.findMany.mockResolvedValue([
      { id: 'b1', billNumber: 'INV-1', netAmount: 10000, status: 'PARTIAL', createdAt: now, payments: [{ amount: 4000 }], refunds: [{ amount: 1000 }], patient: { fullName: 'Jane', mrn: 'MRN-1' } },
    ]);
    d.payment.findMany.mockResolvedValue([{ id: 'pay1', amount: 4000, method: 'CASH', createdAt: now }]);
    d.refund.findMany.mockResolvedValue([{ id: 'ref1', amount: 1000, createdAt: now }]);
    d.insuranceClaim.findMany.mockResolvedValue([
      {
        id: 'claim1',
        claimAmount: 7000,
        approvedAmount: 6500,
        patientShare: 3500,
        status: 'APPROVED',
        createdAt: now,
        settlements: [{ amount: 3000 }],
        bill: { billNumber: 'INV-1', patient: { fullName: 'Jane', mrn: 'MRN-1' } },
      },
    ]);

    const out = await svc.financial(ctx({}, d), {});

    expect(out.totals).toMatchObject({
      totalBilled: 10000,
      totalCollected: 4000,
      refunds: 1000,
      outstandingReceivables: 7000,
      insuranceClaimed: 7000,
      insuranceApproved: 6500,
      insuranceSettled: 3000,
    });
    expect(out.paymentMethod.CASH).toBe(1);
    expect(out.insuranceRows[0]).toMatchObject({ billNumber: 'INV-1', status: 'APPROVED', settled: 3000 });
  });

  it('inventory report requires the INVENTORY module', async () => {
    await expect(svc.inventory(ctx({ modules: new Set([MODULES.REPORTS]) }, d), {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('inventory report returns stock, expiry, procurement, and ledger rows', async () => {
    const now = new Date('2026-06-10T11:00:00.000Z');
    d.inventoryItem.findMany.mockResolvedValue([
      { id: 'item1', name: 'Paracetamol', lowStockThreshold: 10, active: true, batches: [{ quantity: 5, salePrice: 200 }] },
    ]);
    d.inventoryBatch.findMany.mockResolvedValue([{ id: 'batch1', itemId: 'item1', batchNumber: 'B1', quantity: 5, salePrice: 200, expiryDate: new Date('2026-06-20T00:00:00.000Z') }]);
    d.inventoryTransaction.findMany.mockResolvedValue([{ id: 'tx1', itemId: 'item1', type: 'STOCK_IN', quantity: 5, reason: 'GRN', createdAt: now }]);
    d.purchaseOrder.findMany.mockResolvedValue([{ id: 'po1', supplierId: 'sup1', status: 'ORDERED', createdAt: now, items: [{ quantity: 5, unitCost: 100 }], supplier: { name: 'Supplier' } }]);
    d.supplier.findMany.mockResolvedValue([{ id: 'sup1', name: 'Supplier', active: true }]);

    const out = await svc.inventory(ctx({}, d), {});

    expect(out.totals).toMatchObject({ itemCount: 1, stockValue: 1000, lowStock: 1, expiring: 1, pendingPurchases: 1 });
    expect(out.transactionType.STOCK_IN).toBe(1);
    expect(out.purchaseRows[0]).toMatchObject({ supplier: 'Supplier', value: 500 });
  });

  it('clinical report excludes lab and IPD rows when those modules are disabled', async () => {
    const now = new Date('2026-06-10T12:00:00.000Z');
    d.encounter.findMany.mockResolvedValue([{ id: 'e1', type: 'OPD', status: 'COMPLETED', createdAt: now, providerId: 'prov1' }]);
    d.diagnosis.findMany.mockResolvedValue([{ id: 'dx1', description: 'Flu', icdCode: 'J10', type: 'PRIMARY', createdAt: now }]);
    d.vitals.findMany.mockResolvedValue([{ id: 'v1', recordedAt: now }]);
    d.prescription.findMany.mockResolvedValue([{ id: 'rx1', status: 'FINALIZED', finalizedAt: now, createdAt: now }]);

    const out = await svc.clinical(
      ctx(
        {
          modules: new Set([MODULES.REPORTS, MODULES.OPD]),
          permissions: new Set([PERMISSIONS.REPORTS_CLINICAL_READ, PERMISSIONS.ENCOUNTER_READ]),
        },
        d,
      ),
      {},
    );

    expect(out.totals).toMatchObject({ consultationsCompleted: 1, vitalsRecorded: 1, prescriptionsFinalized: 1, labAbnormalResults: 0, ipdRounds: 0 });
    expect(d.labResult.findMany).not.toHaveBeenCalled();
    expect(d.ipdRound.findMany).not.toHaveBeenCalled();
  });
});
