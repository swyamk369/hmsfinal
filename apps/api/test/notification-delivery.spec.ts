import { dispatchDelivery, resolveProviderConfig, supportedProviders } from '../src/notifications/delivery';
import type { FetchImpl } from '../src/notifications/delivery';
import { NotificationsService } from '../src/notifications/notifications.service';
import { emptyContext, type RequestContext } from '../src/common/types';

/** Build a stub fetch that records the call and returns a canned response. */
function stubFetch(opts: { ok?: boolean; status?: number; body?: string; header?: string }): {
  impl: FetchImpl;
  calls: Array<{ url: string; init?: any }>;
} {
  const calls: Array<{ url: string; init?: any }> = [];
  const impl: FetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      text: async () => opts.body ?? '{}',
      headers: { get: (n: string) => (n === 'X-Message-Id' ? (opts.header ?? null) : null) },
    };
  };
  return { impl, calls };
}

const CONFIG_ENV = [
  'NOTIFICATION_EMAIL_PROVIDER',
  'NOTIFICATION_EMAIL_API_KEY',
  'NOTIFICATION_EMAIL_FROM',
  'NOTIFICATION_EMAIL_API_BASE_URL',
  'NOTIFICATION_SMS_PROVIDER',
  'NOTIFICATION_SMS_API_KEY',
  'NOTIFICATION_DRY_RUN',
  'NOTIFICATION_FAIL_CHANNELS',
];
function clearEnv() {
  for (const k of CONFIG_ENV) delete process.env[k];
}

describe('delivery config resolution', () => {
  beforeEach(clearEnv);
  afterAll(clearEnv);

  it('returns null when provider/key are not configured', () => {
    expect(resolveProviderConfig('EMAIL')).toBeNull();
  });

  it('resolves a normalized config from env', () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'SendGrid';
    process.env.NOTIFICATION_EMAIL_API_KEY = 'sg-key';
    process.env.NOTIFICATION_EMAIL_FROM = 'noreply@hospital.com';
    const cfg = resolveProviderConfig('EMAIL')!;
    expect(cfg.provider).toBe('sendgrid'); // lower-cased
    expect(cfg.apiKey).toBe('sg-key');
    expect(cfg.from).toBe('noreply@hospital.com');
  });

  it('lists supported providers per channel', () => {
    expect(supportedProviders('EMAIL')).toEqual(expect.arrayContaining(['sendgrid', 'resend', 'postmark', 'mailgun']));
    expect(supportedProviders('SMS')).toEqual(expect.arrayContaining(['twilio']));
    expect(supportedProviders('WHATSAPP')).toEqual(expect.arrayContaining(['twilio', 'meta']));
  });
});

describe('dispatchDelivery', () => {
  it('sends email via sendgrid and returns the provider message id', async () => {
    const { impl, calls } = stubFetch({ status: 202, header: 'msg-123' });
    const res = await dispatchDelivery(
      { channel: 'EMAIL', to: 'p@x.com', subject: 'Hi', text: 'Body' },
      { provider: 'sendgrid', apiKey: 'k', from: 'noreply@x.com' },
      impl,
    );
    expect(res).toEqual({ provider: 'sendgrid', providerMessageId: 'msg-123' });
    expect(calls[0].url).toContain('/v3/mail/send');
    expect(calls[0].init.headers.Authorization).toBe('Bearer k');
  });

  it('sends SMS via twilio using basic auth + form body', async () => {
    const { impl, calls } = stubFetch({ body: '{"sid":"SM1"}' });
    const res = await dispatchDelivery(
      { channel: 'SMS', to: '+15550001', text: 'Body' },
      { provider: 'twilio', apiKey: 'token', accountSid: 'AC1', from: '+15559999' },
      impl,
    );
    expect(res.providerMessageId).toBe('SM1');
    expect(calls[0].url).toContain('/Accounts/AC1/Messages.json');
    expect(calls[0].init.headers.Authorization).toMatch(/^Basic /);
  });

  it('prefixes whatsapp: for the meta cloud api', async () => {
    const { impl, calls } = stubFetch({ body: '{"messages":[{"id":"wamid.1"}]}' });
    const res = await dispatchDelivery(
      { channel: 'WHATSAPP', to: '+15550001', text: 'Body' },
      { provider: 'meta', apiKey: 'token', phoneNumberId: 'PN1' },
      impl,
    );
    expect(res.providerMessageId).toBe('wamid.1');
    expect(calls[0].url).toContain('/PN1/messages');
  });

  it('throws on an unknown provider', async () => {
    const { impl } = stubFetch({});
    await expect(
      dispatchDelivery(
        { channel: 'EMAIL', to: 'p@x.com', text: 'B' },
        { provider: 'nope', apiKey: 'k', from: 'f@x.com' },
        impl,
      ),
    ).rejects.toThrow(/Unknown EMAIL provider/);
  });

  it('throws with a truncated body on a non-2xx response', async () => {
    const { impl } = stubFetch({ ok: false, status: 401, body: 'Unauthorized' });
    await expect(
      dispatchDelivery(
        { channel: 'EMAIL', to: 'p@x.com', text: 'B' },
        { provider: 'sendgrid', apiKey: 'bad', from: 'f@x.com' },
        impl,
      ),
    ).rejects.toThrow(/HTTP 401/);
  });

  it('requires a sender (from) for email', async () => {
    const { impl } = stubFetch({});
    await expect(
      dispatchDelivery({ channel: 'EMAIL', to: 'p@x.com', text: 'B' }, { provider: 'sendgrid', apiKey: 'k' }, impl),
    ).rejects.toThrow(/NOTIFICATION_EMAIL_FROM/);
  });
});

