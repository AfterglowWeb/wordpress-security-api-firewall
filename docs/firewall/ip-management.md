# IP Management

Manually manage a list of IP addresses and CIDR ranges that should always be allowed (whitelist) or always be blocked (blacklist), regardless of any other rule.

## Adding entries

From the **Firewall** page, click **Add IPs** to open the entry form. You can add multiple entries at once:
- **List** — Select if you want to whitelist or blacklist the IPs, this option is common to all the IPs you are currently editing.
Click `Add IP`, IP on each row you can set:
- **IP / CIDR** — a single address (e.g. `203.0.113.1`) or a range using CIDR notation (e.g. `203.0.113.0/24`). Both IPv4, IPv6 are supported.
- **Allowed origin** (optional) — if set, the entry only grants access when the request's origin matches this value exactly. Leave empty to allow the IP regardless of origin.
- **Expires at** (optional) — leave empty for the entry to never expire.


Use **Add My IP** to quickly add your own current IP address as a new row, it is recommanded to whitelist your own access before testing a stricter policy.

## Editing an entry

Manually added entries can be edited individually from the grid (pencil icon). The IP/CIDR value itself cannot be changed once an entry is created — to change the address, you must remove the entry and add a new one instead.

You can change:
- Whitelist/blacklist status
- Allowed origin
- Expiration date

## Binding an IP to a REST API user

::: tip
This is only available when [adding or removing IPs from a specific user's authorized access](../application-authentication/authorized-users) in the REST API Auth. panel.
:::

IPs can be bound to a specific REST-authorized user in the REST API Auth. panel, it does two things:
- restrict the **user's authenticated REST API requests** to that IP only: credentials AND matching ip become mandatory to access the ressources, otherwise the request will fail.
— bypass ratelimiting once the user is authentified and validated

The IP will show in the IP Management Panel with the related REST API authorized user in the user column.
Remember that it does not apply for access outside the REST API.

Binding an IP to a user is not available for blacklisted IPs as blacklisting always blocks the IP entirely.

## Deleting entries

Select one or more rows using the checkboxes and click **Delete**, or use the row-level delete action. Deletion is immediate and cannot be undone.

## Automatically created entries

Some entries are created automatically by other parts of the plugin — for example, an IP that triggers the [login rate limiter](../login-hardening/login-rate-limiting) enough times gets automatically blacklisted. These entries are shown in the same grid, but cannot be edited from here: their expiration and other fields are managed by the mechanism that created them, to keep that mechanism's own logic consistent.

::: warning
The exact list of automatic entry origins, and what "entry type" values mean in the grid, should be confirmed and documented explicitly here.
:::