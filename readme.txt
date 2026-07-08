=== WP Security & API Firewall ===
Contributors: yourwporgusername
Tags: security, firewall, rest api, jwt, two factor authentication
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A complete security suite for WordPress: firewall, login hardening, and full REST API access control (JWT, per-route rules, response filtering).

== Description ==

WP Security & API Firewall is a complete security suite for WordPress, hardening login, core endpoints, and server-level exposure — including rate limiting, IP/GeoIP blocking, 2FA, and Recaptcha. It secures REST API access with JWT and Application Password hardening, per-route authentication and restriction rules, and response filtering to reduce data exposure. Every blocked request and security event is logged for full visibility.

= Features =

**Firewall**

* Rate limiting
* IPv4/IPv6 blacklisting
* CIDR ranges
* Country blocking (GeoIP)

**Login Hardening**

* Login rate limiting
* Recaptcha
* Two-factor authentication (2FA)
* Auth cookie protection
* Salt rotation schedule
* Sessions manager

**WordPress Security**

* Disable XML-RPC, comments, pingbacks, RSS/Atom, sitemap
* Security HTTP headers
* Secure file permissions

**Application Authentication**

* JWT and Application Passwords hardening
* Whitelist IPs and origins

**Application Only Mode**

* Redirect or hide the front end

**REST Routes**

* Enforce authentication on a per-route basis
* Disable routes per route and per criteria

**REST Response**

* Resolve embedded data
* Flatten rendered fields
* Strip domain from URLs

**Logs**

* Security event logs

For full documentation, visit [wordpress-security-api-firewall](https://www.moriskelly.com/wordpress-security-api-firewall).

== Installation ==

1. Upload the plugin files to the `/wp-content/plugins/bromate-security-api-firewall` directory, or install the plugin through the WordPress plugins screen directly.
2. Activate the plugin through the 'Plugins' screen in WordPress.
3. Navigate to the **WP Security & API Firewall** admin page to configure firewall rules, login hardening, and REST API settings.

= Manual installation via Git =

`cd wp-content/plugins/
git clone https://github.com/AfterglowWeb/wordpress-security-api-firewall.git bromate-security-api-firewall`

== Frequently Asked Questions ==

= Does this plugin replace a general-purpose firewall plugin like Wordfence or Sucuri? =

WP Security & API Firewall covers the same core hardening ground (rate limiting, IP/GeoIP blocking, login protection, security headers) while adding fine-grained control over the REST API, which most general security plugins don't address.

= Does it work with JWT authentication? =

Yes. The plugin includes JWT and Application Password hardening as part of Application Authentication.

= Can I restrict specific REST API routes? =

Yes. REST Routes settings let you enforce authentication or disable routes on a per-route basis and per criteria.

= Can I hide the front end entirely? =

Yes, via Application Only Mode, which can redirect or hide the front end.

== Screenshots ==

1. Dashboard overview
2. Firewall settings
3. Login hardening settings
4. REST Routes control
5. Logs

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
