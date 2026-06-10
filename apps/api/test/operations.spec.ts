import { MODULES, PERMISSIONS, ROLES } from '@hms/db';
import { OperationsController } from '../src/operations/operations.controller';
import { OperationsService } from '../src/operations/operations.service';
import { PERMISSION_KEY } from '../src/common/decorators';
import { emptyContext, type RequestContext } from '../src/common/types';

function model() {
  return {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
  };
}

function db(): Record<string, any> {
  return {
    department: model(),
    serviceCatalog: model(),
    tenantUser: model(),
    provider: model(),
    encounter: model(),
    appointment: model(),
    labOrder: model(),
    labResult: model(),
    prescription: model(),
    dispenseRecord: model(),
    inventoryItem: model(),
    inventoryBatch: model(),
    purchaseOrder: model(),
    admission: model(),
    medicationAdministration: model(),
    bill: model(),
    billableCharge: model(),
    financeApproval: model(),
    financeDayClose: model(),
    insuranceClaim: model(),
    notification: model(),
    auditLog: model(),
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
    roles: [ROLES.HOSPITAL_MANAGER],
    permissions: new Set<string>([PERMISSIONS.QUEUE_READ, PERMISSIONS.ENCOUNTER_READ, PERMISSIONS.PATIENT_READ]),
    modules: new Set<string>([MODULES.OPD]),
    db: d as any,
    ...overrides,
  };
}

describe('OperationsController', () => {
  it('declares broad operational permission gates', () => {
    const perms = Reflect.getMetadata(PERMISSION_KEY, OperationsController.prototype.workQueue);
    expect(perms).toEqual(expect.arrayContaining([PERMISSIONS.PATIENT_READ, PERMISSIONS.BILL_READ, PERMISSIONS.REPORTS_READ]));
  });
});

describe('OperationsService', () => {
  let svc: OperationsService;
  let d: Record<string, any>;

  beforeEach(() => {
    svc = new OperationsService();
    d = db();
  });

  it('does not query disabled module tables even when the user has that permission', async () => {
    const out = await svc.workQueue(
      ctx(
        {
          permissions: new Set([PERMISSIONS.LAB_READ]),
          modules: new Set([MODULES.OPD]),
        },
        d,
      ),
    );

    expect(out.items).toEqual([]);
    expect(d.labOrder.findMany).not.toHaveBeenCalled();
    expect(d.labResult.findMany).not.toHaveBeenCalled();
  });

  it('creates actionable OPD work items from checked-in encounters', async () => {
    d.encounter.findMany.mockResolvedValue([
      {
        id: 'e1',
        status: 'CHECKED_IN',
        tokenNumber: 7,
        chiefComplaint: 'Fever',
        createdAt: new Date(Date.now() - 50 * 60000),
        patient: { id: 'p1', fullName: 'Jane Doe', mrn: 'MRN-1' },
      },
    ]);

    const out = await svc.workQueue(ctx({}, d));

    expect(out.items[0]).toMatchObject({
      id: 'opd-e1',
      type: 'OPD_QUEUE',
      patientId: 'p1',
      module: MODULES.OPD,
      priority: 'HIGH',
      actionHref: '/opd',
    });
  });

  it('returns blockers for low inventory and sorts urgent items first', async () => {
    d.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item1',
        name: 'Saline',
        unit: 'bag',
        lowStockThreshold: 5,
        createdAt: new Date('2026-06-10T00:00:00.000Z'),
        batches: [{ quantity: 0 }],
      },
    ]);

    const out = await svc.blockers(
      ctx(
        {
          permissions: new Set([PERMISSIONS.INVENTORY_READ]),
          modules: new Set([MODULES.INVENTORY]),
        },
        d,
      ),
    );

    expect(out.items[0]).toMatchObject({
      type: 'LOW_STOCK',
      priority: 'CRITICAL',
      blocker: 'Available quantity is at or below reorder level.',
    });
  });

  it('maps recent activity from tenant audit logs', async () => {
    d.auditLog.findMany.mockResolvedValue([
      {
        id: 'a1',
        action: 'patient.update',
        entity: 'patient',
        entityId: 'p1',
        metadata: { patientId: 'p1' },
        actorId: 'u1',
        createdAt: new Date('2026-06-10T01:00:00.000Z'),
      },
    ]);

    const out = await svc.recentActivity(ctx({}, d));

    expect(out.items[0]).toMatchObject({
      id: 'a1',
      title: 'patient update',
      subtitle: 'patient',
      entityId: 'p1',
    });
  });

  it('adds finance blockers for pending charges, approvals, and open day close', async () => {
    d.billableCharge.findMany.mockResolvedValue([
      {
        id: 'charge1',
        patientId: 'p1',
        sourceModule: 'LAB',
        sourceId: 'lab1',
        name: 'CBC',
        quantity: 1,
        unitPrice: 30000,
        total: 30000,
        status: 'PENDING',
        createdAt: new Date('2026-06-10T01:00:00.000Z'),
      },
    ]);
    d.financeApproval.findMany.mockResolvedValue([
      {
        id: 'approval1',
        type: 'REFUND',
        amount: 50000,
        reason: 'High value refund',
        status: 'PENDING',
        requestedAt: new Date('2026-06-10T01:05:00.000Z'),
      },
    ]);
    d.financeDayClose.findFirst.mockResolvedValue(null);

    const out = await svc.workQueue(
      ctx(
        {
          permissions: new Set([
            PERMISSIONS.FINANCE_READ,
            PERMISSIONS.FINANCE_APPROVAL_MANAGE,
            PERMISSIONS.FINANCE_DAY_CLOSE,
          ]),
          modules: new Set([MODULES.BILLING]),
        },
        d,
      ),
    );

    expect(out.items.map((item) => item.type)).toEqual(
      expect.arrayContaining(['PENDING_CHARGE', 'FINANCE_APPROVAL', 'DAY_CLOSE_OPEN']),
    );
    expect(out.items.find((item) => item.type === 'PENDING_CHARGE')?.actionHref).toBe('/finance/pending-charges');
  });
});
