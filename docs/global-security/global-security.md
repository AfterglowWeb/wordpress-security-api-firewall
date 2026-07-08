<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Global Security

Global Security centralizes WordPress hardening toggles used by headless and API-first deployments. These controls are installation-wide and help reduce attack surface before route-level rules are evaluated.

---

## Core Security Toggles

- **Disable XML-RPC**: blocks legacy XML-RPC entry points.
- **Disable comments and pingbacks**: reduces spam and legacy abuse vectors.
- **Disable feeds/sitemaps where needed**: limits passive discovery channels.
- **Disable theme editor**: prevents direct file edits from admin UI.

---

## Header and Surface Hardening

- **Security headers**: enables common hardening headers through a guided toggle.
- **CORS-related guardrails**: keeps API surface aligned with explicit access policy.
- **Hide server signatures where possible**: reduces exposed fingerprinting hints.

---

## File and Platform Hardening

- **Uploads directory protections**: applies safer execution posture for uploads.
- **Configuration permissions checks**: validates critical file permissions.

---

## Recommended Rollout

1. Enable XML-RPC disable.
2. Enable comments/pingbacks disable if your site does not need them.
3. Enable security headers and verify front-end behavior.
4. Enable file protections.
5. Re-test login, media upload, and API routes.

---

## Related Modules

- For login attack mitigation, see [Auth Hardening](/login-hardening/login-hardening).
- For API ingress restrictions, see [Global IP Filtering](/global-ip-filtering/global-ip-filtering).
- For Pro-only headless lockout controls, see [WordPress Mode](/wordpress-mode/wordpress-mode).
