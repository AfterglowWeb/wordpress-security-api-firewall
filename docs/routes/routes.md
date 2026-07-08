<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Routes & Exposure Control

The Routes panel gives you visibility and control over every REST API endpoint WordPress exposes. Free tier gives strong global controls. Pro adds route-level access settings with user, IP, and origin constraints.

---

## Set Global Defaults

Global settings apply to every route and can be overridden per-route in Pro.

<figure>
  <img src="/wordpress-application-layer-routes-global-settings.webp" alt="Routes — Global Settings" />
  <figcaption>Routes — Global Settings</figcaption>
</figure>

<details>
<summary>Auth &amp; Rate Limiting Defaults</summary>

<p><strong>Enforce Authentication on All Routes</strong> — requires a valid authenticated request on WordPress core REST endpoints. Unauthenticated requests are rejected with <code>401</code> before reaching WordPress. Third-party plugin routes are left open in the free tier, as exempting individual plugin sub-routes to avoid breakage requires the per-route control available in Pro.</p>
<p><strong>Enforce Rate Limiting on All Routes</strong> — applies the global rate-limiting quota (configured in the Auth &amp; Rate Limiting panel) to every route, including third-party plugin routes.</p>
<p>To enforce auth on plugin routes, or to exempt specific routes from auth or rate limiting, use the Per Route Settings tree in Pro.</p>

</details>

<details>
<summary>Disable Routes</summary>

<p>Disable specific WordPress core route groups that are rarely needed in headless or API-first setups:</p>
<ul>
  <li><strong>Disable <code>/wp/v2/users/*</code></strong> — prevents user enumeration. Available in the free tier.</li>
  <li><strong>Disable <code>oembed/1.0/*</code></strong> — removes oEmbed discovery. <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></li>
  <li><strong>Disable <code>batch/v1</code></strong> — removes the batch processing endpoint. <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></li>
</ul>

</details>

<details>
<summary>Disabled Route Response <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>Defines how the server responds when a route is disabled — globally or per-route. Available response types:</p>
<ul>
  <li><strong>404 Not Found</strong> — standard not-found response. The route appears to never have existed.</li>
  <li><strong>410 Gone</strong> — signals the resource was intentionally and permanently removed.</li>
  <li><strong>301 Custom URL Redirect</strong> — permanently redirects to a custom URL you specify.</li>
  <li><strong>301 WordPress Page Redirect</strong> — permanently redirects to a WordPress page selected from the admin.</li>
  <li><strong>Empty (no response)</strong> — closes the connection without a body. The server appears to not exist on this route.</li>
</ul>

</details>

<details>
<summary>Disable HTTP Methods <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>Globally disables one or more HTTP methods across <em>all</em> routes. Available methods: <code>GET</code>, <code>POST</code>, <code>PUT</code>, <code>PATCH</code>, <code>DELETE</code>.</p>
<p>Example: disabling <code>DELETE</code> globally ensures no client can remove content through the REST API, regardless of per-route settings.</p>

</details>

<details>
<summary>Disable Post Types &amp; Taxonomies <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>Removes all REST routes for selected post types and taxonomies from the API entirely. When a post type is disabled here, every method on every route under its REST base (e.g. <code>/wp/v2/posts/*</code>) returns the configured disabled-route response.</p>
<p>Use this to hide internal content types from external consumers without touching the WordPress object registration.</p>

</details>

---

## Fine-Tune Per-Route Settings <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span>

The per-route tree lists every registered REST route and lets you apply settings at any level — a top-level namespace, a route path, or an individual HTTP method. Child nodes inherit from their parent unless explicitly overridden.

<details>
<summary>Route Tree</summary>

<p>Routes are displayed as a collapsible tree. Each node shows the path, its effective permission label, and any overrides applied to its descendants.</p>
<p>The <strong>permission label</strong> reflects the effective state of the route:</p>
<ul>
  <li><strong>public</strong> — no authentication required by WordPress or by the plugin</li>
  <li><strong>protected</strong> — WordPress requires authentication but the plugin does not add further constraints</li>
  <li><strong>authenticated</strong> — authentication enforced by the plugin</li>
  <li><strong>forbidden</strong> — route is disabled</li>
</ul>

</details>

<details>
<summary>Apply Per-Route Overrides</summary>

<p>Click the settings icon on any node to activate a custom override for that route. Once activated, three toggles appear:</p>
<ul>
  <li><strong>Auth</strong> — enforce or exempt authentication specifically on this route, overriding the global setting.</li>
  <li><strong>Rate Limit</strong> — enforce or exempt rate limiting on this route.</li>
  <li><strong>Disable</strong> — disable this specific route or method. The configured Disabled Route Response is returned.</li>
</ul>
<p>Click the reset icon to remove the override and restore inheritance from the parent node.</p>

</details>

<details>
<summary>Use the Access Settings Drawer</summary>

<p>Per-route access is managed in a drawer opened from the route/method node. It replaces the old per-node user popover pattern.</p>
<p>The drawer groups access controls into three areas:</p>
<ul>
  <li><strong>Authenticated Users</strong> — restrict a route or method to selected app users.</li>
  <li><strong>Allowed IPs</strong> — route-level IP narrowing.</li>
  <li><strong>Allowed Origins</strong> — route-level origin narrowing.</li>
</ul>
<p>Use this for high-risk write routes (for example, allow <code>POST</code> only to one service user from one known origin).</p>

</details>

<details>
<summary>Core Routes vs Plugin Routes</summary>

<p>The route tree includes both WordPress core namespaces and plugin namespaces.</p>
<ul>
  <li><strong>Core routes</strong> follow full per-application enforcement behavior.</li>
  <li><strong>Plugin routes</strong> can be managed globally through route policy to avoid duplicate configuration across applications.</li>
</ul>
<p>When editing plugin routes in the drawer, the UI warns that settings apply across applications.</p>

</details>

<details>
<summary>Test</summary>

<p>Each method node exposes a <strong>Test</strong> button that fires a live request against that route through the current policy. The result panel shows the HTTP status, response headers, and body — letting you verify auth, rate limiting, and disable behaviour before going to production.</p>

</details>

---

**Entry type:** Route policy (tree, per-application in Pro)

---

## FAQ

**Does disabling a post type's routes affect the WordPress admin?**

No. The plugin only applies to unauthenticated or non-admin REST requests. Authenticated admin requests pass through untouched, so the WordPress admin and Gutenberg continue to work normally.

**Will disabling a route break other plugins that use the REST API?**

Disabling individual routes is a Pro feature. In the free tier, only `/wp/v2/users/*` can be disabled globally — all other routes remain accessible. In Pro, route disabling is configured per-application and targets specific paths, so you can safely disable a route for one application without affecting others. Many third-party plugins expose REST routes for license validation, update checks, or data collection; the Pro route tree lets you audit and control each of those routes individually.

**What happens to requests that do not match any application in Pro?**

Core routes are blocked (or redirected if applications only mode is enabled). Plugin routes can still be evaluated by route policy.

**Can I restrict a route to authenticated requests only without affecting the response schema?**

Yes. Enabling Auth on a route does not change the response — it only adds an authentication gate before WordPress processes the request.
