/**
 * External delivery entry point. `resolveProviderConfig` reads the per-channel
 * env contract; `dispatchDelivery` routes a payload to the right provider
 * adapter. Both are kept out of the service so they can be unit-tested with a
 * stubbed fetch and a hand-built config.
 *
 * Env contract (CH = EMAIL | SMS | WHATSAPP):
 *   NOTIFICATION_<CH>_PROVIDER      provider name (sendgrid, twilio, meta, ...)
 *   NOTIFICATION_<CH>_API_KEY       provider api key / token / auth token
 *   NOTIFICATION_<CH>_FROM          sender (email from-address or phone number)
 *   NOTIFICATION_<CH>_ACCOUNT_SID   twilio account sid / vonage api key
 *   NOTIFICATION_<CH>_API_BASE_URL  override provider base url (tests/staging)
 *   NOTIFICATION_MAILGUN_DOMAIN     mailgun sending domain (email only)
 *   NOTIFICATION_WHATSAPP_PHONE_NUMBER_ID   meta cloud api phone-number id
 *   NOTIFICATION_TIMEOUT_MS         per-request timeout (default 10000)
 * Legacy fallback (<CH>_PROVIDER / <CH>_API_KEY) is still honoured.
 */
import { EMAIL_ADAPTERS } from './email.adapter';
import { SMS_ADAPTERS } from './sms.adapter';
import { WHATSAPP_ADAPTERS } from './whatsapp.adapter';
import type { Adapter, DeliveryChannel, DeliveryPayload, DeliveryResult, FetchImpl, ProviderConfig } from './types';

export * from './types';

const REGISTRIES: Record<DeliveryChannel, Record<string, Adapter>> = {
  EMAIL: EMAIL_ADAPTERS,
  SMS: SMS_ADAPTERS,
  WHATSAPP: WHATSAPP_ADAPTERS,
};

const env = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : undefined;
};

const timeoutMs = (): number => {
  const raw = Number(env('NOTIFICATION_TIMEOUT_MS') ?? '10000');
  return Number.isFinite(raw) && raw > 0 ? raw : 10000;
};

/** Returns null when the channel is not configured; caller records SKIPPED. */
export function resolveProviderConfig(channel: DeliveryChannel): ProviderConfig | null {
  const provider = env(`NOTIFICATION_${channel}_PROVIDER`) ?? env(`${channel}_PROVIDER`);
  const apiKey = env(`NOTIFICATION_${channel}_API_KEY`) ?? env(`${channel}_API_KEY`);
  if (!provider || !apiKey) return null;
  return {
    provider: provider.toLowerCase(),
    apiKey,
    from: env(`NOTIFICATION_${channel}_FROM`),
    accountSid: env(`NOTIFICATION_${channel}_ACCOUNT_SID`),
    domain: env('NOTIFICATION_MAILGUN_DOMAIN') ?? env('NOTIFICATION_EMAIL_DOMAIN'),
    phoneNumberId: env('NOTIFICATION_WHATSAPP_PHONE_NUMBER_ID'),
    apiBaseUrl: env(`NOTIFICATION_${channel}_API_BASE_URL`),
    timeoutMs: timeoutMs(),
  };
}

export function supportedProviders(channel: DeliveryChannel): string[] {
  return Object.keys(REGISTRIES[channel] ?? {});
}

/** Routes to the configured provider adapter. Throws on unknown provider or send failure. */
export async function dispatchDelivery(
  payload: DeliveryPayload,
  config: ProviderConfig,
  fetchImpl: FetchImpl = globalThis.fetch as unknown as FetchImpl,
): Promise<DeliveryResult> {
  const registry = REGISTRIES[payload.channel];
  if (!registry) throw new Error(`Unsupported delivery channel: ${payload.channel}`);
  const adapter = registry[config.provider];
  if (!adapter) {
    throw new Error(
      `Unknown ${payload.channel} provider "${config.provider}". Supported: ${Object.keys(registry).join(', ')}`,
    );
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation available (Node >=18 required)');
  }
  return adapter(payload, config, fetchImpl);
}
