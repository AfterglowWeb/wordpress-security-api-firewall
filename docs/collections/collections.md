<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Collections

Collections extends REST API list endpoints with per-page enforcement and drag-and-drop ordering for posts and taxonomy terms. Like all Pro modules, Collections is scoped per application — each application can have its own per-page limits and its own sort order for each object type.

<figure>
  <img src="/wordpress-application-layer-collections.webp" alt="Collections" />
  <figcaption>Collections</figcaption>
</figure>

---

## Per Page Enforcement

Control how many items list endpoints return per request. Limits are configured per object type: set a value for posts, pages, any custom post type, attachments, or taxonomy terms individually. This replaces the WordPress default `per_page` parameter behaviour for the application.

---

## Drag-and-Drop Sorting

Drag-and-drop ordering is available for **public post types** and **public taxonomies** only.

Reordering is managed directly in the Collections panel — not in the WordPress post list admin screen.

### Object selection

A single selector lists all available public objects (post types and taxonomies). Select the object type you want to reorder. Once selected, the full list of entries for that object is loaded in the panel below and can be dragged to reorder.

If you need to reorder multiple object types, choose each one from the dropdown in turn. The order is saved per object type, per application.

### Reorder panel

Entries are displayed in a paginated list. Page size is configurable up to a maximum of 100 items per page. Drag rows to set their position. The saved order is always consistent across all pages — moving an entry on page 2 correctly offsets every entry across the full dataset.

Additional toolbar actions:

- **Invert order** — reverses the current sequence of all entries in one click.
- **Restore default order** — resets all positions to the WordPress default order. A confirmation is required before the reset is applied.

### Order enforcement

- **Apply Sort Order in REST Requests** — when no `orderby` parameter is present in a REST list request, the saved order is applied automatically.

---

## FAQ

**How is sort order stored?**

Order is stored in the `menu_order` meta field on both posts and taxonomy terms.

- In the **free tier**, the value is stored as a single scalar keyed to `default_app`.
- In **Pro**, each application stores its own order: `{ app_id: order }`.

This means the same post or term can have a different position in each application's response.

On uninstallation, these meta values can optionally be removed. This behaviour is configurable in the global plugin settings panel.

**Does drag-and-drop work across pagination?**

Yes, the list sequence is maintained regardless of which page you are viewing.

**Which object types support ordering?**

Only public post types and public taxonomies. Private post types and non-public taxonomies are not available in the object selector.
