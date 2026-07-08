<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Auth & Rate Limiting

The Auth & Rate Limiting panel manages which WordPress users have access to the REST API, which authentication methods are accepted, and what rate quotas apply.

In the **free tier**, users and rate limits are configured globally and apply across all routes and requests.

In **Pro**, each [Application](/applications/applications) defines its own auth methods, allowed origins, allowed IPs, allowed HTTP methods, and user list. Users belong to an application and per-user settings can narrow — but never relax — the application-level defaults.

For login form protection (separate from REST traffic quotas), see [Auth Hardening](/login-hardening/login-hardening).

---

## Free Tier

### Global Settings

Authentication and rate limiting enforcement is toggled in the [Routes panel](/routes/routes):

- **Enforce Authentication** — requires a valid authenticated request on all WordPress core REST endpoints.
- **Enforce Rate Limiting** — applies the global quota to all routes.

### User Entries

Each entry links a WordPress user to an optional rate limit quota. When the module is enabled, authenticated requests are checked against this list before the endpoint is reached.

<details>
<summary>User Identity</summary>

<p><strong>User</strong> links this entry to an existing WordPress user account.</p>
<p><strong>Enabled</strong> toggles activation for this user without deleting the entry.</p>

</details>

<details>
<summary>Rate Limiting</summary>

<p><strong>Window (seconds)</strong> defines the time period over which requests are counted. For example, <code>60</code> means one minute.</p>
<p><strong>Max Requests</strong> is the maximum number of REST API requests allowed within one window. When exceeded, the firewall returns <code>429 Too Many Requests</code> until the window resets. Leave both fields empty to grant unrestricted access while still tracking the user.</p>
<p><strong>Block Time</strong> is how long an IP is blocked after exceeding the max requests threshold.</p>
<p><strong>Blacklist Threshold</strong> is the number of times the max requests limit must be hit before the IP is automatically blacklisted.</p>

</details>

---

## Pro — Application-level Defaults

When the Auth &amp; Rate Limiting module is active for an application, the following defaults apply to every user in that application:

- **Allowed auth methods** — accepted authentication mechanisms (WordPress Application Password, JWT). Requests using a non-listed method are rejected with `403`.
- **Allowed HTTP methods** — permitted verbs across all routes for this application (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- **Allowed IPs** — optional IP allowlist. Requests from unlisted IPs are rejected.
- **Allowed origins** — optional origin allowlist. Requests from unlisted origins are rejected.
- **Default rate limit** — maximum requests and time window applied to all users of this application unless overridden at user level.

User-level settings can only be **more restrictive**, never more permissive.

### HTTP Method Cascade

Method control follows a 3-tier narrowing model:

1. **Application blocked methods**: methods denied for everyone.
2. **Application default methods**: max allowed set for authenticated users.
3. **User allowed methods**: per-user subset.

A user cannot gain a method that is not allowed at application level.

---

## Pro — Users List

The users list manages which WordPress users have access to the application.

- **Add** a user with the add button.
- **Enable / Disable** a user entry. A confirmation is required.
- **Delete** one or more users. A confirmation is required.

An application supports an **unlimited number of users**.

<figure>
  <img src="/wordpress-application-layer-application-users.webp" alt="Application Users" />
  <figcaption>Application Users</figcaption>
</figure>

---

## Pro — User Editor

Accessible from the users list, the user editor lets you configure per-user access rules that narrow the application defaults:

- **User** — select the WordPress user account this entry applies to.
- **Auth method** — if multiple methods are allowed at application level, restrict this user to a single one.
- **Auth keys** — for methods other than WordPress Application Password (which is self-contained), provide the relevant credentials or token.
- **Allowed HTTP methods** — restrict to a subset of the methods permitted at application level.
- **Allowed IPs** — narrow to one or more specific IPs.
- **Allowed origins** — narrow to one or more specific origins.
- **Rate limit** — override the application default with a lower quota. Rate limits can only be tightened at user level, not relaxed.

Route-level access can be narrowed further from the [Routes](/routes/routes) access settings drawer.

<figure>
  <img src="/wordpress-application-layer-user-editor.webp" alt="User Editor" />
  <figcaption>User Editor</figcaption>
</figure>

---

## FAQ

**Are rate limits shared across applications?**

No. In Pro, each user entry belongs to a specific application and its counter is scoped to that application. Use separate user entries per application to keep quotas isolated.

**What happens to unauthenticated requests?**

Unauthenticated requests are not affected by user entries. To block them, enable authentication enforcement in the [Routes panel](/routes/routes).

**Can a user belong to multiple applications?**

Yes. Create a separate user entry in each application. The same WordPress user can have different rate limits, auth methods, and access rules per application.

