# Country Blocking

Block visitors from entire countries based on their IP's geographic location (GeoIP).

## How it works

When a request comes in, its IP is resolved to a country using a GeoIP lookup service. If that country is on your blocked list, the request is denied. Lookups are cached to avoid repeated calls for the same IP.

## Setting up blocked countries

From the **Firewall** page's country blocking panel, select one or more countries to block. The list includes all standard countries, plus a small number of non-standard but commonly used entries (regions not covered by the ISO country list).
All traffic from this country will be blocked.

## Interaction with IP whitelisting

If an IP is explicitly whitelisted (see [IP Management](./ip-management)), it bypasses country blocking — an individual whitelisted IP always takes precedence over a country-level block.

## Accuracy limitations

GeoIP lookups are inherently approximate: they rely on third-party IP-to-location databases, which are not always fully accurate or up to date (VPNs, proxies, mobile carrier networks, and recently reassigned IP ranges can all cause a mismatch). Country blocking should be treated as a deterrent, not an absolute guarantee.