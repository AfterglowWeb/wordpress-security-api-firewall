<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Settings Route

The `/wp/v2/settings` endpoint is a special WordPress REST route that exposes site-level configuration. Application Layer extends it with two additional data sources — ACF options pages and WordPress navigation menus — and applies the same schema editing tools available in the [Properties & Models](/models/models) panel.

This makes `/wp/v2/settings` a convenient single endpoint for front-ends that need global site data: navigation, options, and configuration in one request, shaped to your schema.

---

## Additional Properties

Beyond the standard WordPress settings fields, the following can be pulled into the response:

### ACF Options Pages

A single option lets you include all registered ACF options pages as top-level properties. When enabled, every options page is added in full. In Pro, use the per-property control or custom schema to narrow down or restructure the data you want to expose.

### Resolved WordPress Menus

Registered WordPress navigation menus can be included as a top-level property. Each menu is resolved to its full item tree — including labels, URLs, target, and nested children — rather than returning raw menu IDs.

---

## Schema Editing

The schema editor for the settings route works identically to the one described in [Properties & Models](/models/models).

<details>
<summary>WordPress Schema</summary>

<p>Applies the standard <code>/wp/v2/settings</code> response with optional transforms layered on top:</p>
<ul>
  <li><strong>Relative URLs</strong> — strips the domain from URL fields</li>
  <li><strong>Resolve rendered props</strong> — unwraps <code>rendered</code> wrappers</li>
  <li><strong>Remove empty props</strong> <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span> — strips null and empty string fields</li>
  <li><strong>Remove <code>_links</code></strong> — removes the HAL links object</li>
</ul>

</details>

<details>
<summary>Per-Property Control <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>Each individual property in the response can be managed at field level:</p>
<ul>
  <li><strong>Disable</strong> — remove a specific property from the response</li>
  <li><strong>Rename</strong> — expose a property under a different key</li>
  <li><strong>Remap</strong> — source a property's value from a different field in the original response</li>
</ul>

</details>

<details>
<summary>Custom Schema <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>Replaces the full response with a hand-crafted property map. Define each top-level key and map it to a dot-path from the original response. Properties support the following per-property transforms:</p>
<ul>
  <li><strong>Resolve media</strong> — replace an attachment ID with the full media object. Uses the active model for <code>attachment</code> if defined, otherwise falls back to the default WP REST response.</li>
  <li><strong>Filter URL</strong> — strip the domain from URL fields (relative URLs)</li>
  <li><strong>Search &amp; replace</strong> <em>(under development)</em> — apply text substitutions to string field values</li>
</ul>

</details>

<details>
<summary>Test</summary>

<p>The <strong>Test</strong> tab fetches the live <code>/wp/v2/settings</code> response and displays the raw output alongside the transformed result side by side. Verify your schema before publishing — no external request needed.</p>

</details>

---

**Entry type:** Model (Settings route)

---

## FAQ

**Is this route available in the free tier?**

The route explorer lets you inspect the `/wp/v2/settings` schema in the free tier. Schema editing (per-property control, custom schema, ACF options pages, resolved menus) requires Pro.

**Are ACF options pages included automatically?**

No. You enable a single option to include all registered ACF options pages as top-level properties. When the option is off they are not added to the response. Use the Pro schema editor (per-property control or custom schema) to filter or restructure the output.

**Can I restrict access to this endpoint?**

Yes. Like any route, `/wp/v2/settings` can have auth enforcement, rate limiting, and HTTP method restrictions applied via the [Routes panel](/routes/routes).
