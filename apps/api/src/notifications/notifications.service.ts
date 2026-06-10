import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { NotificationChannel, NotificationCategory, NotificationSeverity, TenantClient } from '@hms/db';
import { requireDb } from '../common/util';
import { AuditService } from '../common/audit.service';
import type { RequestContext } from '../common/types';
import { NOTIFICATION_CATEGORIES, type NotificationQueryDto, type UpdatePreferencesDto } from './dto';

type Channel = NotificationChannel;
type Category = NotificationCategory;
type Severity = NotificationSeverity;

interface Scope {
  db: TenantClient;
  tenantId: string;
  userId: string;
  tenantUserId?: string | null;
}

export interface NotifyInput {
  category: Category;
  type: string;
  severity?: Severity;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  userIds?: string[];
  tenantUserIds?: string[];
  roleCodes?: string[];
  allTenantUsers?: boolean;
  channels?: Channel[];
  createdById?: string | null;
}

interface Recipient {
  userId: string;
  tenantUserId: string;
}

const DEFAULT_CHANNELS: Channel[] = ['IN_APP'];
const EXTERNAL_CHANNELS: Channel[] = ['EMAIL', 'SMS', 'WHATSAPP'];

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly audit: AuditService) {}

  private scope(ctx: RequestContext): Scope {
    const db = requireDb(ctx);
    const userId = ctx.userId!;
    return { db, tenantId: ctx.tenantId!, userId };
  }

  async list(ctx: RequestContext, q: NotificationQueryDto) {
    const s = this.scope(ctx);
    const where: any = { recipientUserId: s.userId };
    if (q.category) where.category = q.category;
    if (q.severity) where.severity = q.severity;
    if (q.read === 'read') where.readAt = { not: null };
    if (q.read === 'unread') where.readAt = null;
    if (q.archived === '1' || q.archived === 'true') where.archivedAt = { not: null };
    else where.archivedAt = null;

    return s.db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { deliveryAttempts: { orderBy: { attemptedAt: 'desc' } } },
    });
  }

  async unreadCount(ctx: RequestContext) {
    const s = this.scope(ctx);
    const count = await s.db.notification.count({
      where: { recipientUserId: s.userId, readAt: null, archivedAt: null },
    });
    return { count };
  }

  async markRead(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const existing = await s.db.notification.findFirst({ where: { id, recipientUserId: s.userId } });
    if (!existing) throw new NotFoundException('Notification not found');
    return s.db.notification.update({
      where: { id },
      data: { readAt: existing.readAt ?? new Date() },
      include: { deliveryAttempts: { orderBy: { attemptedAt: 'desc' } } },
    });
  }

  async readAll(ctx: RequestContext) {
    const s = this.scope(ctx);
    const result = await s.db.notification.updateMany({
      where: { recipientUserId: s.userId, readAt: null, archivedAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  async archive(ctx: RequestContext, id: string) {
    const s = this.scope(ctx);
    const existing = await s.db.notification.findFirst({ where: { id, recipientUserId: s.userId } });
    if (!existing) throw new NotFoundException('Notification not found');
    return s.db.notification.update({
      where: { id },
      data: { archivedAt: existing.archivedAt ?? new Date(), readAt: existing.readAt ?? new Date() },
      include: { deliveryAttempts: { orderBy: { attemptedAt: 'desc' } } },
    });
  }

  async preferences(ctx: RequestContext) {
    const s = this.scope(ctx);
    const tenantUser = await this.currentTenantUser(s);
    const existing = await s.db.notificationPreference.findMany({
      where: { userId: s.userId },
      orderBy: { category: 'asc' },
    });
    const byCategory = new Map(existing.map((p) => [p.category, p]));
    return NOTIFICATION_CATEGORIES.map((category) => {
      const row = byCategory.get(category as any);
      return (
        row ?? {
          id: null,
          tenantId: s.tenantId,
          userId: s.userId,
          tenantUserId: tenantUser?.id ?? null,
          category,
          inAppEnabled: true,
          emailEnabled: false,
          smsEnabled: false,
          whatsappEnabled: false,
          quietHoursStart: null,
          quietHoursEnd: null,
        }
      );
    });
  }

  async updatePreferences(ctx: RequestContext, dto: UpdatePreferencesDto) {
    const s = this.scope(ctx);
    const tenantUser = await this.currentTenantUser(s);
    for (const pref of dto.preferences) {
      await s.db.notificationPreference.upsert({
        where: { tenantId_userId_category: { tenantId: s.tenantId, userId: s.userId, category: pref.category as any } },
        create: {
          tenantId: s.tenantId,
          userId: s.userId,
          tenantUserId: tenantUser?.id ?? null,
          category: pref.category as any,
          inAppEnabled: pref.inAppEnabled ?? true,
          emailEnabled: pref.emailEnabled ?? false,
          smsEnabled: pref.smsEnabled ?? false,
          whatsappEnabled: pref.whatsappEnabled ?? false,
          quietHoursStart: pref.quietHoursStart,
          quietHoursEnd: pref.quietHoursEnd,
        },
        update: {
          inAppEnabled: pref.inAppEnabled,
          emailEnabled: pref.emailEnabled,
          smsEnabled: pref.smsEnabled,
          whatsappEnabled: pref.whatsappEnabled,
          quietHoursStart: pref.quietHoursStart,
          quietHoursEnd: pref.quietHoursEnd,
        },
      });
    }
    await this.audit.log(s.db, {
      tenantId: s.tenantId,
      actorId: s.userId,
      action: 'notification.preference.update',
      entity: 'notification_preference',
      entityId: s.userId,
      metadata: { categories: dto.preferences.map((p) => p.category) },
    });
    return this.preferences(ctx);
  }

  /**
   * Workflow-safe notification entry point. It logs delivery problems as rows
   * and swallows unexpected errors so the clinical/financial operation can finish.
   */
  async safeNotify(ctx: RequestContext, input: NotifyInput): Promise<void> {
    try {
      const db = requireDb(ctx);
      await this.notify(db, ctx.tenantId!, { ...input, createdById: input.createdById ?? ctx.userId });
    } catch (err) {
      this.logger.warn(`Notification skipped after workflow: ${(err as Error).message}`);
    }
  }

  async notify(db: TenantClient, tenantId: string, input: NotifyInput): Promise<{ created: number }> {
    const recipients = await this.resolveRecipients(db, input);
    let created = 0;
    for (const recipient of recipients) {
      const prefs = await this.preferenceFor(db, tenantId, recipient, input.category);
      const channels = this.enabledChannels(input.channels ?? DEFAULT_CHANNELS, prefs);
      if (channels.length === 0) continue;

      const notification =
        channels.includes('IN_APP') && prefs.inAppEnabled
          ? await db.notification.create({
              data: {
                tenantId,
                recipientUserId: recipient.userId,
                tenantUserId: recipient.tenantUserId,
                category: input.category as any,
                type: input.type,
                severity: (input.severity ?? 'INFO') as any,
                title: input.title,
                message: input.message,
                actionUrl: input.actionUrl,
                metadata: input.metadata as any,
                createdById: input.createdById ?? null,
              },
            })
          : await db.notification.create({
              data: {
                tenantId,
                recipientUserId: recipient.userId,
                tenantUserId: recipient.tenantUserId,
                category: input.category as any,
                type: input.type,
                severity: (input.severity ?? 'INFO') as any,
                title: input.title,
                message: input.message,
                actionUrl: input.actionUrl,
                metadata: input.metadata as any,
                createdById: input.createdById ?? null,
                readAt: new Date(),
                archivedAt: new Date(),
              },
            });
      created += channels.includes('IN_APP') && prefs.inAppEnabled ? 1 : 0;

      for (const channel of channels) {
        await this.recordDelivery(db, tenantId, notification.id, channel);
      }
    }
    return { created };
  }

  private async currentTenantUser(s: Scope) {
    return s.db.tenantUser.findFirst({ where: { userId: s.userId, active: true }, select: { id: true } });
  }

  private async resolveRecipients(db: TenantClient, input: NotifyInput): Promise<Recipient[]> {
    const byUser = new Map<string, Recipient>();
    const add = (row: { userId: string; id: string }) => byUser.set(row.userId, { userId: row.userId, tenantUserId: row.id });

    if (input.allTenantUsers) {
      const rows = await db.tenantUser.findMany({ where: { active: true }, select: { id: true, userId: true } });
      rows.forEach(add);
    }
    if (input.userIds?.length) {
      const rows = await db.tenantUser.findMany({
        where: { active: true, userId: { in: input.userIds } },
        select: { id: true, userId: true },
      });
      rows.forEach(add);
    }
    if (input.tenantUserIds?.length) {
      const rows = await db.tenantUser.findMany({
        where: { active: true, id: { in: input.tenantUserIds } },
        select: { id: true, userId: true },
      });
      rows.forEach(add);
    }
    if (input.roleCodes?.length) {
      const rows = await db.tenantUser.findMany({
        where: { active: true, roles: { some: { role: { code: { in: input.roleCodes } } } } },
        select: { id: true, userId: true },
      });
      rows.forEach(add);
    }
    return [...byUser.values()];
  }

  private async preferenceFor(db: TenantClient, tenantId: string, recipient: Recipient, category: Category) {
    return (
      (await db.notificationPreference.findUnique({
        where: { tenantId_userId_category: { tenantId, userId: recipient.userId, category: category as any } },
      })) ?? {
        inAppEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        whatsappEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      }
    );
  }

  private enabledChannels(channels: Channel[], prefs: { inAppEnabled: boolean; emailEnabled: boolean; smsEnabled: boolean; whatsappEnabled: boolean }) {
    return channels.filter((channel) => {
      if (channel === 'IN_APP') return prefs.inAppEnabled;
      if (channel === 'EMAIL') return prefs.emailEnabled;
      if (channel === 'SMS') return prefs.smsEnabled;
      if (channel === 'WHATSAPP') return prefs.whatsappEnabled;
      return false;
    });
  }

  private async recordDelivery(db: TenantClient, tenantId: string, notificationId: string, channel: Channel) {
    if (channel === 'IN_APP') {
      await db.notificationDeliveryAttempt.create({
        data: { tenantId, notificationId, channel: 'IN_APP', status: 'SENT', provider: 'database' },
      });
      return;
    }

    const provider = process.env[`NOTIFICATION_${channel}_PROVIDER`] || process.env[`${channel}_PROVIDER`] || null;
    const apiKey = process.env[`NOTIFICATION_${channel}_API_KEY`] || process.env[`${channel}_API_KEY`] || null;
    if (!provider || !apiKey) {
      await db.notificationDeliveryAttempt.create({
        data: { tenantId, notificationId, channel, status: 'SKIPPED', provider: provider ?? null, errorMessage: 'Provider env not configured' },
      });
      return;
    }
    const failChannels = (process.env.NOTIFICATION_FAIL_CHANNELS ?? '').split(',').map((v) => v.trim().toUpperCase()).filter(Boolean);
    if (failChannels.includes(channel)) {
      await db.notificationDeliveryAttempt.create({
        data: { tenantId, notificationId, channel, status: 'FAILED', provider, errorMessage: 'Provider delivery failed' },
      });
      return;
    }
    await db.notificationDeliveryAttempt.create({
      data: { tenantId, notificationId, channel, status: 'SENT', provider, metadata: { mode: 'configured_adapter' } as any },
    });
  }
}
