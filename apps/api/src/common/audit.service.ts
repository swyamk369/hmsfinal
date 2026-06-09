import { Injectable } from '@nestjs/common';
import { platformDb } from '@hms/db';
import type { TenantClient } from '@hms/db';

export interface AuditEntry {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Writes audit rows. Tenant audit goes through the tenant-scoped client so RLS
 * applies; the audit_log table is append-only (DB trigger blocks UPDATE/DELETE).
 */
@Injectable()
export class AuditService {
  async log(db: TenantClient, entry: AuditEntry): Promise<void> {
    await db.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? undefined) as any,
      },
    });
  }

  async platformLog(entry: {
    actorId?: string | null;
    tenantId?: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await platformDb.platformAuditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        tenantId: entry.tenantId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        metadata: (entry.metadata ?? undefined) as any,
      },
    });
  }
}
