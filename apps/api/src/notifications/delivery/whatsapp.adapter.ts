/**
 * WhatsApp delivery adapters. Supported providers (NOTIFICATION_WHATSAPP_PROVIDER):
 *   twilio | meta
 *
 * twilio: NOTIFICATION_WHATSAPP_ACCOUNT_SID (apiKey = auth token),
 *         NOTIFICATION_WHATSAPP_FROM = a WhatsApp-enabled sender number.
 * meta:   NOTIFICATION_WHATSAPP_API_KEY = access token,
 *         NOTIFICATION_WHATSAPP_PHONE_NUMBER_ID = Cloud API phone-number id.
 */
import { httpSend, basicAuth, form } from './http';
import type { Adapter, ProviderConfig } from './types';

/** Twilio expects the `whatsapp:` URI scheme on both ends. */
function wa(number: string): string {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

function requireFrom(config: ProviderConfig): string {
  if (!config.from) throw new Error('NOTIFICATION_WHATSAPP_FROM is required for WhatsApp delivery');
  return config.from;
}

const twilio: Adapter = async (payload, config, fetchImpl) => {
  if (!config.accountSid) throw new Error('NOTIFICATION_WHATSAPP_ACCOUNT_SID is required for twilio');
  const base = config.apiBaseUrl ?? 'https://api.twilio.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: { Authorization: basicAuth(config.accountSid, config.apiKey), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ To: wa(payload.to), From: wa(requireFrom(config)), Body: payload.text }),
    },
    config.timeoutMs,
  );
  return { provider: 'twilio', providerMessageId: parseId(res.body, 'sid') };
};

const meta: Adapter = async (payload, config, fetchImpl) => {
  if (!config.phoneNumberId) throw new Error('NOTIFICATION_WHATSAPP_PHONE_NUMBER_ID is required for meta');
  const base = config.apiBaseUrl ?? 'https://graph.facebook.com';
  const res = await httpSend(
    fetchImpl,
    `${base}/v19.0/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: payload.to.replace(/^whatsapp:/, ''),
        type: 'text',
        text: { body: payload.text },
      }),
    },
    config.timeoutMs,
  );
  let id: string | undefined;
  try {
    id = JSON.parse(res.body)?.messages?.[0]?.id;
  } catch {
    id = undefined;
  }
  return { provider: 'meta', providerMessageId: id };
};

function parseId(body: string, key: string): string | undefined {
  try {
    const v = JSON.parse(body)?.[key];
    return v == null ? undefined : String(v);
  } catch {
    return undefined;
  }
}

export const WHATSAPP_ADAPTERS: Record<string, Adapter> = { twilio, meta };
