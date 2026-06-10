import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, MODULES } from '@hms/db';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import {
  AuditQueryDto,
  CreateBedDto,
  CreateCatalogItemDto,
  CreateDepartmentDto,
  CreateFacilityDto,
  CreateInsuranceProviderDto,
  CreateLabTestDto,
  CreateWardDto,
  UpdateBedDto,
  UpdateCatalogItemDto,
  UpdateDepartmentDto,
  UpdateFacilityDto,
  UpdateInsuranceProviderDto,
  UpdateLabTestDto,
  UpdateProfileDto,
  UpdateWardDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

/**
 * Hospital Admin workspace setup. Every method is tenant-scoped through the
 * RLS client (`ctx.db`); every write records an AuditLog row. Nothing is hard
 * deleted — deactivation flips an `active`/`status` flag.
 */
@Injectable()
export class AdminService {
  constructor(private readonly audit: AuditService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private async record(
    s: Scope,
    action: string,
    entity: string,
    entityId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.log(s.db, {
      tenantId: s.tenantId,
      actorId: s.actorId,
      action,
      entity,
      entityId,
      metadata,
    });
  }

  /** Maps Prisma unique-constraint violations to a friendly 409. */
  private async guard<T>(fn: () => Promise<T>, conflictMsg: string): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(conflictMsg);
      }
      throw e;
    }
  }

  // ── Hospital profile ──────────────────────────────────────────
  async getProfile(ctx: RequestContext) {
    const { db, tenantId } = this.scope(ctx);
    const [tenant, settings] = await Promise.all([
      db.tenant.findUnique({ where: { id: tenantId } }),
      db.hospitalSettings.findUnique({ where: { tenantId } }),
    ]);
    if (!tenant) throw new NotFoundException('Tenant not found');

    const s = settings ?? (await db.hospitalSettings.create({ data: { tenantId } }));

    return {
      name: tenant.name,
      slug: tenant.slug,
      tier: tenant.tier,
      status: tenant.status,
      contactEmail: tenant.contactEmail,
      contactPhone: tenant.contactPhone,
      address: tenant.address,
      timezone: s.timezone,
      currency: s.currency,
      invoicePrefix: s.invoicePrefix,
      mrnPrefix: s.mrnPrefix,
    };
  }

  async updateProfile(ctx: RequestContext, dto: UpdateProfileDto) {
    const s = this.scope(ctx);

    const tenantData: Prisma.TenantUpdateInput = {};
    if (dto.name !== undefined) tenantData.name = dto.name;
    if (dto.contactEmail !== undefined) tenantData.contactEmail = dto.contactEmail || null;
    if (dto.contactPhone !== undefined) tenantData.contactPhone = dto.contactPhone || null;
    if (dto.address !== undefined) tenantData.address = dto.address || null;
    if (Object.keys(tenantData).length) {
      // Tenant has no RLS, so we key strictly by the authenticated active tenant.
      await s.db.tenant.update({ where: { id: s.tenantId }, data: tenantData });
    }

    const settingsData: Prisma.HospitalSettingsUncheckedCreateInput = { tenantId: s.tenantId };
    const settingsUpdate: Prisma.HospitalSettingsUpdateInput = {};
    if (dto.timezone !== undefined) {
      settingsData.timezone = dto.timezone;
      settingsUpdate.timezone = dto.timezone;
    }
    if (dto.currency !== undefined) {
      settingsData.currency = dto.currency;
      settingsUpdate.currency = dto.currency;
    }
    if (dto.invoicePrefix !== undefined) {
      settingsData.invoicePrefix = dto.invoicePrefix;
      settingsUpdate.invoicePrefix = dto.invoicePrefix;
    }
    if (dto.mrnPrefix !== undefined) {
      settingsData.mrnPrefix = dto.mrnPrefix;
      settingsUpdate.mrnPrefix = dto.mrnPrefix;
    }
    await s.db.hospitalSettings.upsert({
      where: { tenantId: s.tenantId },
      update: settingsUpdate,
      create: settingsData,
    });

    await this.record(s, 'settings.update', 'hospital_settings', s.tenantId, {
      fields: Object.keys({ ...tenantData, ...settingsUpdate }),
    });
    return this.getProfile(ctx);
  }

  // ── Facilities ────────────────────────────────────────────────
  listFacilities(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.facility.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createFacility(ctx: RequestContext, dto: CreateFacilityDto) {
    const s = this.scope(ctx);
    const facility = await s.db.facility.create({
      data: { tenantId: s.tenantId, name: dto.name, address: dto.address, phone: dto.phone },
    });
    await this.record(s, 'facility.create', 'facility', facility.id, { name: facility.name });
    return facility;
  }

  async updateFacility(ctx: RequestContext, id: string, dto: UpdateFacilityDto) {
    const s = this.scope(ctx);
    const existing = await s.db.facility.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Facility not found');
    const facility = await s.db.facility.update({
      where: { id },
      data: { name: dto.name, address: dto.address, phone: dto.phone, active: dto.active },
    });
    await this.record(s, dto.active === false ? 'facility.deactivate' : 'facility.update', 'facility', id, {
      changes: dto,
    });
    return facility;
  }

  // ── Departments ───────────────────────────────────────────────
  listDepartments(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.department.findMany({
      orderBy: { createdAt: 'asc' },
      include: { facility: { select: { id: true, name: true } } },
    });
  }

  private async assertFacility(s: Scope, facilityId?: string) {
    if (!facilityId) return;
    const f = await s.db.facility.findFirst({ where: { id: facilityId } });
    if (!f) throw new BadRequestException('Facility not found in this hospital');
  }

  async createDepartment(ctx: RequestContext, dto: CreateDepartmentDto) {
    const s = this.scope(ctx);
    await this.assertFacility(s, dto.facilityId);
    const dept = await s.db.department.create({
      data: { tenantId: s.tenantId, name: dto.name, facilityId: dto.facilityId, type: dto.type },
    });
    await this.record(s, 'department.create', 'department', dept.id, { name: dept.name });
    return dept;
  }

  async updateDepartment(ctx: RequestContext, id: string, dto: UpdateDepartmentDto) {
    const s = this.scope(ctx);
    const existing = await s.db.department.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Department not found');
    await this.assertFacility(s, dto.facilityId);
    const dept = await s.db.department.update({
      where: { id },
      data: { name: dto.name, facilityId: dto.facilityId, type: dto.type, active: dto.active },
    });
    await this.record(s, dto.active === false ? 'department.deactivate' : 'department.update', 'department', id, {
      changes: dto,
    });
    return dept;
  }

  // ── Service catalog ───────────────────────────────────────────
  listCatalog(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.serviceCatalog.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createCatalogItem(ctx: RequestContext, dto: CreateCatalogItemDto) {
    const s = this.scope(ctx);
    const item = await this.guard(
      () =>
        s.db.serviceCatalog.create({
          data: {
            tenantId: s.tenantId,
            code: dto.code,
            name: dto.name,
            type: dto.type,
            price: dto.price,
            taxRate: dto.taxRate ?? 0,
          },
        }),
      `A catalog item with code "${dto.code}" already exists.`,
    );
    await this.record(s, 'catalog.create', 'service_catalog', item.id, { code: item.code, price: item.price });
    return item;
  }

  async updateCatalogItem(ctx: RequestContext, id: string, dto: UpdateCatalogItemDto) {
    const s = this.scope(ctx);
    const existing = await s.db.serviceCatalog.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Catalog item not found');
    const item = await s.db.serviceCatalog.update({
      where: { id },
      data: { name: dto.name, type: dto.type, price: dto.price, taxRate: dto.taxRate, active: dto.active },
    });
    await this.record(s, dto.active === false ? 'catalog.deactivate' : 'catalog.update', 'service_catalog', id, {
      changes: dto,
    });
    return item;
  }

  // ── Wards ─────────────────────────────────────────────────────
  listWards(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.ward.findMany({
      orderBy: { createdAt: 'asc' },
      include: { beds: { orderBy: { bedNumber: 'asc' } } },
    });
  }

  async createWard(ctx: RequestContext, dto: CreateWardDto) {
    const s = this.scope(ctx);
    const ward = await s.db.ward.create({
      data: { tenantId: s.tenantId, name: dto.name, type: (dto.type ?? 'GENERAL') as any, dailyRate: dto.dailyRate ?? 0 },
    });
    await this.record(s, 'ward.create', 'ward', ward.id, { name: ward.name, type: ward.type });
    return ward;
  }

  async updateWard(ctx: RequestContext, id: string, dto: UpdateWardDto) {
    const s = this.scope(ctx);
    const existing = await s.db.ward.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Ward not found');
    const ward = await s.db.ward.update({
      where: { id },
      data: { name: dto.name, type: dto.type as any, active: dto.active, dailyRate: dto.dailyRate },
    });
    await this.record(s, dto.active === false ? 'ward.deactivate' : 'ward.update', 'ward', id, { changes: dto });
    return ward;
  }

  // ── Beds ──────────────────────────────────────────────────────
  listBeds(ctx: RequestContext, wardId?: string) {
    const { db } = this.scope(ctx);
    return db.bed.findMany({
      where: wardId ? { wardId } : undefined,
      orderBy: [{ wardId: 'asc' }, { bedNumber: 'asc' }],
    });
  }

  async createBed(ctx: RequestContext, dto: CreateBedDto) {
    const s = this.scope(ctx);
    const ward = await s.db.ward.findFirst({ where: { id: dto.wardId } });
    if (!ward) throw new BadRequestException('Ward not found in this hospital');
    const bed = await s.db.bed.create({
      data: {
        tenantId: s.tenantId,
        wardId: dto.wardId,
        bedNumber: dto.bedNumber,
        status: (dto.status ?? 'AVAILABLE') as any,
      },
    });
    await this.record(s, 'bed.create', 'bed', bed.id, { bedNumber: bed.bedNumber, wardId: bed.wardId });
    return bed;
  }

  async updateBed(ctx: RequestContext, id: string, dto: UpdateBedDto) {
    const s = this.scope(ctx);
    const existing = await s.db.bed.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Bed not found');
    const bed = await s.db.bed.update({
      where: { id },
      data: { bedNumber: dto.bedNumber, status: dto.status as any },
    });
    await this.record(s, 'bed.update', 'bed', id, { changes: dto });
    return bed;
  }

  // ── Lab test catalog (LAB module) ─────────────────────────────
  listLabTests(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.labTestCatalog.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createLabTest(ctx: RequestContext, dto: CreateLabTestDto) {
    const s = this.scope(ctx);
    const test = await this.guard(
      () =>
        s.db.labTestCatalog.create({
          data: {
            tenantId: s.tenantId,
            code: dto.code,
            name: dto.name,
            specimenType: dto.specimenType,
            price: dto.price,
          },
        }),
      `A lab test with code "${dto.code}" already exists.`,
    );
    await this.record(s, 'lab_catalog.create', 'lab_test_catalog', test.id, { code: test.code });
    return test;
  }

  async updateLabTest(ctx: RequestContext, id: string, dto: UpdateLabTestDto) {
    const s = this.scope(ctx);
    const existing = await s.db.labTestCatalog.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Lab test not found');
    const test = await s.db.labTestCatalog.update({
      where: { id },
      data: { name: dto.name, specimenType: dto.specimenType, price: dto.price, active: dto.active },
    });
    await this.record(
      s,
      dto.active === false ? 'lab_catalog.deactivate' : 'lab_catalog.update',
      'lab_test_catalog',
      id,
      {
        changes: dto,
      },
    );
    return test;
  }

  // ── Insurance providers (INSURANCE module) ────────────────────
  listInsuranceProviders(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.insuranceProvider.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async createInsuranceProvider(ctx: RequestContext, dto: CreateInsuranceProviderDto) {
    const s = this.scope(ctx);
    const provider = await s.db.insuranceProvider.create({
      data: { tenantId: s.tenantId, name: dto.name, contact: dto.contact },
    });
    await this.record(s, 'insurance_provider.create', 'insurance_provider', provider.id, { name: provider.name });
    return provider;
  }

  async updateInsuranceProvider(ctx: RequestContext, id: string, dto: UpdateInsuranceProviderDto) {
    const s = this.scope(ctx);
    const existing = await s.db.insuranceProvider.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Insurance provider not found');
    const provider = await s.db.insuranceProvider.update({
      where: { id },
      data: { name: dto.name, contact: dto.contact, active: dto.active },
    });
    await this.record(
      s,
      dto.active === false ? 'insurance_provider.deactivate' : 'insurance_provider.update',
      'insurance_provider',
      id,
      { changes: dto },
    );
    return provider;
  }

  // ── Setup overview / checklist ────────────────────────────────
  async getOverview(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const hasLab = ctx.modules.has(MODULES.LAB);
    const hasInsurance = ctx.modules.has(MODULES.INSURANCE);
    const hasIpd = ctx.modules.has(MODULES.IPD);

    const [profile, facilities, departments, catalog, wards, bedRows, labTests, insurers, staff] = await Promise.all([
      this.getProfile(ctx),
      db.facility.count({ where: { active: true } }),
      db.department.count({ where: { active: true } }),
      db.serviceCatalog.count({ where: { active: true } }),
      db.ward.count({ where: { active: true } }),
      db.bed.groupBy({ by: ['status'], _count: { _all: true } }),
      hasLab ? db.labTestCatalog.count({ where: { active: true } }) : Promise.resolve(0),
      hasInsurance ? db.insuranceProvider.count({ where: { active: true } }) : Promise.resolve(0),
      db.tenantUser.count({ where: { active: true } }),
    ]);

    const beds = { total: 0, AVAILABLE: 0, OCCUPIED: 0, MAINTENANCE: 0, RESERVED: 0 } as Record<string, number>;
    for (const row of bedRows) {
      const n = row._count._all;
      beds[row.status] = n;
      beds.total += n;
    }

    const profileComplete = Boolean(profile.name && profile.contactEmail && profile.invoicePrefix && profile.mrnPrefix);

    const checklist = [
      { key: 'profile', label: 'Complete hospital profile', done: profileComplete, href: '/admin/profile' },
      { key: 'facility', label: 'Add at least one facility', done: facilities > 0, href: '/admin/facilities' },
      { key: 'department', label: 'Add departments', done: departments > 0, href: '/admin/departments' },
      { key: 'catalog', label: 'Build the service catalog', done: catalog > 0, href: '/admin/catalog' },
      ...(hasIpd ? [{ key: 'wards', label: 'Configure wards and beds', done: wards > 0, href: '/admin/wards' }] : []),
      ...(hasLab ? [{ key: 'lab', label: 'Add lab tests', done: labTests > 0, href: '/admin/lab-catalog' }] : []),
      ...(hasInsurance
        ? [{ key: 'insurance', label: 'Add insurance providers', done: insurers > 0, href: '/admin/insurance' }]
        : []),
      { key: 'staff', label: 'Invite staff', done: staff > 1, href: '/admin/staff' },
    ];

    const completed = checklist.filter((c) => c.done).length;

    return {
      profile: { ...profile, complete: profileComplete },
      modules: { lab: hasLab, insurance: hasInsurance, ipd: hasIpd },
      counts: {
        facilities,
        departments,
        catalog,
        wards,
        beds: beds.total,
        labTests,
        insuranceProviders: insurers,
        staff,
      },
      beds,
      checklist,
      progress: { completed, total: checklist.length },
    };
  }
  // ── Audit search ─────────────────────────────────────────────
  /**
   * Tenant-scoped audit search (read-only, RLS-bound). The response exposes a
   * whitelist of fields; audit metadata is written minimally (IDs + context,
   * no PHI payloads) by every producer.
   */
  async searchAudit(ctx: RequestContext, q: AuditQueryDto) {
    const db = requireDb(ctx);
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = { contains: q.action, mode: 'insensitive' };
    if (q.entity) where.entity = { contains: q.entity, mode: 'insensitive' };
    if (q.entityId) where.entityId = q.entityId;
    if (q.actorId) where.actorId = q.actorId;
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 50;
    const [total, rows] = await Promise.all([
      db.auditLog.count({ where }),
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          actorId: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ]);

    // The user table is identity-only (no RLS); resolving display names here
    // does not cross tenant data boundaries.
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
    const actors = actorIds.length
      ? await db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));

    return {
      total,
      page,
      pageSize,
      rows: rows.map((r) => ({ ...r, actor: r.actorId ? (actorById.get(r.actorId) ?? null) : null })),
    };
  }
}
