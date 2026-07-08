# WP Security & API Firewall

📖 **[Documentation](https://www.moriskelly.com/wordpress-security-api-firewall)**

WP Security & API Firewall is a complete security suite for WordPress, hardening login, core endpoints, and server-level exposure — including rate limiting, IP/GeoIP blocking, 2FA, and Recaptcha. It secures REST API access with JWT and Application Password hardening, per-route authentication and restriction rules, and response filtering to reduce data exposure. Every blocked request and security event is logged for full visibility.

| Feature | Description |
|---|---|
| **Firewall** | Rate limiting, IPv4/IPv6 blacklisting, CIDR ranges, country blocking (GeoIP) |
| **Login Hardening** | Login rate limiting, Recaptcha, 2FA, auth cookie protection, salt rotation schedule, sessions manager |
| **WordPress Security** | Disable XML-RPC, comments, pingbacks, RSS/Atom, sitemap; security HTTP headers; secure file permissions |
| **Application Authentication** | JWT and Application Passwords hardening, whitelist IPs and origins |
| **Application Only Mode** | Redirect or hide front |
| **REST Routes** | Enforce authentication and disable routes on a per-route basis and per criteria |
| **REST Response** | Resolve embedded data, flatten rendered fields, strip domain from URLs |
| **Logs** | Security event logs |

## Requirements

- WordPress 6.0+
- PHP 7.4+

## Install

### 1. Download or clone this repository into your `wp-content/plugins/` directory

```bash
cd wp-content/plugins/
git clone https://github.com/AfterglowWeb/wordpress-security-api-firewall.git bromate-security-api-firewall
```

### 2. Activate the plugin through the WordPress admin

### 3. Navigate to the **WP Security & API Firewall** admin page.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

GPL-2.0-or-later
