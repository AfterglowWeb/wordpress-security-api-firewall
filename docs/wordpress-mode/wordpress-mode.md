<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# WordPress Mode

WordPress Mode is a Pro panel for headless-first deployments. It combines lockdown controls and recovery tooling in one place.

---

## Main Controls

### Applications Only

When enabled, WordPress behaves as application-first:

- unmatched core REST traffic is redirected according to your configured destination,
- plugin routes can still be managed through route policy,
- the setup is optimized for sites where WordPress is not the public front-end.

### Trusted IPs

Define known-safe IPs or CIDR ranges for operational access.

Use cases:

- secure admin maintenance access,
- controlled bypass during incident response,
- stable access for trusted infrastructure.

### Emergency Reset Token

Generate a one-time recovery token before enabling strict lockdown. If you lock yourself out, the token provides a controlled reset path.

Best practice:

1. generate and store the token securely,
2. verify it once in staging,
3. rotate after use.

---

## Safe Rollout Order

1. Configure redirect destination in [Theme](/theme/theme).
2. Add trusted IPs for maintainers.
3. Generate emergency reset token and store it.
4. Enable applications only mode.
5. Validate public, app, and admin flows.

---

## Related Docs

- [Applications](/applications/applications)
- [Routes & Exposure Control](/routes/routes)
- [Global IP Filtering](/global-ip-filtering/global-ip-filtering)
- [Auth Hardening](/login-hardening/login-hardening)
