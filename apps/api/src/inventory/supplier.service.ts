import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantClient } from '@hms/db';
import { AuditService } from '../common/audit.service';
import { requireDb } from '../common/util';
import type { RequestContext } from '../common/types';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

interface Scope {
  db: TenantClient;
  tenantId: string;
  actorId: string | null;
}

@Injectable()
export class SupplierService {
  constructor(private readonly audit: AuditService) {}

  private scope(ctx: RequestContext): Scope {
    return { db: requireDb(ctx), tenantId: ctx.tenantId!, actorId: ctx.userId };
  }

  private record(s: Scope, action: string, entityId: string, metadata?: Record<string, unknown>) {
    return this.audit.log(s.db, {
      tenantId: s.tenantId,
      actorId: s.actorId,
      action,
      entity: 'supplier',
      entityId,
      metadata,
    });
  }

  list(ctx: RequestContext, q?: string) {
    const { db } = this.scope(ctx);
    return db.supplier.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { purchases: true } } },
      take: 300,
    });
  }

  async get(ctx: RequestContext, id: string) {
    const { db } = this.scope(ctx);
    const supplier = await db.supplier.findFirst({
      where: { id },
      include: { purchases: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(ctx: RequestContext, dto: CreateSupplierDto) {
    const s = this.scope(ctx);
    const dup = await s.db.supplier.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' }, active: true },
      select: { id: true },
    });
    if (dup) throw new ConflictException('A supplier with that name already exists');
    const supplier = await s.db.supplier.create({
      data: { tenantId: s.tenantId, name: dto.name, contact: dto.contact, address: dto.address },
    });
    await this.record(s, 'inventory.supplier.create', supplier.id, { name: supplier.name });
    return supplier;
  }

  async update(ctx: RequestContext, id: string, dto: UpdateSupplierDto) {
    const s = this.scope(ctx);
    const existing = await s.db.supplier.findFirst({ where: { id } });
    if (!existing) throw new NotFoundException('Supplier not found');
    if (dto.name) {
      const dup = await s.db.supplier.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, active: true, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException('A supplier with that name already exists');
    }
    const supplier = await s.db.supplier.update({
      where: { id },
      data: { name: dto.name, contact: dto.contact, address: dto.address, active: dto.active },
    });
    const action = dto.active === false ? 'inventory.supplier.deactivate' : 'inventory.supplier.update';
    await this.record(s, action, id, { changes: dto });
    return supplier;
  }
}
