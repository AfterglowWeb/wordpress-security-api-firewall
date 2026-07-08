<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Migration and Fallback

This page covers the admin-facing migration workflows between Free and Pro.

---

## Free to Pro Migration

On first Pro setup, you can migrate your existing Free configuration into an initial application.

What the wizard helps you move:

- core auth and rate-limit posture,
- route policy baseline,
- key user-facing defaults.

Recommended flow:

1. activate license,
2. run migration,
3. review migrated application settings,
4. enable application when validated.

---

## Pro to Free Fallback

If Pro is deactivated or license becomes invalid, the fallback notice guides you through exporting one application back to Free-compatible settings.

Important UX expectations:

- export is explicit (you choose when),
- one application can be exported at a time,
- Pro data is preserved for future reactivation.

---

## Deletion and Lifecycle Notes

Deleting an application removes its active ownership context. Depending on module type, records may be detached and disabled rather than immediately erased.

Operational recommendation:

1. export or archive settings first,
2. confirm no production traffic depends on the app,
3. then delete.

---

## Related Docs

- [Applications](/applications/applications)
- [Auth & Rate Limiting](/users/users)
- [Routes & Exposure Control](/routes/routes)
- [WordPress Mode](/wordpress-mode/wordpress-mode)
