<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Auth Hardening

Auth Hardening protects the WordPress login surface against brute-force attempts. This panel is separate from REST API traffic quotas and is available in both Free and Pro.

---

## What It Controls

- **Enable Login Rate Limiting**: turns login protection on/off.
- **Max Failed Attempts**: number of failed logins allowed before block.
- **Window (seconds)**: rolling period used to count failed attempts.
- **Block Duration (seconds)**: temporary block duration once threshold is exceeded.
- **Escalation Threshold**: optional promotion behavior after repeated block cycles.

---

## Recommended Baseline

1. Enable login rate limiting.
2. Start with conservative defaults (for example 5 attempts / 300s).
3. Use a meaningful block duration (for example 3600s).
4. Monitor behavior in Logs and adjust for your audience.

---

## Pro and Headless Context

In Pro deployments using [WordPress Mode](/wordpress-mode/wordpress-mode), trusted IPs can bypass lockout-sensitive enforcement paths. Keep this list minimal and limited to known operators.

---

## Auth Hardening vs REST Rate Limiting

- **Auth Hardening**: protects the WordPress login flow.
- **Auth & Rate Limiting panel**: protects REST API usage patterns.
- **Global IP Filtering**: blocks abusive sources before deeper policy checks.

Use all three layers together for best results.
