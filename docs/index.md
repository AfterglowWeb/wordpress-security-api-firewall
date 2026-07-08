---
layout: home

hero:
  name: "WordPress Application Layer"
  text: "Full security and data management for your headless WordPress backend."
  tagline: "Control authentication, data exposure, and request flow. Build multi-tenant applications with isolated clients. Automate complex workflows. Harden your WordPress install. Self-hosted, open-source, built for developers done with SaaS."
  image:
    src: /wordpress-application-layer-routes.webp
    alt: WordPress Application Layer admin interface
  actions:
    - theme: brand
      text: Get Started
      link: /presentation
    - theme: alt
      text: View on GitHub
      link: https://github.com/AfterglowWeb/wordpress-security-api-firewall

features:
  - icon: 🔐
    title: Full Security & Data Management for the WordPress REST API
    details: "Validate clients with JWT or WordPress Application Passwords. Enforce per-user rate limits with auto-blacklist on violations. Block malicious IPs. Audit every REST route and control what is exposed. Free tier covers essentials; Pro adds CIDR ranges, country blocking, per-route policies, and origin restrictions."
    link: /users/users
    linkText: Learn more

  - icon: 📦
    title: Schema Builder & Multi-Application Backend
    details: "Transform REST responses with sitewide or per-property rules — resolve embeds, flatten fields, strip URLs, rename properties, remap data. Free tier offers global transforms; Pro adds fully custom JSON schemas, per-property control, and settings route editor. Serve multiple applications from one WordPress install, each isolated."
    link: /models/models
    linkText: Learn more

  - icon: ⚡
    title: Complex Automations to Feed Your Applications
    details: "Chain event-driven workflows triggered by WordPress events (post transitions, WooCommerce orders, security events) or external webhooks. Define conditions, fire multiple webhooks and emails per automation, queue or schedule them, automate Git API triggers for front-end deployments. Build powerful integrations without code."
    link: /automations/automations
    linkText: Learn more

  - icon: 🔒
    title: Extended Security for Your WordPress Install
    details: "Harden WordPress-wide surfaces beyond REST API: login form rate limiting and hardening, disable XML-RPC/comments/pingbacks/RSS, enforce HTTP security headers, secure file permissions, protect uploads directory. Control what is exposed and defend against abuse at every layer."
    link: /global-security/global-security
    linkText: Learn more
---

<div class="vp-doc home-intro">

## Own your stack. Own your data.

SaaS CMSes are convenient until they are not — pricing changes, data lives on someone else's server, and migrating out is painful. WordPress has powered the open web for 20 years. **Application Layer gives it the application infrastructure it was always missing.**

Authentication, data shaping, API scoping, event automation, security hardening: the features you have been assembling from a dozen plugins on every project, now in one coherent layer — with a clean admin UI, a full hooks API, and zero vendor lock-in.

</div>

<div class="vp-doc home-extra">

## How It Works

### Request Flow & Application Matching

Every incoming REST request passes through a security pipeline that controls access before responses are sent. Here's what happens:

**Application Matching (Pro):** The first layer determines which application owns the request. Two modes available:

- **Application Only Mode (Pro):** Requests that don't match any application are rejected by default. All non-REST endpoints (theme, sitemap, RSS feeds) are disabled, redirected (301), or return custom error codes. You can fine-tune which plugin routes are accessible, or disable them entirely. This mode creates a locked-down REST-only backend.

- **Normal Mode:** REST API remains accessible if the request doesn't match an application. You can still disable theme access, RSS feeds, and other endpoints globally, but unmatched requests reach WordPress normally. Application-matched requests follow the same security pipeline.

**WordPress Install Security:** Regardless of mode, your WordPress installation is protected by:
- Request rate limiting and IP auto-blacklisting
- Login form rate limiting and hardening
- HTTP security headers (preventing XSS, clickjacking, etc.)
- Disabled XML-RPC, comments, pingbacks, RSS (configurable)
- Secure file permissions and upload directory protection

**The Security Pipeline:**

