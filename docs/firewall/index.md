# Firewall

The Firewall module protects your site from automated abuse: brute-force attempts, scraping, and unwanted traffic from specific IPs or countries. It combines request rate limiting, IP/CIDR blocking, GeoIP country blocking, and automatic blacklisting of abusive IPs.

## What it covers

- [IP Management](./ip-management) — manually whitelist or blacklist individual IPs, CIDR ranges, with optional origin restriction and expiration.
- [Country Blocking](./country-blocking) — block entire countries from accessing your site using GeoIP lookups.
- [Auto-Blacklisting](./auto-blacklisting) — automatically block IPs that exceed configurable request/attempt thresholds.

## How the pieces fit together

An incoming request is checked against, in order:

1. Whether its IP is explicitly whitelisted (bypasses all other checks below).
2. Whether its IP is explicitly blacklisted, or falls within a blacklisted CIDR range.
3. Whether its country is on the blocked countries list.
4. Whether it has exceeded the automatic request-rate threshold (auto-blacklisting).

::: warning
The exact evaluation order and the general request rate limiter (as opposed to the *login* rate limiter, covered in [Login Hardening](../login-hardening/)) haven't been fully documented here yet — this needs a pass against `Runtime/RateLimiter.php` to confirm the precise logic and available settings.
:::