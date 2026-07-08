<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Hooks & Filters API

Every configurable option in WordPress Application Layer exposes a WordPress filter. This lets you override or extend plugin behaviour from your theme's `functions.php`, a mu-plugin, or any other plugin — without modifying the plugin source.

Hooks are available in both the free and Pro tiers.

---

## How it works

The plugin uses standard WordPress `apply_filters()` calls around every decision point. Hook in with `add_filter()` to override defaults, inject context-specific values, or extend the pipeline.

```php
add_filter( 'rest_firewall_<hook_name>', function( $value, $context ) {
    // return a modified value
    return $value;
}, 10, 2 );
```

---

## Available filter categories

| Category | Description |
|---|---|
| **Authentication** | Override allowed auth methods, token validators, user resolution |
| **Rate Limiting** | Adjust quotas or bypass limits per user, route, or application |
| **IP Filtering** | Override block/allow decisions, inject custom IP lists |
| **Properties & Models** | Override active model, transform rules, or the final response object |
| **Routes Policy** | Override allowed methods, auth requirements, or redirect targets per route |
| **Webhooks** | Filter outgoing payload, headers, or disable delivery conditionally |
| **Automations** | Modify trigger context or action parameters before execution |

---

## FAQ

**Can I add custom authentication methods?**

Yes. Use the authentication hooks to register a custom token validator. The filter receives the request object and must return a WP_User on success or a WP_Error on failure.

**Do hooks run in the correct order with other plugins?**

The plugin applies filters inside the `rest_pre_dispatch` and `rest_post_dispatch` hooks, giving it a predictable position in the WordPress REST API lifecycle. Third-party plugins that also hook into these events can coexist without conflict as long as priority is managed.