```
Incoming REST request
       │
       ▼
┌──────────────────────────────┐
│ 1. IP Filtering & Blocklist  │  ← IPs, CIDRs (Pro), countries (Pro)
└──────────┬───────────────────┘
           │ blocked → 403
           ▼
┌──────────────────────────────┐
│ 2. Application Matching      │  ← Route to app or reject (Pro)
└──────────┬───────────────────┘
           │ (depending on mode)
           ▼
┌──────────────────────────────┐
│ 3. Authentication            │  ← JWT / WP App Passwords
└──────────┬───────────────────┘
           │ invalid → 401
           ▼
┌──────────────────────────────┐
│ 4. Rate Limiting             │  ← Per-user quotas
└──────────┬───────────────────┘
           │ exceeded → 429
           ▼
┌──────────────────────────────┐
│ 5. Routes Policy             │  ← Global or per-route (Pro)
└──────────┬───────────────────┘
           │ disabled/restricted
           ▼
┌──────────────────────────────┐
│ WordPress REST API           │  ← Native WP handler
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│ 6. Properties Transform      │  ← Sitewide or per-property (Pro)
└──────────┬───────────────────┘
           ▼
       REST Response
```

---

### Event-Driven Automations

Automations power your applications by reacting to WordPress events or external triggers. Build workflows without code.

**Event Sources:**

- **WordPress Events:** Post/page/custom post type creation, updates, deletion, status transitions. Taxonomy term create/update/delete. Media attachment upload/delete. WooCommerce orders, payments, customer actions. User registration, login, role changes. Security events from this firewall (rate limit violations, IP blocks, auth failures). Custom plugin hooks and your own application events.

- **External Webhooks:** External services (Stripe, GitHub, CRM, IoT devices) can POST signed requests to trigger automations. Each webhook endpoint is unique and HMAC-protected.

**Automation Steps:**

1. **Define event source(s):** One or multiple WordPress hooks, or an external webhook endpoint.

2. **Set conditions (optional):** Use a visual conditional logic builder to fire the automation only when specific data matches (e.g., "only for posts with category X" or "if order total > $100").

3. **Configure actions:** Queue or schedule the automation. Chain multiple actions:
   - Send **N webhooks** (each with its own payload mapping and retry logic)
   - Send **N emails** (using per-application SMTP servers with custom email templates)
   - Trigger **Git API integration** to deploy front-end applications (trigger builds on repository events)
   - Fire custom WordPress hooks for your own plugins to extend further

4. **Chain automations:** One automation can trigger another, creating complex multi-step workflows.

**Webhook Protection:** All webhooks are HMAC-signed. You control read/write keys, and can rotate them at any time.

**SMTP Configuration:** Set up one SMTP server per application, so each client gets isolated email delivery.

---

## Use Cases

<div class="use-cases-grid">

<div class="use-case-card">

### Headless CMS

Use WordPress as the content back-end for a React, Next.js, Nuxt, or mobile app. Enforce authentication, transform responses to match your front-end schema, and keep WordPress internals invisible to consumers.

</div>

<div class="use-case-card">

### Replace your SaaS CMS

Self-host your content infrastructure. Keep editorial teams on a familiar interface while giving developers a clean, controlled API — without recurring costs or third-party data custody.

</div>

<div class="use-case-card">

### Multi-Tenant Applications

Serve multiple client applications from a single WordPress back-end. Isolate authentication, content views, and rate limits per application — each client sees only what they are entitled to.

</div>

<div class="use-case-card">

### Multilingual Distribution

Serve content in multiple languages across separate websites or applications, each with its own REST API scope, response schema, and delivery configuration.

</div>

</div>

---

## Free vs Pro

<div class="tier-comparison">

<div class="tier-card tier-free">

### ✅ Free Tier

Fully explore and secure your REST API with authentication, rate limiting, and response shaping.

- **Authentication (JWT, App Passwords)** + user rate limits
- **Global IP blocking** with auto-blacklist on violations
- **Explore all routes** with per-route test buttons
- **Shape responses** globally: resolve, flatten
- **Hardened login** protection and WordPress security (XML-RPC, RSS, file permissions)
- **Single webhook** for event triggers

</div>

<div class="tier-card tier-pro">

### 🚀 Pro Tier

Serve multiple applications with per-client isolation, advanced security, and automation.

- **Multi-application isolation:** Unlimited users per app with independent auth, IP rules, and webhooks
- **Advanced IP control:** CIDR ranges, country blocking, origin restrictions, "Application Only Mode"
- **Per-route & per-property control:** Fine-grained policies, custom schemas, and per-route test buttons
- **Automations & webhooks:** Event-driven workflows with chained actions, unlimited webhooks, incoming webhook triggers
- **Complete audit trail:** Request logs, email templates with SMTP, collections with sort order

