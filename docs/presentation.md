# What is WordPress Application Layer?

WordPress Application Layer sits between WordPress and your client applications.

It lets you control what data is exposed, who can access it, how it is shaped, and at what rate, while also hardening key WordPress surfaces such as login and IP access.

Beyond REST API responses, it can also **drive your front-end through webhooks**. WordPress events (post publish, user register, WooCommerce order, custom CRON...) can push data to your application in real time using the same schema as the REST API.

You can combine both approaches, or rely on webhooks only.

It is designed for:
- **Headless WordPress** architectures (Next.js, Nuxt, SvelteKit, React, Vue, mobile apps)
- **Multi-application** setups where multiple clients share one WordPress back-end
- **Event-driven** architectures fed by webhooks instead of, or alongside, pull-based REST calls
- Any site that needs **security hardening across both REST API and WordPress surfaces**

---

## Core Capabilities

**Secure Your WordPress** — The first REST API firewall purpose-built for WordPress. IP filtering, rate limiting, login hardening, XML-RPC protection, file security, HTTP security headers. One unified security layer for the REST API and the entire WordPress platform.

**Isolate Multiple Applications** — Serve 10 different clients from one WordPress backend. Each application gets its own authentication context, custom data view, isolated webhooks, and independent rate limits. Complete isolation. True multi-tenancy.

**Shape Data Your Way** — Design custom REST API responses without code. Drag-and-drop property controls inspired by Firebase. Rename, resolve, remove, and remap fields. Free for global transforms; Pro adds unlimited per-property control and fully custom JSON schemas.

**Automate Everything End-to-End** — Chain complex workflows: WordPress events → automations → webhooks → external services → incoming webhooks → WordPress. No code required, no external services needed.

---

## Understand the Architecture

The plugin centers on REST API policy and response control, and also includes WordPress-wide protections such as global IP filtering and login hardening. Admin-authenticated requests are forwarded untouched where relevant, so normal WordPress administration workflows remain intact.

**REST API request pipeline:**

```
Incoming REST request
       │
       ▼
┌─────────────────────────┐
│  Global IP Filtering    │  ← Shared blocklist: IPs, CIDRs, countries (free + Pro)
└────────────┬────────────┘
             │  blocked → 403
             ▼
┌─────────────────────────┐
│  Application Matching   │  ← Which application owns this request? (Pro)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│  Authentication Check   │  ← JWT / WP App Passwords
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│  IP / Rate Limiting     │  ← Per-app IP blocks, per-user quotas, GeoIP (Pro)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│    Routes Policy        │  ← Allowed methods, route-level rules (Pro)
└────────────┬────────────┘
             │
┌────────────▼────────────┐
│  WordPress REST API     │  ← Native WP handler
└────────────┘────────────┘
             │
┌────────────▼────────────┐
│  Property Transforms    │  ← Models: rename, remove, resolve, remap fields
└────────────┬────────────┘
             │
       REST Response
```

Alongside this pipeline, **webhooks and email notifications** run independently of REST requests. Any WordPress event (post transitions, user actions, WooCommerce hooks, custom CRON, REST API hits) can trigger an outbound webhook and/or an email notification — scoped per application in Pro.

The flow also works in reverse: **incoming webhooks** let external services push events into WordPress and trigger automations directly (Pro).

**Outbound (push) pipeline:**

```
WordPress Event (post publish, order created, cron, …)
       │
       ▼
┌─────────────────────────┐
│  Automation / Trigger   │  ← Conditions, chained actions (Pro)
└────────────┬────────────┘
             │
       ┌─────┴──────┐
       ▼            ▼
┌────────────┐  ┌────────────┐
│  Webhook   │  │   Email    │
│  (push)    │  │ Notification│
└────────────┘  └────────────┘
```

**Incoming (pull) pipeline:** <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span>

```
External Service (Stripe, GitHub, CRM, IoT, …)
       │  POST + HMAC signature
       ▼
┌─────────────────────────┐
│  Incoming Webhook URL   │  ← Unique endpoint per entry, signature verified
└────────────┬────────────┘
             │  valid → fire automation
             ▼
┌─────────────────────────┐
│  Automation / Trigger   │  ← Payload fields available in conditions & actions
└────────────┬────────────┘
             │
       ┌─────┴──────┐
       ▼            ▼
┌────────────┐  ┌────────────┐
│  Webhook   │  │   Email    │
│  (push)    │  │ Notification│
└────────────┘  └────────────┘
```

---

## Explore Free Features

| Feature | Description |
|---|---|
| **Authentication** | JWT and hardened WordPress Application Passwords (scoped to single authorized user) |
| **Per-User Rate Limiting** | Configurable request quotas with auto-blacklist on violations |
| **Auth Hardening** | Login form protection: rate limiting, brute-force prevention, configurable lockout |
| **Global IP Filtering** | Manual IPv4/IPv6 blacklisting, auto-blacklist on rate limit violations, read-only GeoIP stats |
| **Routes Control** | Enforce authentication globally, disable sensitive routes (`/users`, `/settings`), explore all routes with per-route test buttons |
| **Response Transforms** | Sitewide rules: resolve embedded data, flatten rendered fields, strip WordPress domain from URLs |
| **WordPress Security** | Disable XML-RPC, comments, pingbacks, RSS; enforce security headers; secure file permissions |
| **Webhook** | Single outbound webhook with customizable event triggers |
| **Hooks & Filters API** | Extend every feature with WordPress filters for customization |

## Explore Pro Features

| Feature | Description |
|---|---|
| **Multi-Application Isolation** | Serve multiple clients with independent auth contexts, IP rules, webhooks, and logs |
| **Unlimited Users per Application** | No user limits per application instance |
| **WordPress Mode** | "Application Only Mode" enforces headless-only access; trusted IPs bypass restrictions; emergency reset token enables lockout recovery |
| **Advanced IP Filtering** | CIDR ranges, country-level blocking (GeoIP), configurable retention, per-application IP whitelisting and origin restrictions |
| **Per-Route Policies** | Control each route individually: restrict by HTTP method, user, IP, or origin; set custom responses; disable without breaking other plugins |
| **Per-Route Test Buttons** | Explore and debug each route with request/response inspection |
| **Per-Property Control** | Disable, rename, or remap individual JSON properties; remove empty properties; strip embedded data |
| **Custom JSON Schemas** | Build completely custom response schemas from scratch; map existing fields or add static data |
| **Settings Route Editor** | Customize `/wp/v2/settings` to include ACF options pages, WordPress menus, and custom fields |
| **Event-Driven Automations** | Chain WordPress events (post transitions, WooCommerce orders, security events) with conditions and multiple webhook/email actions |
| **Unlimited Webhooks** | Unlimited outbound webhooks per application; incoming webhook endpoints trigger automations via HMAC-signed requests |
| **Email Templates & SMTP** | Transactional email templates with per-application SMTP configuration |
| **Collections** | Enforce per-page limits, customize sort order, and organize content per application |
| **Request Logs & Audit Trail** | Full queryable logs with graphs and data exports |
| **Import & Export** | Backup and replicate application settings across environments |

---

## Requirements

- WordPress 6.0+
- PHP 7.4+
