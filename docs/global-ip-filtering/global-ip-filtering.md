<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Global IP Filtering

Global IP Filtering is a WordPress-level firewall layer that runs **before application resolution**. Every incoming REST request is evaluated against the global blocklist regardless of which application it targets. A blocked IP or country never reaches application-specific logic.


---

## How It Works

```
Incoming REST request
       │
       ▼
┌─────────────────────────┐
│  Global IP Filtering    │  ← Shared blocklist: IPs, CIDRs, countries (runs first)
└────────────┬────────────┘
             │  blocked → 403
             ▼
┌─────────────────────────┐
│  Application Matching   │  ← Which application owns this request? (Pro)
└────────────┬────────────┘
             │
             ▼
        … rest of pipeline
```

Admin-authenticated requests are exempt from this layer for operational safety.

---

## Free Tier

### Manual Blocklist

Add IPv4 or IPv6 addresses to the global blocklist manually. Blocked IPs receive a `403` response immediately.

### GeoIP Statistics

Read-only geographic statistics of incoming requests are visible. Country-level blocking requires Pro.

<figure>
  <img src="/wordpress-application-layer-geoip.webp" alt="GeoIP Filtering" />
  <figcaption>GeoIP Filtering</figcaption>
</figure>

---

## Pro Tier

### CIDR Ranges

Block entire IP ranges using CIDR notation (e.g. `10.0.0.0/8`, `192.168.1.0/24`). Supports both IPv4 and IPv6.

### Country Blocking

Block all requests originating from one or more countries using GeoIP data. Country rules are evaluated after the IP/CIDR check. Configuring no countries disables the country check entirely — there is no performance cost when the list is empty.

### Retention Time

Set a global retention period. Entries without a specific expiry inherit this value and are automatically removed when it elapses.

### Trusted IPs Interaction

If you use pro [WordPress Mode](/wordpress-mode/wordpress-mode), trusted IPs are treated as an explicit bypass list for high-lockdown scenarios.

---

## IP List Management

The IP list shows all active global entries. For each entry:

- **Add** an IP or CIDR range manually.
- **Delete** one or more entries individually or in bulk.

Entries show the IP address, source (manual or auto-detected), detected country, and — in Pro — the expiry time.

