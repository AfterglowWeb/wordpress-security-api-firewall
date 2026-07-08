<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Properties

Models define REST response transformation rules for a post type or taxonomy. **Sitewide transforms** (resolve embedded data, flatten rendered fields, strip domain from URLs) are available in the free tier and apply globally to all routes. **Per-property control** (disable, rename or remap individual fields) and **custom schemas** require Pro.

Transformations run server-side before the response is sent, removing the need for client-side data massaging.

<figure>
  <img src="/wordpress-application-layer-properties-global-settings.webp" alt="Properties — Global Settings" />
  <figcaption>Properties — Global Settings</figcaption>
</figure>

---

<details>
<summary>WordPress Schema</summary>

<p>The <strong>WordPress schema</strong> applies the standard WP REST response structure with optional transforms layered on top. Available transforms:</p>
<ul>
  <li><strong>Relative URLs</strong> — strips the domain from attachment and post link fields</li>
  <li><strong>Embedded terms</strong> — inlines taxonomy term objects</li>
  <li><strong>Embedded author</strong> — inlines the author user object</li>
  <li><strong>Embedded attachments</strong> — inlines all post attachments</li>
  <li><strong>Resolve rendered props</strong> — unwraps <code>rendered</code> wrappers (e.g. <code>title.rendered</code> → <code>title</code>)</li>
  <li><strong>Remove empty props</strong> <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span> — strips null and empty string fields</li>
  <li><strong>Remove <code>_links</code></strong> <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span> — removes the HAL links object</li>
  <li><strong>Remove <code>_embedded</code></strong> <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span> — removes sideloaded embed data</li>
</ul>

<figure>
  <img src="/wordpress-application-layer-properties-wordpress-schema.webp" alt="Properties — WordPress Schema" />
  <figcaption>Properties — WordPress Schema</figcaption>
</figure>

</details>

<details>
<summary>Per-Property Control <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>In Pro, each individual property in the WordPress schema can be managed at field level:</p>
<ul>
  <li><strong>Disable</strong> — remove a specific property from the response</li>
  <li><strong>Rename</strong> — expose a property under a different key (e.g. <code>title.rendered</code> → <code>headline</code>)</li>
  <li><strong>Remap</strong> — source a property's value from a different field in the original response</li>
</ul>
<p>These rules layer on top of the sitewide transforms and apply to the WordPress schema mode only.</p>

<figure>
  <img src="/wordpress-application-layer-properties-model.webp" alt="Properties — Model" />
  <figcaption>Properties — Model</figcaption>
</figure>

</details>

<details>
<summary>Custom Schema <span style="display:inline-block;padding:1px 6px;border-radius:3px;background:#1565c0;color:#fff;font-size:10px;font-weight:600">PRO</span></summary>

<p>The <strong>custom schema</strong> replaces the full REST response with a hand-crafted property map. Define each top-level key you want in the response and map it to a dot-path from the original REST response (e.g. <code>"headline": "title.rendered"</code>). You can also add static values.</p>
<p>Properties in a custom schema support the same sitewide transforms as the WordPress schema:</p>
<ul>
  <li><strong>Resolve media</strong> — replace an attachment ID with the full media object. The resolved object uses the active model you have defined for the <code>attachment</code> type; if none is defined it falls back to the default WP REST response.</li>
  <li><strong>Resolve terms</strong> — replace term IDs with full term objects. The resolved object uses the active model for that taxonomy; if none is defined it falls back to the default WP REST response.</li>
  <li><strong>Resolve author</strong> — replace author ID with the full user object. The resolved object uses the active model for <code>user</code>; if none is defined it falls back to the default WP REST response.</li>
  <li><strong>Filter URL</strong> — strip the domain from URL fields (relative URLs)</li>
  <li><strong>Search &amp; replace</strong> <em>(under development)</em> — apply text substitutions to string field values</li>
</ul>
<p>Use this mode to produce a minimal, application-specific payload that hides WordPress internals entirely.</p>

<figure>
  <img src="/wordpress-application-layer-properties-custom-schema.webp" alt="Properties — Custom Schema" />
  <figcaption>Properties — Custom Schema</figcaption>
</figure>

</details>

<details>
<summary>Test</summary>

<p>The <strong>Test</strong> tab fetches a live sample entry from WordPress and displays the raw REST response alongside the transformed result side by side. Use it to verify your schema before deploying — no external request needed.</p>
<p>The test uses the first available entry of the model's object type and runs the full transform pipeline.</p>

<figure>
  <img src="/wordpress-application-layer-properties-test.webp" alt="Properties — Test" />
  <figcaption>Properties — Test</figcaption>
</figure>

</details>

---

**Entry type:** Model (Post type or Taxonomy)

- [MUI DataGrid — sorting, filtering &amp; pagination](https://mui.com/x/react-data-grid/)

---

## FAQ

**Can I define one model per post type and one per taxonomy?**

You can define as many models as you want for the same object type, but only one can be active at a time. This lets you maintain multiple schema variants (e.g. a minimal public schema and a richer internal one) and switch between them without deleting the others.

**Do models apply globally or per application?**

In Pro, models are scoped per application. The same post type can be served with a minimal public schema to one application and a richer internal schema to another — each application has its own active model per object type. In the free tier, one model per object type applies to all consumers.

**Which routes support property-level filtering?**

Property-level control (disable, rename, remap, custom schema) currently applies to standard WordPress object routes — posts, pages, custom post types, taxonomies, users, and media (`/wp/v2/`). The `/wp/v2/settings` route is also supported: you can pull ACF options pages and resolved menus, and edit the properties of that endpoint.

For other routes (third-party plugin endpoints), you can already explore their schema in the Routes explorer, and fine-grained property filtering is coming very soon. In the meantime, those routes support disable, auth enforcement, rate limiting, and redirect at the route level.
