<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Webhooks

The plugin handles webhooks in both directions:

| Direction | Description | Tier |
|---|---|---|
| **Outbound** | WordPress fires an HTTP request to an external URL when an event occurs | Free + Pro |
| **Incoming** | An external service calls a plugin endpoint to trigger an automation or action | **Pro only** |

---

## Outbound Webhooks

Outbound webhooks send an HTTP request to an external URL when an event fires. Delivery is asynchronous and does not block the triggering request.

The free tier supports **one outbound webhook** with a built-in post lifecycle event selector. Pro supports **unlimited webhooks** scoped per application — events and triggering logic are managed in [Automations](/automations/automations).

### Webhooks List <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span>

The list view manages all webhook entries for the current application.

- **Add** a new webhook with the add button.
- **Enable / Disable** an entry with the toggle. A confirmation is shown before the change is applied.
- **Delete** an entry. A confirmation is shown before deletion proceeds.

### Webhook Editor

#### Identity

- **Title** — display name used in the admin list.
- **Description** — optional notes for your own reference.

#### Endpoint

- **URL** — the destination that will receive the request.
- **HTTP Method** — `POST`, `PUT`, `PATCH` or `DELETE`.

#### Security

- **HMAC Key** — use the generator to create a signing key, or paste your own. The key is used to sign the outgoing payload so the receiver can verify its origin. See [Verifying outbound payloads](#verifying-outbound-payloads) below.
- **Additional Headers** — key/value pairs added to every outgoing request (e.g. `Authorization`, `X-Api-Key`).

#### Delivery

- **Timeout** — maximum time in seconds to wait for a response from the destination before the request is considered failed.
- **Retry Count** — number of times delivery is reattempted after a failure before giving up.

#### Free Tier — Post Lifecycle Events

In the free tier, the webhook editor includes a simplified event selector directly in the panel. Select one or more **post lifecycle events** (create, update, delete — filterable by post type) that will trigger the webhook. This is the only event configuration available outside of Pro Automations.

---

## Incoming Webhooks <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span>

Incoming webhooks allow external services — payment processors, CRMs, CI/CD pipelines, IoT devices, or any HTTP-capable system — to push events into WordPress and trigger automations or direct plugin actions.

Each incoming webhook entry exposes a **unique, application-scoped endpoint URL**. The external service calls this URL with a JSON payload. The plugin verifies the HMAC signature before processing.

### How It Works

```
External service
       │  POST {payload} + HMAC headers
       ▼
┌─────────────────────────┐
│  Incoming Webhook URL   │  ← Unique endpoint per entry
└────────────┬────────────┘
             │  Signature verified?
             ▼
┌─────────────────────────┐
│  Automation Trigger     │  ← "Incoming Webhook" event fires
└────────────┬────────────┘
             │
       Conditions → Actions (emails, outbound webhooks, hooks…)
```

### Incoming Webhook Editor

#### Endpoint

The plugin generates a unique **Endpoint URL** for each incoming webhook entry. Copy this URL and configure it as the destination in your external service.

#### Security — HMAC Key

Use the generator to create a signing key, or paste the key provided by your external service. The plugin uses this key to verify every incoming request.

If the signature check fails, the request is rejected with a `401` response and no automation is triggered.

#### Connecting to an Automation

Set the **Automation** field to the automation this endpoint should trigger. When a valid request arrives, the automation fires with the incoming payload available as hook arguments. See [Automations — Incoming Webhook event](/automations/automations#incoming-webhook-event) for details on accessing payload fields in conditions and actions.

### Signing Incoming Requests

The plugin expects the same HMAC-SHA256 scheme used for outbound webhooks. Configure your external service to attach these headers:

| Header | Value |
|---|---|
| `X-Webhook-Signature` | Hex digest: `HMAC-SHA256(rawBody + timestamp, secret)` |
| `X-Webhook-Timestamp` | Unix timestamp (seconds) at send time |

**Node.js — signing an outgoing request to the plugin:**

```js
import { createHmac } from 'node:crypto'

export function signPayload(rawBody, secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = createHmac('sha256', secret)
    .update(rawBody + timestamp)
    .digest('hex')
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
  }
}
```

---

## Verifying Outbound Payloads

The plugin signs every **outgoing** request with HMAC-SHA256 using the same scheme. Three headers are always present:

| Header | Description |
|---|---|
| `X-Webhook-Signature` | Hex digest: `HMAC-SHA256(rawBody + timestamp, secret)` |
| `X-Webhook-Timestamp` | Unix timestamp (seconds) at send time |
| `X-Webhook-Source` | Always `wordpress` |

The signature is computed over the **raw JSON body string concatenated with the timestamp string** (no separator), using your HMAC key as the secret.

**JavaScript (Node.js)**

```js
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWebhook(rawBody, headers, secret) {
  const signature = headers['x-webhook-signature']
  const timestamp = headers['x-webhook-timestamp']

  if (!signature || !timestamp) return false

  const expected = createHmac('sha256', secret)
    .update(rawBody + timestamp)
    .digest('hex')

  const sigBuf      = Buffer.from(signature, 'hex')
  const expectedBuf = Buffer.from(expected,  'hex')

  if (sigBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(sigBuf, expectedBuf)
}
```

**TypeScript**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const signature = headers['x-webhook-signature'] as string | undefined
  const timestamp = headers['x-webhook-timestamp'] as string | undefined

  if (!signature || !timestamp) return false

  const expected = createHmac('sha256', secret)
    .update(rawBody + timestamp)
    .digest('hex')

  const sigBuf      = Buffer.from(signature, 'hex')
  const expectedBuf = Buffer.from(expected,  'hex')

  if (sigBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(sigBuf, expectedBuf)
}
```

> Use `timingSafeEqual` to prevent timing attacks. Read the raw request body **before** any JSON parsing so the string is byte-for-byte identical to what was signed.

---

## FAQ

**How are outbound webhooks triggered in Pro?**

In Pro, outbound webhooks are fired by [Automations](/automations/automations). An automation selects the event, evaluates any conditions, and calls the webhook as an action. This separates event logic from delivery configuration.

**Can I send the same payload to multiple URLs?**

Create one webhook entry per destination. In Pro, point multiple automation actions at each webhook entry.

**Can an incoming webhook trigger multiple actions?**

Yes. The automation connected to the incoming endpoint can have as many actions as needed — multiple emails, multiple outbound webhooks, custom hooks, and so on.

**What response does the plugin send to an incoming webhook?**

A `200 OK` with a JSON acknowledgment once the signature is verified and the automation is queued. If the signature check fails, the response is `401 Unauthorized`. If no automation is configured or enabled, the response is `404`.

**Can I replay a failed incoming webhook?**

Replay is handled by the external service — it simply re-sends the request to the same endpoint URL. The plugin processes each valid request independently.
