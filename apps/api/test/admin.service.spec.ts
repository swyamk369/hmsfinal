import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@hms/db';
import { AdminService } from '../src/admin/admin.service';
import { AuditService } from '../src/common/audit.service';
import { emptyContext, type RequestContext } from '../src/common/types';

function mockAudit() {
  return { log: jest.fn().mockResolvedValue(undefined), platformLog: jest.fn() };
}

// Minimal stub of the tenant-scoped Prisma client. Note: no `delete` methods are
// defined anywhere, so the "no hard delete" rule is provable by absence.
function mockDb(): Record<string, any> {
  return {
    facility: {
      create: jest.fn().mockResolvedValue({ id: 'f1', name: 'Main', active: true }),
      findFirst: jest.fn().mockResolvedValue({ id: 'f1', name: 'Main', active: true }),
      update: jest.fn().mockResolvedValue({ id: 'f1', active: false }),
    },
    serviceCatalog: {
      create: jest.fn().mockResolvedValue({ id: 'c1', code: 'C', price: 1000 }),
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({ id: 'c1' }),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't1',
        name: 'Demo',
        slug: 'demo',
        tier: 'ENTERPRISE',
        status: 'ACTIVE',
        contactEmail: 'a@b.com',
        contactPhone: null,
        address: null,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    hospitalSettings: {
      findUnique: jest.fn().mockResolvedValue({
        tenantId: 't1',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        invoicePrefix: 'INV',
        mrnPrefix: 'MRN',
      }),
      upsert: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
    },
  };
}

function ctxWith(db: Record<string, any>): RequestContext {
  return {
    ...emptyContext(),
    userId: 'u1',
    tenantId: 't1',
    db: db as any,
    modules: new Set(['ADMIN']),
  };
}

describe('AdminService — audit coverage & tenant scoping', () => {
  it('creates a facility scoped to the tenant and writes an audit row', async () => {
    const db = mockDb();
    const audit = mockAudit();
    const svc = new AdminService(audit as unknown as AuditService);

    await svc.createFacility(ctxWith(db), { name: 'Main' });

    expect(db.facility.create).toHaveBeenCalledTimes(1);
    expect(db.facility.create.mock.calls[0][0].data).toMatchObject({ tenantId: 't1', name: 'Main' });
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log.mock.calls[0][1]).toMatchObject({
      action: 'facility.create',
      entity: 'facility',
      tenantId: 't1',
      actorId: 'u1',
    });
  });

  it('deactivates instead of hard-deleting (no delete call) and audits it', async () => {
    const db = mockDb();
    const audit = mockAudit();
    const svc = new AdminService(audit as unknown as AuditService);

    await svc.updateFacility(ctxWith(db), 'f1', { active: false });

    expect(db.facility.update).toHaveBeenCalledTimes(1);
    expect(db.facility.delete).toBeUndefined(); // never references a hard delete
    expect(audit.log.mock.calls.at(-1)![1]).toMatchObject({ action: 'facility.deactivate', entity: 'facility' });
  });

  it('updates the hospital profile and audits settings.update', async () => {
    const db = mockDb();
    const audit = mockAudit();
    const svc = new AdminService(audit as unknown as AuditService);

    await svc.updateProfile(ctxWith(db), { name: 'New Name', currency: 'USD' });

    expect(db.tenant.update).toHaveBeenCalledTimes(1);
    expect(db.hospitalSettings.upsert).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'settings.update' }));
  });

  it('rejects a write with no tenant context (platform user without X-Tenant-Id)', async () => {
    const audit = mockAudit();
    const svc = new AdminService(audit as unknown as AuditService);
    const noTenantCtx: RequestContext = { ...emptyContext(), userId: 'p1', isPlatform: true };

    await expect(svc.createFacility(noTenantCtx, { name: 'X' })).rejects.toBeInstanceOf(BadRequestException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('maps a duplicate code (P2002) to 409 and does not audit', async () => {
    const db = mockDb();
    db.serviceCatalog.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '6.3.1' }),
    );
    const audit = mockAudit();
    const svc = new AdminService(audit as unknown as AuditService);

    await expect(
      svc.createCatalogItem(ctxWith(db), { code: 'C', name: 'N', type: 'CONSULTATION', price: 1000 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