</div>

</div>

### Core Pillars

| Feature | Free | Pro |
|---|:---:|:---:|
| **Authentication & Rate Limiting** | | |
| Authentication (JWT & App Passwords) | ✅ | ✅ |
| Per-user (1 Free) rate limit quotas | ✅ | ✅ |
| Auto-blacklist on violations | ✅ | ✅ |
| Serve multiple applications | - | ✅ |
| Unlimited users | - | ✅ |
| Custom headers per application | — | ✅ |
| **IP Filtering & Security** | | |
| Global IP blocklist (manual IPv4 & IPv6) | ✅ | ✅ |
| Auto-blacklist from rate limits | ✅ | ✅ |
| Read-only GeoIP stats | ✅ | ✅ |
| Managed blocked IPs | ✅ | ✅ |
| Per-application IP whitelisting | — | ✅ |
| Per-application origin | — | ✅ |
| Per-application custom headers control | — | ✅ |
| CIDR ranges support | — | ✅ |
| Country-level blocking (GeoIP) | — | ✅ |
| **Routes & Exposure Control** | | |
| REST API route explorer | ✅ | ✅ |
| Enforce Auth on all WordPress core routes | ✅ | ✅ |
| Disable security data exposed | ✅ | ✅ |
| Global method disable (GET, POST, PUT, PATCH, DELETE) | - | ✅ |
| Global post-type / taxonomy disable | - | ✅ |
| Per-app x Per-route policy (disable, redirect) | — | ✅ |
| Per-app x Per-route user / IP / origin restriction | — | ✅ |
| Custom disabled route response (404, 410, 301, empty) | — | ✅ |
| Per-app x Route test button | — | ✅ |
| **Properties & Data Shaping** | | |
| Resolve embedded data (terms, authors, attachments) | ✅ | ✅ |
| Flatten rendered fields | ✅ | ✅ |
| Relative URLs (strip domain) | ✅ | ✅ |
| Remove empty properties | — | ✅ |
| Per-property disable / rename / remap | — | ✅ |
| Custom JSON schemas | — | ✅ |
| Settings route schema editor | — | ✅ |

### Automation Features

| Feature | Free | Pro |
|---|:---:|:---:|
| Webhooks (single, post lifecycle events) | ✅ | ✅ |
| Hooks & Filters API | ✅ | ✅ |
| Multiple webhooks (unlimited per app) | — | ✅ |
| Incoming webhooks (external triggers) | — | ✅ |
| Email templates & SMTP config | — | ✅ |
| Automations (event & schedule workflows) | — | ✅ |
| Request logs & audit trail | — | ✅ |

---

## Roadmap

The next modules in development:

<div class="roadmap-grid">

<div class="roadmap-card">
<span class="roadmap-tag">Coming next</span>

**WooCommerce Bridge**

Headless access to WooCommerce — products, cart, checkout, and Stripe/PayPal payments — through the same application security layer.
</div>

<div class="roadmap-card">
<span class="roadmap-tag">Coming next</span>

**Forms Bridge**

Secure form submission endpoints with entry management, configurable data retention, GDPR options, and AES-256 encryption. Compatible with WPForms and Contact Form 7.
</div>

<div class="roadmap-card">
<span class="roadmap-tag">Planned</span>

**Site Import / Export**

Cherry-pick content and configuration to sync, migrate, or replicate between WordPress installations through the REST API — powered by the same field mapping already in Models.
</div>

<div class="roadmap-card">
<span class="roadmap-tag">Planned</span>

**Editorial Workflow**

Authors scoped to their own posts and media. Validation workflows, co-authoring, post duplication, post type conversion, and multi-author taxonomies — for production editorial teams.
</div>

<div class="roadmap-card">
<span class="roadmap-tag">Planned</span>

**Static Pages & Custom URLs**

Spin up static landing pages on any domain directly from WordPress. Choose any URL pattern for posts and pages — free from WordPress's default URL constraints.
</div>

<div class="roadmap-card">
<span class="roadmap-tag">Planned</span>

**Database Encryption**

