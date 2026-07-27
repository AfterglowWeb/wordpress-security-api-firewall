# Auto-Blacklisting

The Firewall automatically and permanently blacklists an IP address that exceeds a configurable number of excessive requests violations within a given time window.

## How it works

1. Each time a violation occurs from a given IP, it is counted within a rolling time window.
2. If the number of violations within that window exceeds the configured threshold, the IP is temporarily blocked for a configured duration.
3. If the IP keeps triggering this temporary block repeatedly, the number of violations count increases, it is automatically and permanently added to the blacklist after violations count exceed the max number you.
4. Autoblackilsted IPs are released after a ban time you setup, default is 24h, you can also keep them forever (no autorelease time)

This two-stage approach (temporary block → permanent blacklist after repeated offenses) avoids permanently banning someone who mistypes their password a few times, while still stopping persistent brute-force attempts.

## Configurable thresholds

- **Maximum attempts** — how many violations within the time window trigger a temporary block.
- **Time window** — the rolling period during which attempts are counted.
- **Block duration** — how long the temporary block lasts.
- **Blacklist after** — how many temporary blocks (strikes) before the IP is permanently blacklisted. Set to `0` to disable automatic permanent blacklisting entirely.

::: warning
TODO
- **Blacklist relase time** — Time or unnlimited
Automatically blacklisted IPs are currently blocked for a fixed duration (matching the temporary block duration setting) before automatically expiring. A setting to make automatic blacklisting **permanent** (no expiration) is planned, as an alternative to the current time-limited behavior. Until this is added, review the [IP Management](./ip-management) list periodically if you want to keep certain IPs blocked indefinitely.
:::

::: warning
Another page describes the **login** auto-blacklisting flow in detail (failed login attempts).
:::