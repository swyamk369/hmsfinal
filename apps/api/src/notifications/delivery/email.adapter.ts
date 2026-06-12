/**
 * Email delivery adapters. One pure function per provider, all using the
 * injected fetch. Supported providers (NOTIFICATION_EMAIL_PROVIDER):
 *   sendgrid | resend | postmark | mailgun
 *
 * Required env (see .env.example): NOTIFICATION_EMAIL_API_KEY,
 * NOTIFICATION_EMAIL_FROM, and for mailgun NOTIFICATION_MAILGUN_DOMAIN.
 */
import { httpSend, basicAuth, form } from './http';
import type { Adapter, ProviderConfig } from './types';

function requireFrom(config: ProviderConfig): string {
  if (!config.from) throw new Error('NOTIFICATION_EMAIL_FROM is required for email delivery');
  return config.from;
}

const sendgrid: Adapter = async (payload, config, fetchImpl) => {
  const base = config.apiBaseUrl ?? 'https://api.sendgrid.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/v3/mail/send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: payload.to }] }],
        from: { email: requireFrom(config) },
        subject: payload.subject ?? '(no subject)',
        content: [{ type: 'text/plain', value: payload.text }],
      }),
    },
    config.timeoutMs,
  );
  return { provider: 'sendgrid', providerMessageId: res.header('X-Message-Id') ?? undefined };
};

const resend: Adapter = async (payload, config, fetchImpl) => {
  const base = config.apiBaseUrl ?? 'https://api.resend.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/emails`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: requireFrom(config), to: [payload.to], subject: payload.subject ?? '(no subject)', text: payload.text }),
    },
    config.timeoutMs,
  );
  return { provider: 'resend', providerMessageId: parseId(res.body, 'id') };
};

const postmark: Adapter = async (payload, config, fetchImpl) => {
  const base = config.apiBaseUrl ?? 'https://api.postmarkapp.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/email`,
    {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': config.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ From: requireFrom(config), To: payload.to, Subject: payload.subject ?? '(no subject)', TextBody: payload.text }),
    },
    config.timeoutMs,
  );
  return { provider: 'postmark', providerMessageId: parseId(res.body, 'MessageID') };
};

const mailgun: Adapter = async (payload, config, fetchImpl) => {
  if (!config.domain) throw new Error('NOTIFICATION_MAILGUN_DOMAIN is required for mailgun');
  const base = config.apiBaseUrl ?? 'https://api.mailgun.net';
  const res = await httpSend(
    fetchImpl,
    `${base}/v3/${config.domain}/messages`,
    {
      method: 'POST',
      headers: { Authorization: basicAuth('api', config.apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ from: requireFrom(config), to: payload.to, subject: payload.subject ?? '(no subject)', text: payload.text }),
    },
    config.timeoutMs,
  );
  return { provider: 'mailgun', providerMessageId: parseId(res.body, 'id') };
};

function parseId(body: string, key: string): string | undefined {
  try {
    const v = JSON.parse(body)?.[key];
    return v == null ? undefined : String(v);
  } catch {
    return undefined;
  }
}

export const EMAIL_ADAPTERS: Record<string, Adapter> = { sendgrid, resend, postmark, mailgun };
