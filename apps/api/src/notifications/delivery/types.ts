/**
 * External notification delivery - shared types.
 *
 * Adapters are PURE: they take a resolved payload + provider config and perform
 * a single HTTP send, returning a provider message id on success or throwing on
 * failure. All env reading happens in `resolveProviderConfig` (./config) so the
 * adapters stay unit-testable with an injected `fetchImpl`.
 */

export type DeliveryChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export interface DeliveryPayload {
  channel: DeliveryChannel;
  /** Destination: an email address (EMAIL) or E.164 phone number (SMS/WHATSAPP). */
  to: string;
  /** Email subject line; ignored by SMS/WhatsApp. */
  subject?: string;
  /** Plain-text body. */
  text: string;
}

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  /** Sender: "from" email address, or sender phone / WhatsApp number. */
  from?: string;
  /** Twilio account SID (SMS/WhatsApp via Twilio). apiKey is the auth token. */
  accountSid?: string;
  /** Mailgun sending domain. */
  domain?: string;
  /** Meta WhatsApp Cloud API phone-number id. apiKey is the access token. */
  phoneNumberId?: string;
  /** Override the provider API base URL (used by tests). */
  apiBaseUrl?: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

export interface DeliveryResult {
  /** Provider-assigned message id, when the provider returns one. */
  providerMessageId?: string;
  /** Provider name that handled the send (echoed for the delivery record). */
  provider: string;
}

/** Minimal fetch signature so tests can inject a stub without DOM lib types. */
export type FetchImpl = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  headers: { get: (name: string) => string | null };
}>;

export type Adapter = (
  payload: DeliveryPayload,
  config: ProviderConfig,
  fetchImpl: FetchImpl,
) => Promise<DeliveryResult>;
