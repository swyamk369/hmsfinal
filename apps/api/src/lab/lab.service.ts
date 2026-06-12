import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CollectSampleDto,
  CreateLabCatalogDto,
  CreateLabOrderDto,
  EncounterLabOrderDto,
  EnterResultsDto,
  UpdateLabCatalogDto,
  UpdateLabStatusDto,
} from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

const PATIENT_SELECT = { select: { id: true, fullName: true, mrn: true, dob: true, sex: true, phone: true } };

const ORDER_INCLUDE = {
  patient: PATIENT_SELECT,
  items: {
    include: {
      samples: { orderBy: { collectedAt: 'desc' as const } },
      results: { orderBy: { recordedAt: 'desc' as const } },
    },
  },
};

// Allowed lab-order status transitions. ORDERED → COMPLETED is intentionally absent.
const TRANSITIONS: Record<string, string[]> = {
  ORDERED: ['SAMPLE_COLLECTED', 'CANCELLED'],
  SAMPLE_COLLECTED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class LabService {
  constructor(
    private readonly audit: AuditService,
    private readonly notifications?: NotificationsService,
  ) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, { tenantId: s.tenantId, actorId: s.actorId, action, entity, entityId, metadata });
  }

  private assertTransition(from: string, to: string) {
    if (from === to) return;
    if (!TRANSITIONS[from]?.includes(to)) {
      throw new BadRequestException(`Cannot move lab order from ${from} to ${to}`);
    }
  }

  // ── Catalog ───────────────────────────────────────────────────
  catalog(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    return db.labTestCatalog.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async createCatalog(ctx: RequestContext, dto: CreateLabCatalogDto) {
    const s = this.scope(ctx);
    const existing = await s.db.labTestCatalog.findFirst({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`A lab test with code "${dto.code}" already exists`);
    const test = await s.db.labTestCatalog.create({
      data: {
        tenantId: s.tenantId,
        code: dto.code,
        name: dto.name,
        specimenType: dto.specimenType,
        price: dto.price ?? 0,
      },
    });
    await this.record(s, 'lab.catalog.create', 'lab_test_catalog', test.id, { code: dto.code });
    return test;
  }

  async updateCatalog(ctx: RequestContext, id: string, dto: UpdateLabCatalogDto) {
    const s = this.scope(ctx);
    const existing = await s.db.labTestCatalog.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Lab test not found');
    const test = await s.db.labTestCatalog.update({
      where: { id },
      data: { name: dto.name, specimenType: dto.specimenType, price: dto.price, active: dto.active },
    });
    await this.record(s, 'lab.catalog.update', 'lab_test_catalog', id, { changes: dto });
    return test;
  }

  // ── Orders ────────────────────────────────────────────────────
  listOrders(
    ctx: RequestContext,
    filters: { status?: string; patientId?: string; encounterId?: string; q?: string; today?: boolean },
  ) {
    const { db } = this.scope(ctx);
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.encounterId) where.encounterId = filters.encounterId;
    if (filters.today) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      where.createdAt = { gte: start };
    }
    if (filters.q) {
      where.patient = { fullName: { contains: filters.q, mode: 'insensitive' } };
    }
    return db.labOrder.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: ORDER_INCLUDE });
  }

  async getOrder(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    const order = await db.labOrder.findFirst({ where: { id }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Lab order not found');
    return order;
  }

  listForEncounter(ctx: RequestContext, encounterId: string) {
    const { db } = this.scope(ctx);
    return db.labOrder.findMany({ where: { encounterId }, orderBy: { createdAt: 'desc' }, include: ORDER_INCLUDE });
  }

  async create(ctx: RequestContext, dto: CreateLabOrderDto) {
    const s = this.scope(ctx);
    const patient = await s.db.patient.findFirst({
      where: { id: dto.patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw new BadRequestException('Patient not found');
    return this.createOrder(s, {
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      providerId: dto.providerId,
      notes: dto.notes,
      tests: dto.tests,
    });
  }

  async createFromEncounter(ctx: RequestContext, encounterId: string, dto: EncounterLabOrderDto) {
    const s = this.scope(ctx);
    const enc = await s.db.encounter.findFirst({
      where: { id: encounterId },
      select: { id: true, patientId: true, providerId: true, status: true },
    });
    if (!enc) throw new NotFoundException('Encounter not found');
    if (['CANCELLED', 'COMPLETED'].includes(enc.status)) {
      throw new BadRequestException(`Encounter is ${enc.status.toLowerCase()} — cannot add lab orders`);
    }
    return this.createOrder(s, {
      patientId: enc.patientId,
      encounterId: enc.id,
      providerId: enc.providerId ?? undefined,
      notes: dto.notes,
      tests: dto.tests,
    });
  }

  private async createOrder(
    s: Scope,
    input: {
      patientId: string;
      encounterId?: string;
      providerId?: string;
      notes?: string;
      tests: { testId: string; testName: string }[];
    },
  ) {
    const order = await s.db.labOrder.create({
      data: {
        tenantId: s.tenantId,
        patientId: input.patientId,
        encounterId: input.encounterId,
        providerId: input.providerId,
        orderedById: s.actorId,
        status: 'ORDERED',
        notes: input.notes,
        items: {
          create: input.tests.map((t) => ({
            tenantId: s.tenantId,
            testId: t.testId,
            testName: t.testName,
            status: 'ORDERED' as const,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    const billing = await this.tryPostLabCharges(s, order.id, input.patientId, order.encounterId, input.tests);
    await this.record(s, 'lab.order', 'lab_order', order.id, {
      patientId: input.patientId,
      encounterId: input.encounterId ?? null,
      tests: input.tests.length,
      billing,
    });
    return { ...order, billing };
  }

  /**
   * Lab orders post pending charges into the unified Finance ledger. Billing can
   * then select the charges into an OPD/IPD bill according to hospital policy.
   */
  private async tryPostLabCharges(
    s: Scope,
    orderId: string,
    patientId: string,
    encounterId: string | null | undefined,
    tests: { testId: string; testName: string }[],
  ): Promise<{ posted: boolean; reason?: string; items?: number; amount?: number }> {
    const lineItems: { name: string; price: number; catalogId: string }[] = [];
    for (const t of tests) {
      // Source of truth: the lab test's OWN catalog price, matched by id (exact) — this
      // is the price set in Admin → Lab Catalog and the test the doctor actually ordered.
      // Only fall back to a ServiceCatalog LAB entry (by name) when the test has no price.
      let resolved: { name: string; price: number; catalogId: string } | null = null;
      if (t.testId) {
        const labTest = await s.db.labTestCatalog.findFirst({ where: { id: t.testId } });
        if (labTest && labTest.price > 0) {
          resolved = { name: labTest.name, price: labTest.price, catalogId: labTest.id };
        }
      }
      if (!resolved) {
        const svc = await s.db.serviceCatalog.findFirst({
          where: { type: 'LAB', active: true, name: { equals: t.testName, mode: 'insensitive' } },
        });
        if (svc && svc.price > 0) resolved = { name: svc.name, price: svc.price, catalogId: svc.id };
      }
      if (resolved) lineItems.push(resolved);
    }
    if (lineItems.length === 0) return { posted: false, reason: 'no_catalog_match' };

    await s.db.billableCharge.createMany({
      data: lineItems.map((li) => ({
        tenantId: s.tenantId,
        patientId,
        encounterId: encounterId ?? null,
        catalogId: li.catalogId,
        sourceModule: 'LAB' as const,
        sourceType: 'LAB_ORDER',
        sourceId: orderId,
        name: li.name,
        quantity: 1,
        unitPrice: li.price,
        total: li.price,
        createdById: s.actorId,
      })),
    });
    await this.record(s, 'charge.create', 'lab_order', orderId, {
      patientId,
      encounterId: encounterId ?? null,
      sourceModule: 'LAB',
      items: lineItems.length,
      amount: lineItems.reduce((sum, li) => sum + li.price, 0),
    });
    return { posted: true, items: lineItems.length, amount: lineItems.reduce((sum, li) => sum + li.price, 0) };
  }

  // ── Sample collection ─────────────────────────────────────────
  async collectSample(ctx: RequestContext, orderId: string, dto: CollectSampleDto) {
    const s = this.scope(ctx);
    const order = await s.db.labOrder.findFirst({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Lab order not found');
    if (order.status === 'CANCELLED') throw new BadRequestException('Lab order is cancelled');
    if (order.status === 'COMPLETED') throw new BadRequestException('Lab order is completed');

    const targets = dto.labOrderItemId ? order.items.filter((i) => i.id === dto.labOrderItemId) : order.items;
    if (targets.length === 0) throw new BadRequestException('No matching order item to collect');

    await s.db.labSample.createMany({
      data: targets.map((i) => ({
        tenantId: s.tenantId,
        labOrderItemId: i.id,
        barcode: dto.barcode,
        collectedById: s.actorId,
        collectedAt: new Date(),
        status: 'COLLECTED',
      })),
    });
    await s.db.labOrderItem.updateMany({
      where: { id: { in: targets.map((i) => i.id) } },
      data: { status: 'SAMPLE_COLLECTED' },
    });
    if (order.status === 'ORDERED') {
      await s.db.labOrder.update({ where: { id: orderId }, data: { status: 'SAMPLE_COLLECTED' } });
    }
    await this.record(s, 'lab.sample.collect', 'lab_order', orderId, { items: targets.length });
    return this.getOrder(ctx, orderId);
  }

  // ── Status ────────────────────────────────────────────────────
  async updateStatus(ctx: RequestContext, orderId: string, dto: UpdateLabStatusDto) {
    const s = this.scope(ctx);
    const order = await s.db.labOrder.findFirst({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Lab order not found');
    this.assertTransition(order.status, dto.status);
    if (dto.status === 'CANCELLED' && !dto.reason?.trim()) {
      throw new BadRequestException('reason is required to cancel a lab order');
    }

    if (dto.status === 'PROCESSING') {
      await s.db.labOrderItem.updateMany({
        where: { labOrderId: orderId, status: 'SAMPLE_COLLECTED' },
        data: { status: 'PROCESSING' },
      });
    }
    await s.db.labOrder.update({ where: { id: orderId }, data: { status: dto.status } });
    await this.record(s, 'lab.status.update', 'lab_order', orderId, {
      from: order.status,
      to: dto.status,
      reason: dto.reason ?? null,
    });
    return this.getOrder(ctx, orderId);
  }

  // ── Results ───────────────────────────────────────────────────
  async enterResults(ctx: RequestContext, orderId: string, dto: EnterResultsDto) {
    const s = this.scope(ctx);
    const order = await s.db.labOrder.findFirst({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new NotFoundException('Lab order not found');
    if (order.status === 'COMPLETED') {
      throw new BadRequestException('Lab order is completed — results are locked and cannot be edited');
    }
    if (order.status === 'CANCELLED') throw new BadRequestException('Lab order is cancelled');
    if (!['SAMPLE_COLLECTED', 'PROCESSING'].includes(order.status)) {
      throw new BadRequestException('Collect the sample before entering results');
    }

    const itemIds = new Set(order.items.map((i) => i.id));
    const saved = [];
    for (const r of dto.results) {
      if (!itemIds.has(r.labOrderItemId)) {
        throw new BadRequestException('Result references an item that is not on this order');
      }
      const item = order.items.find((i) => i.id === r.labOrderItemId)!;
      const existing = await s.db.labResult.findFirst({
        where: { labOrderItemId: r.labOrderItemId, isVerified: false },
      });
      const data = {
        testName: r.testName ?? item.testName,
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        abnormalFlag: (r.abnormalFlag ?? 'NORMAL') as any,
        notes: r.notes,
        enteredById: s.actorId,
      };
      const result = existing
        ? await s.db.labResult.update({ where: { id: existing.id }, data })
        : await s.db.labResult.create({ data: { tenantId: s.tenantId, labOrderItemId: r.labOrderItemId, ...data } });
      saved.push(result);
    }

    // First result entry moves the order into PROCESSING.
    if (order.status === 'SAMPLE_COLLECTED') {
      await s.db.labOrder.update({ where: { id: orderId }, data: { status: 'PROCESSING' } });
      await s.db.labOrderItem.updateMany({
        where: { labOrderId: orderId, status: 'SAMPLE_COLLECTED' },
        data: { status: 'PROCESSING' },
      });
    }
    await this.record(s, 'lab.result.enter', 'lab_order', orderId, { results: saved.length });
    return this.getOrder(ctx, orderId);
  }

  async verifyResult(ctx: RequestContext, resultId: string) {
    const s = this.scope(ctx);
    const result = await s.db.labResult.findFirst({ where: { id: resultId } });
    if (!result) throw new NotFoundException('Lab result not found');
    if (result.isVerified) throw new BadRequestException('Result is already verified');

    const updated = await s.db.labResult.update({
      where: { id: resultId },
      data: { isVerified: true, verifiedById: s.actorId, verifiedAt: new Date() },
    });
    await s.db.labOrderItem.update({ where: { id: result.labOrderItemId }, data: { status: 'COMPLETED' } });

    // Resolve the owning order and complete it once every item is done.
    const item = await s.db.labOrderItem.findFirst({
      where: { id: result.labOrderItemId },
      select: { labOrderId: true },
    });
    let orderId: string | null = null;
    if (item) {
      orderId = item.labOrderId;
      const remaining = await s.db.labOrderItem.count({
        where: { labOrderId: item.labOrderId, status: { not: 'COMPLETED' } },
      });
      if (remaining === 0) {
        await s.db.labOrder.update({ where: { id: item.labOrderId }, data: { status: 'COMPLETED' } });
      }
    }
    await this.record(s, 'lab.result.verify', 'lab_result', resultId, { labOrderItemId: result.labOrderItemId });
    if (orderId) {
      const order = await s.db.labOrder.findFirst({ where: { id: orderId }, select: { providerId: true } });
      const provider = order?.providerId
        ? await s.db.provider.findFirst({ where: { id: order.providerId, active: true }, select: { userId: true } })
        : null;
      const abnormal = result.abnormalFlag !== 'NORMAL';
      await this.notifications?.safeNotify(ctx, {
        category: 'LAB',
        type: abnormal ? 'lab.result.abnormal' : 'lab.result.ready',
        severity: result.abnormalFlag === 'CRITICAL' ? 'CRITICAL' : abnormal ? 'WARNING' : 'INFO',
        title: abnormal ? 'Abnormal lab result verified' : 'Lab result ready',
        message: abnormal ? 'A verified lab result needs clinical review.' : 'A verified lab report is ready.',
        actionUrl: `/lab/reports/${orderId}`,
        metadata: { labOrderId: orderId, labResultId: resultId, abnormalFlag: result.abnormalFlag },
        roleCodes: abnormal ? ['LAB_TECH', 'DOCTOR', 'HOSPITAL_ADMIN'] : ['LAB_TECH', 'HOSPITAL_ADMIN'],
        userIds: provider?.userId ? [provider.userId] : [],
      });
    }
    return { result: updated, orderId };
  }

  /**
   * Batch-verify every unverified result on an order in one step, completing the order
   * once all items are done. Replaces clicking "verify" on each result individually.
   */
  async verifyAll(ctx: RequestContext, orderId: string) {
    const s = this.scope(ctx);
    const order = await s.db.labOrder.findFirst({
      where: { id: orderId },
      include: { items: { include: { results: true } } },
    });
    if (!order) throw new NotFoundException('Lab order not found');
    if (order.status === 'CANCELLED') throw new BadRequestException('Lab order is cancelled');

    const unverified = order.items.flatMap((i) => i.results).filter((r) => !r.isVerified);
    if (unverified.length === 0) {
      throw new BadRequestException('No results to verify — enter results first');
    }

    let severity: 'NORMAL' | 'ABNORMAL' | 'CRITICAL' = 'NORMAL';
    for (const r of unverified) {
      await s.db.labResult.update({
        where: { id: r.id },
        data: { isVerified: true, verifiedById: s.actorId, verifiedAt: new Date() },
      });
      await s.db.labOrderItem.update({ where: { id: r.labOrderItemId }, data: { status: 'COMPLETED' } });
      if (r.abnormalFlag === 'CRITICAL') severity = 'CRITICAL';
      else if (r.abnormalFlag !== 'NORMAL' && severity !== 'CRITICAL') severity = 'ABNORMAL';
    }

    const remaining = await s.db.labOrderItem.count({ where: { labOrderId: orderId, status: { not: 'COMPLETED' } } });
    const completed = remaining === 0;
    if (completed) await s.db.labOrder.update({ where: { id: orderId }, data: { status: 'COMPLETED' } });

    await this.record(s, 'lab.result.verify', 'lab_order', orderId, { verified: unverified.length, completed });

    const abnormal = severity !== 'NORMAL';
    const provider = order.providerId
      ? await s.db.provider.findFirst({ where: { id: order.providerId, active: true }, select: { userId: true } })
      : null;
    await this.notifications?.safeNotify(ctx, {
      category: 'LAB',
      type: abnormal ? 'lab.result.abnormal' : 'lab.result.ready',
      severity: severity === 'CRITICAL' ? 'CRITICAL' : abnormal ? 'WARNING' : 'INFO',
      title: abnormal ? 'Abnormal lab results verified' : 'Lab report ready',
      message: abnormal ? 'Verified lab results need clinical review.' : 'A verified lab report is ready.',
      actionUrl: `/lab/reports/${orderId}`,
      metadata: { labOrderId: orderId, verified: unverified.length, completed },
      roleCodes: abnormal ? ['LAB_TECH', 'DOCTOR', 'HOSPITAL_ADMIN'] : ['LAB_TECH', 'HOSPITAL_ADMIN'],
      userIds: provider?.userId ? [provider.userId] : [],
    });

    return this.getOrder(ctx, orderId);
  }

  // ── Report ────────────────────────────────────────────────────
  async report(ctx: RequestContext, orderId: string) {
    const s = this.scope(ctx);
    const order = await s.db.labOrder.findFirst({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Lab order not found');
    const [tenant, settings] = await Promise.all([
      s.db.tenant.findUnique({ where: { id: s.tenantId } }),
      s.db.hospitalSettings.findUnique({ where: { tenantId: s.tenantId } }),
    ]);
    await this.record(s, 'lab.report.print', 'lab_order', orderId, {});
    return {
      order,
      hospital: {
        name: tenant?.name ?? 'Hospital',
        address: tenant?.address ?? null,
        phone: tenant?.contactPhone ?? null,
        email: tenant?.contactEmail ?? null,
        currency: settings?.currency ?? 'INR',
      },
    };
  }

  // ── Stats (dashboard KPIs) ────────────────────────────────────
  async stats(ctx: RequestContext) {
    const { db } = this.scope(ctx);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [ordered, sampleCollected, processing, pendingVerification, completedToday] = await Promise.all([
      db.labOrder.count({ where: { status: 'ORDERED' } }),
      db.labOrder.count({ where: { status: 'SAMPLE_COLLECTED' } }),
      db.labOrder.count({ where: { status: 'PROCESSING' } }),
      db.labResult.count({ where: { isVerified: false } }),
      db.labOrder.count({ where: { status: 'COMPLETED', createdAt: { gte: start } } }),
    ]);
    return { ordered, sampleCollected, processing, pendingVerification, completedToday };
  }
}
