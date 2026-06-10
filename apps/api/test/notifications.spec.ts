import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { emptyContext, type RequestContext } from '../src/common/types';
import { NotificationsController } from '../src/notifications/notifications.controller';
import { NotificationsService } from '../src/notifications/notifications.service';

function model() {
  return {
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  };
}

function db(): Record<string, any> {
  return {
    notification: model(),
    notificationPreference: model(),
    notificationDeliveryAttempt: model(),
    tenantUser: model(),
  };
}

function ctx(d: Record<string, any>, overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    ...emptyContext(),
    userId: 'u1',
    tenantId: 't1',
    tenantStatus: 'ACTIVE',
    membershipExists: true,
    membershipActive: true,
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

describe('Notifications auth and controller', () => {
  it('notification routes require authentication via the global auth guard', () => {
    const guard = new AuthGuard(reflector(false));
    expect(() => guard.canActivate(execFor({ userId: null }))).toThrow(UnauthorizedException);
  });

  it('controller exposes user notification endpoints', async () => {
    const svc = {
      list: jest.fn().mockResolvedValue([]),
      unreadCount: jest.fn().mockResolvedValue({ count: 0 }),
      preferences: jest.fn().mockResolvedValue([]),
      updatePreferences: jest.fn().mockResolvedValue([]),
      markRead: jest.fn(),
      readAll: jest.fn(),
      archive: jest.fn(),
    } as any;
    const controller = new NotificationsController(svc);
    const d = db();
    await controller.list(ctx(d), {});
    await controller.unreadCount(ctx(d));
    await controller.preferences(ctx(d));
    expect(svc.list).toHaveBeenCalled();
    expect(svc.unreadCount).toHaveBeenCalled();
    expect(svc.preferences).toHaveBeenCalled();
  });
});

describe('Notifications service', () => {
  let svc: NotificationsService;
  let d: Record<string, any>;

  beforeEach(() => {
    svc = new NotificationsService({ log: jest.fn().mockResolvedValue(undefined) } as any);
    d = db();
    delete process.env.NOTIFICATION_EMAIL_PROVIDER;
    delete process.env.NOTIFICATION_EMAIL_API_KEY;
    delete process.env.NOTIFICATION_FAIL_CHANNELS;
  });

  it('lists only the current user notifications in the active tenant client', async () => {
    d.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
    await svc.list(ctx(d), { read: 'unread', category: 'LAB' as any });
    expect(d.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientUserId: 'u1', readAt: null, archivedAt: null, category: 'LAB' }),
      }),
    );
  });

  it('unread count is scoped to the current recipient', async () => {
    d.notification.count.mockResolvedValue(3);
    await expect(svc.unreadCount(ctx(d))).resolves.toEqual({ count: 3 });
    expect(d.notification.count).toHaveBeenCalledWith({
      where: { recipientUserId: 'u1', readAt: null, archivedAt: null },
    });
  });

  it('cross-user notification access returns not found', async () => {
    d.notification.findFirst.mockResolvedValue(null);
    await expect(svc.markRead(ctx(d), 'n-other')).rejects.toBeInstanceOf(NotFoundException);
    expect(d.notification.findFirst).toHaveBeenCalledWith({ where: { id: 'n-other', recipientUserId: 'u1' } });
  });

  it('marks one or all notifications as read and archives one notification', async () => {
    d.notification.findFirst.mockResolvedValue({ id: 'n1', readAt: null, archivedAt: null });
    d.notification.update.mockResolvedValue({ id: 'n1', readAt: new Date() });
    d.notification.updateMany.mockResolvedValue({ count: 2 });

    await svc.markRead(ctx(d), 'n1');
    expect(d.notification.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'n1' } }));

    await expect(svc.readAll(ctx(d))).resolves.toEqual({ updated: 2 });

    await svc.archive(ctx(d), 'n1');
    expect(d.notification.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ archivedAt: expect.any(Date) }) }));
  });

  it('returns default preferences and upserts preference updates', async () => {
    d.tenantUser.findFirst.mockResolvedValue({ id: 'tu1' });
    d.notificationPreference.findMany.mockResolvedValue([]);
    const prefs = await svc.preferences(ctx(d));
    expect(prefs).toHaveLength(8);
    expect(prefs[0]).toMatchObject({ userId: 'u1', inAppEnabled: true, emailEnabled: false });

    await svc.updatePreferences(ctx(d), { preferences: [{ category: 'LAB' as any, emailEnabled: true }] });
    expect(d.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId_userId_category: { tenantId: 't1', userId: 'u1', category: 'LAB' } },
      }),
    );
  });

  it('creates in-app notifications and records SENT delivery attempts', async () => {
    d.tenantUser.findMany.mockResolvedValue([{ id: 'tu1', userId: 'u1' }]);
    d.notificationPreference.findUnique.mockResolvedValue(null);
    d.notification.create.mockResolvedValue({ id: 'n1' });

    await svc.notify(d as any, 't1', {
      category: 'LAB' as any,
      type: 'lab.result.ready',
      title: 'Lab result ready',
      message: 'A verified lab report is ready.',
      userIds: ['u1'],
    });

    expect(d.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ recipientUserId: 'u1' }) }));
    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'IN_APP', status: 'SENT' }) }),
    );
  });

  it('missing external provider env marks delivery SKIPPED', async () => {
    d.tenantUser.findMany.mockResolvedValue([{ id: 'tu1', userId: 'u1' }]);
    d.notificationPreference.findUnique.mockResolvedValue({ inAppEnabled: true, emailEnabled: true, smsEnabled: false, whatsappEnabled: false });
    d.notification.create.mockResolvedValue({ id: 'n1' });

    await svc.notify(d as any, 't1', {
      category: 'SYSTEM' as any,
      type: 'system.test',
      title: 'Test',
      message: 'Test',
      userIds: ['u1'],
      channels: ['EMAIL' as any],
    });

    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL', status: 'SKIPPED' }) }),
    );
  });

  it('configured provider failure marks delivery FAILED', async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'testmail';
    process.env.NOTIFICATION_EMAIL_API_KEY = 'key';
    process.env.NOTIFICATION_FAIL_CHANNELS = 'EMAIL';
    d.tenantUser.findMany.mockResolvedValue([{ id: 'tu1', userId: 'u1' }]);
    d.notificationPreference.findUnique.mockResolvedValue({ inAppEnabled: true, emailEnabled: true, smsEnabled: false, whatsappEnabled: false });
    d.notification.create.mockResolvedValue({ id: 'n1' });

    await svc.notify(d as any, 't1', {
      category: 'SYSTEM' as any,
      type: 'system.test',
      title: 'Test',
      message: 'Test',
      userIds: ['u1'],
      channels: ['EMAIL' as any],
    });

    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL', status: 'FAILED', provider: 'testmail' }) }),
    );
  });

  it('safeNotify swallows notification failures so workflow actions do not roll back', async () => {
    d.tenantUser.findMany.mockRejectedValue(new Error('notification table unavailable'));
    await expect(
      svc.safeNotify(ctx(d), {
        category: 'BILLING' as any,
        type: 'payment.receipt',
        title: 'Payment received',
        message: 'Receipt ready',
        roleCodes: ['BILLING'],
      }),
    ).resolves.toBeUndefined();
  });
});
