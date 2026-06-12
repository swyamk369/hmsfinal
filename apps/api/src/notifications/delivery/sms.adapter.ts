/**
 * SMS delivery adapters. Supported providers (NOTIFICATION_SMS_PROVIDER):
 *   twilio | vonage | messagebird
 *
 * Required env: NOTIFICATION_SMS_API_KEY, NOTIFICATION_SMS_FROM (sender id /
 * number), and for twilio NOTIFICATION_SMS_ACCOUNT_SID (apiKey = auth token).
 */
import { httpSend, basicAuth, form } from './http';
import type { Adapter, ProviderConfig } from './types';

function requireFrom(config: ProviderConfig): string {
  if (!config.from) throw new Error('NOTIFICATION_SMS_FROM is required for SMS delivery');
  return config.from;
}

const twilio: Adapter = async (payload, config, fetchImpl) => {
  if (!config.accountSid) throw new Error('NOTIFICATION_SMS_ACCOUNT_SID is required for twilio');
  const base = config.apiBaseUrl ?? 'https://api.twilio.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: { Authorization: basicAuth(config.accountSid, config.apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ To: payload.to, From: requireFrom(config), Body: payload.text }),
    },
    config.timeoutMs,
  );
  return { provider: 'twilio', providerMessageId: parseId(res.body, 'sid') };
};

const vonage: Adapter = async (payload, config, fetchImpl) => {
  const base = config.apiBaseUrl ?? 'https://rest.nexmo.com';
  // Vonage uses api_key + api_secret; we pass api_secret via apiKey and read
  // the key from accountSid to reuse the generic config shape.
  const res = await httpSend(
    fetchImpl,
    `${base}/sms/json`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ api_key: config.accountSid, api_secret: config.apiKey, to: payload.to, from: requireFrom(config), text: payload.text }),
    },
    config.timeoutMs,
  );
  try {
    const msg = JSON.parse(res.body)?.messages?.[0];
    if (msg && msg.status !== '0') throw new Error(`Vonage error ${msg.status}: ${msg['error-text'] ?? 'unknown'}`);
    return { provider: 'vonage', providerMessageId: msg?.['message-id'] };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Vonage error')) throw e;
    return { provider: 'vonage' };
  }
};

const messagebird: Adapter = async (payload, config, fetchImpl) => {
  const base = config.apiBaseUrl ?? 'https://rest.messagebird.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `AccessKey ${config.apiKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ recipients: payload.to, originator: requireFrom(config), body: payload.text }),
    },
    config.timeoutMs,
  );
  return { provider: 'messagebird', providerMessageId: parseId(res.body, 'id') };
};

function parseId(body: string, key: string): string | undefined {
  try {
    const v = JSON.parse(body)?.[key];
    return v == null ? undefined : String(v);
  } catch {
    return undefined;
  }
}

export const SMS_ADAPTERS: Record<string, Adapter> = { twilio, vonage, messagebird };