An optional encryption layer for sensitive data stored in `wp_options` and custom tables — transparent to the application.
</div>

</div>

---

## Screenshots

<div class="screenshots-grid">
  <figure>
    <img src="/wordpress-application-layer-user-editor.webp" alt="User Editor" />
    <figcaption>User Editor</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-applications.webp" alt="Applications" />
    <figcaption>Applications</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-application-settings.webp" alt="Application Settings" />
    <figcaption>Application Settings</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-application-modules.webp" alt="Application Modules" />
    <figcaption>Application Modules</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-application-users.webp" alt="Application Users" />
    <figcaption>Application Users</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-geoip.webp" alt="GeoIP Filtering" />
    <figcaption>GeoIP Filtering</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-collections.webp" alt="Collections" />
    <figcaption>Collections</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-properties-global-settings.webp" alt="Properties — Global Settings" />
    <figcaption>Properties — Global Settings</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-properties-model.webp" alt="Properties — Model" />
    <figcaption>Properties — Model</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-properties-custom-schema.webp" alt="Properties — Custom Schema" />
    <figcaption>Properties — Custom Schema</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-properties-wordpress-schema.webp" alt="Properties — WordPress Schema" />
    <figcaption>Properties — WordPress Schema</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-properties-test.webp" alt="Properties — Test" />
    <figcaption>Properties — Test</figcaption>
  </figure>
  <figure>
    <img src="/wordpress-application-layer-routes-global-settings.webp" alt="Routes — Global Settings" />
    <figcaption>Routes — Global Settings</figcaption>
  </figure>
</div>

</div>

<style>
.VPHero .text {
  font-size: 2.5rem !important;
  line-height: 2.8rem !important;
}

.tier-comparison {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin: 28px 0;
}

.tier-card {
  border: 2px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 16px 18px;
  position: relative;
}

.tier-card h3 {
  font-size: 1.05rem;
  margin: 0 0 12px 0;
  border: none;
  padding: 0;
  color: var(--vp-c-text-1);
  font-weight: 700;
}

.tier-free {
  background: linear-gradient(135deg, rgba(46, 125, 50, 0.05) 0%, rgba(76, 175, 80, 0.05) 100%);
  border-color: #4caf50;
}

.tier-free h3 {
  color: #2e7d32;
}

.tier-pro {
  background: linear-gradient(135deg, rgba(21, 101, 192, 0.05) 0%, rgba(33, 150, 243, 0.05) 100%);
  border-color: #1565c0;
  box-shadow: 0 4px 12px rgba(21, 101, 192, 0.15);
}

.tier-pro h3 {
  color: #1565c0;
}

.tier-card ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.tier-card li {
  padding: 5px 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.tier-card li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.tier-card strong {
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.tier-card > p {
  font-size: 13px;
  line-height: 1.45;
  margin: 0 0 10px 0;
  color: var(--vp-c-text-2);
}

.home-intro {
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 24px;
}

.home-intro h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 16px;
}

.home-intro > p {
  font-size: 16px;
  color: var(--vp-c-text-2);
  max-width: 700px;
  line-height: 1.8;
  margin: 0;
}

.home-intro strong {
  color: var(--vp-c-text-1);
}

.home-extra {
  max-width: 1152px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.home-extra h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.home-extra > p {
  font-size: 15px;
  color: var(--vp-c-text-2);
  max-width: 700px;
  line-height: 1.75;
  margin: 0 0 48px;
}

.pillars-grid,
.use-cases-grid,
.roadmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin: 24px 0 56px;
}

.pillar-card,
.use-case-card,
.roadmap-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 20px 24px;
}

.pillar-card h3,
.use-case-card h3 {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px;
  border: none;
  padding: 0;
}

.pillar-card p,
.use-case-card p {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.65;
}

.roadmap-card {
  position: relative;
  font-size: 14px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
}

.roadmap-card strong {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 6px 0 4px;
}

.roadmap-tag {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 3px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin: 24px 0;
}

.screenshots-grid figure {
  margin: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.screenshots-grid img {
  width: 100%;
  display: block;
}

.screenshots-grid figcaption {
  font-size: 12px;
  color: var(--vp-c-text-2);
  padding: 8px 12px;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
}

.badge-pro {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  background: #1565c0;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  vertical-align: middle;
  margin-left: 4px;
}

.VPHero .image img {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