describe('NotificationsService external delivery', () => {
  function model() {
    return {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ inAppEnabled: false, emailEnabled: true, smsEnabled: false, whatsappEnabled: false }),
      findMany: jest.fn().mockResolvedValue([{ id: 'tu1', userId: 'u1', user: { email: 'p@x.com', phone: '+1555' } }]),
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

  const realFetch = globalThis.fetch;
  afterEach(() => {
    (globalThis as any).fetch = realFetch;
    clearEnv();
  });

  it('records SENT with the provider message id when the provider accepts the send', async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'sendgrid';
    process.env.NOTIFICATION_EMAIL_API_KEY = 'k';
    process.env.NOTIFICATION_EMAIL_FROM = 'noreply@x.com';
    (globalThis as any).fetch = stubFetch({ status: 202, header: 'sg-99' }).impl;

    const svc = new NotificationsService({ log: jest.fn() } as any);
    const d = db();
    await svc.notify(d as any, 't1', {
      category: 'SYSTEM' as any,
      type: 'system.test',
      title: 'Hi',
      message: 'Body',
      userIds: ['u1'],
      channels: ['EMAIL' as any],
    });

    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: 'EMAIL',
          status: 'SENT',
          provider: 'sendgrid',
          metadata: { providerMessageId: 'sg-99' },
        }),
      }),
    );
  });

  it('records FAILED when the provider call throws', async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'sendgrid';
    process.env.NOTIFICATION_EMAIL_API_KEY = 'k';
    process.env.NOTIFICATION_EMAIL_FROM = 'noreply@x.com';
    (globalThis as any).fetch = stubFetch({ ok: false, status: 500, body: 'boom' }).impl;

    const svc = new NotificationsService({ log: jest.fn() } as any);
    const d = db();
    await svc.notify(d as any, 't1', {
      category: 'SYSTEM' as any,
      type: 'system.test',
      title: 'Hi',
      message: 'Body',
      userIds: ['u1'],
      channels: ['EMAIL' as any],
    });

    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'EMAIL', status: 'FAILED', provider: 'sendgrid' }),
      }),
    );
  });

  it('records SKIPPED when the recipient has no address on file', async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'sendgrid';
    process.env.NOTIFICATION_EMAIL_API_KEY = 'k';
    process.env.NOTIFICATION_EMAIL_FROM = 'noreply@x.com';
    const svc = new NotificationsService({ log: jest.fn() } as any);
    const d = db();
    d.tenantUser.findMany.mockResolvedValue([{ id: 'tu1', userId: 'u1', user: { email: null, phone: null } }]);

    await svc.notify(d as any, 't1', {
      category: 'SYSTEM' as any,
      type: 'system.test',
      title: 'Hi',
      message: 'Body',
      userIds: ['u1'],
      channels: ['EMAIL' as any],
    });

    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL', status: 'SKIPPED' }) }),
    );
  });

  it('DRY_RUN records SENT without calling the network', async () => {
    process.env.NOTIFICATION_EMAIL_PROVIDER = 'sendgrid';
    process.env.NOTIFICATION_EMAIL_API_KEY = 'k';
    process.env.NOTIFICATION_EMAIL_FROM = 'noreply@x.com';
    process.env.NOTIFICATION_DRY_RUN = '1';
    const fetchSpy = jest.fn();
    (globalThis as any).fetch = fetchSpy;

    const svc = new NotificationsService({ log: jest.fn() } as any);
    const d = db();
    await svc.notify(d as any, 't1', {
      category: 'SYSTEM' as any,
      type: 'system.test',
      title: 'Hi',
      message: 'Body',
      userIds: ['u1'],
      channels: ['EMAIL' as any],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(d.notificationDeliveryAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', metadata: { mode: 'dry_run' } }) }),
    );
  });
});
