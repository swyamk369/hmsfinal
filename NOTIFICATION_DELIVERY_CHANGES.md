# Change Report — External Notification Delivery (Email / SMS / WhatsApp)

**Date:** 2026-06-13 · **Area:** `apps/api` notifications module · **Status:** implemented, typecheck clean, tests green (24/24)

---

## 1. Summary

The notifications service previously recorded external deliveries (EMAIL / SMS / WhatsApp)
as a **fake `SENT`** — it wrote a `metadata: { mode: 'configured_adapter' }` row without ever
contacting a provider. This change implements **real outbound delivery**: when a channel is
configured, the notification is actually sent through a provider HTTP API and the provider's
message id is recorded; failures are captured as `FAILED` with the real error. When a channel
is **not** configured, behaviour is unchanged — it records `SKIPPED` and the in-app
notification still works.

No new npm dependencies were added — delivery uses Node's built-in `fetch` (Node ≥ 18).

---

## 2. Delivery outcome semantics (new)

| Situation                                         | Recorded status | Detail stored                                                      |
| ------------------------------------------------- | --------------- | ------------------------------------------------------------------ |
| Channel has no `PROVIDER` + `API_KEY`             | `SKIPPED`       | `errorMessage: "Provider env not configured"` (unchanged contract) |
| Configured, provider accepts the send             | `SENT`          | `metadata.providerMessageId`                                       |
| Configured, provider errors / times out           | `FAILED`        | real error message (HTTP status + truncated body, no secrets)      |
| Recipient has no email / phone on file            | `SKIPPED`       | `errorMessage: "No email/phone on file for recipient"`             |
| `NOTIFICATION_DRY_RUN=1`                          | `SENT`          | `metadata.mode = "dry_run"` (no network call)                      |
| `NOTIFICATION_FAIL_CHANNELS=<CH>` (test/ops hook) | `FAILED`        | forced, no network call                                            |
| `IN_APP`                                          | `SENT`          | unchanged (`provider: "database"`)                                 |

---

## 3. Files added

All under `apps/api/src/notifications/delivery/` (pure, unit-testable adapters):

| File                  | LOC | Purpose                                                                                                                               |
| --------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`            | 66  | Shared types: `DeliveryPayload`, `ProviderConfig`, `Adapter`, injectable `FetchImpl`.                                                 |
| `http.ts`             | 54  | `fetch` wrapper with `AbortController` timeout; turns non-2xx into safe, truncated errors; `basicAuth` + form helpers.                |
| `email.adapter.ts`    | 96  | Providers: **sendgrid, resend, postmark, mailgun**.                                                                                   |
| `sms.adapter.ts`      | 80  | Providers: **twilio, vonage, messagebird**.                                                                                           |
| `whatsapp.adapter.ts` | 75  | Providers: **twilio, meta** (WhatsApp Cloud API).                                                                                     |
| `index.ts`            | 75  | `resolveProviderConfig(channel)` (reads env), `dispatchDelivery(payload, config)` (routes to adapter), `supportedProviders(channel)`. |

Test:

| File                                          | LOC | Coverage                                                                                                                                                                                                       |
| --------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/test/notification-delivery.spec.ts` | 231 | Config resolution, per-channel dispatch (sendgrid/twilio/meta), unknown-provider + HTTP-error + missing-sender errors, and service-level `SENT` / `FAILED` / `SKIPPED` / `DRY_RUN` paths with a stubbed fetch. |

## 4. Files modified

| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/notifications/notifications.service.ts` | Recipient resolution now selects each user's `email` + `phone`; `Recipient` carries them. `recordDelivery` rewritten to resolve the destination address, dispatch to the configured provider, and record `SENT` (with provider message id) / `FAILED` / `SKIPPED`. Added `NOTIFICATION_DRY_RUN` handling, retained the `NOTIFICATION_FAIL_CHANNELS` hook, and added a `renderBody()` helper (title + message + deep link as plain text). (+109 / −36) |
| `.env.example`                                        | Documented every new env var: providers per channel, `*_FROM`, Twilio `*_ACCOUNT_SID`, Mailgun domain, Meta `*_PHONE_NUMBER_ID`, `NOTIFICATION_TIMEOUT_MS`, `NOTIFICATION_DRY_RUN`, `NOTIFICATION_<CH>_API_BASE_URL`. (+32)                                                                                                                                                                                                                           |

---

## 5. Environment variables (new)

Env contract per channel `<CH>` ∈ {`EMAIL`, `SMS`, `WHATSAPP`}:

```
NOTIFICATION_<CH>_PROVIDER       provider name (sendgrid, twilio, meta, …)
NOTIFICATION_<CH>_API_KEY        api key / token / auth token
NOTIFICATION_<CH>_FROM           sender (email from-address or phone number)
NOTIFICATION_<CH>_ACCOUNT_SID    Twilio account SID (also Vonage api key)
NOTIFICATION_<CH>_API_BASE_URL   override provider base URL (tests / staging)
NOTIFICATION_MAILGUN_DOMAIN      Mailgun sending domain (email only)
NOTIFICATION_WHATSAPP_PHONE_NUMBER_ID   Meta Cloud API phone-number id
NOTIFICATION_TIMEOUT_MS          per-send HTTP timeout (default 10000)
NOTIFICATION_DRY_RUN             1/true = record SENT without calling the provider
```

Legacy `<CH>_PROVIDER` / `<CH>_API_KEY` fallback is still honoured. All optional — unset = `SKIPPED`.

**Provider-specific quick reference:** mailgun also needs `NOTIFICATION_MAILGUN_DOMAIN`;
Twilio (SMS/WhatsApp) needs `*_ACCOUNT_SID` (the API key is the auth token) and a `*_FROM`
number; Meta WhatsApp needs `*_PHONE_NUMBER_ID` (the API key is the access token).

---

## 6. Verification

| Check                                                             | Result                              |
| ----------------------------------------------------------------- | ----------------------------------- |
| `tsc -p apps/api/tsconfig.json --noEmit`                          | ✅ exit 0                           |
| `jest --runInBand notifications notification-delivery`            | ✅ **24/24 passed**, 2 suites       |
| Existing `notifications.spec.ts` (SKIPPED / FAILED / IN_APP SENT) | ✅ still green (contract preserved) |

> The **full** API suite (target 278) should be run on macOS — this Linux sandbox cannot load
> the Prisma query engine (client was generated for `darwin-arm64`), which is unrelated to this
> change. Run: `pnpm --filter @hms/api exec jest --runInBand`.

---

## 7. Compatibility & safety notes

- **Backwards compatible:** no schema change, no migration. The `notification_delivery_attempt`
  model already had `provider`, `errorMessage`, `metadata`, and the `SENT/FAILED/SKIPPED` enum.
- **Non-blocking sends:** delivery runs inside the existing `safeNotify` guard, so a provider
  outage never rolls back the clinical/financial action that triggered the notification.
- **No secret leakage:** adapters never place the API key in a stored error; HTTP error bodies
  are truncated to 300 chars before logging/storing.
- **Tenant isolation unaffected:** delivery records are still written through the tenant-scoped
  client; no `rawPrisma` / `platformDb` use.

## 8. Suggested follow-ups (not in this change)

- Move external sends to a **queue/worker with retries + backoff** for high volume (currently
  inline best-effort).
- Add a **delivery-status webhook** ingest (Twilio/SendGrid callbacks) to advance `SENT` →
  `DELIVERED`/`BOUNCED`.
- Per-tenant provider credentials (currently process-level env, shared across tenants).

## 9. Commit

Not yet committed. Suggested message:

```
feat(notifications): real email/SMS/WhatsApp delivery adapters

Replace the placeholder "configured_adapter" SENT record with real provider
dispatch (sendgrid/resend/postmark/mailgun, twilio/vonage/messagebird,
twilio/meta). Record provider message id on SENT, real error on FAILED, SKIPPED
when unconfigured or no address. Add DRY_RUN, env docs, and unit tests.
```
