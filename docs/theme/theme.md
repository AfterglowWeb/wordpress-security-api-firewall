<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#2e7d32;color:#fff;font-size:11px;font-weight:600">FREE</span> <span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Theme

The Theme panel groups content-surface and rendering toggles used in headless-friendly WordPress setups. It is designed for administrators who want to limit legacy front-end behavior while keeping API delivery clean.

---

## Theme Status

- Shows deployment/activation state for the bundled theme workflow.
- Gives a direct re-deploy action for controlled updates.

---

## Redirect Templates

Use template redirects when your public experience is served by another front-end.

- Enable redirect templates globally.
- Choose a WordPress page preset or a custom URL destination.
- Validate behavior on front page, archives, and login-related templates.

---

## Content and Security Toggles

- Disable Gutenberg where classic editing is preferred.
- Remove empty paragraph wrappers and emoji scripts where appropriate.
- Enable SVG/WebP support when your media policy allows it.
- Limit maximum upload weight through the UI slider.

---

## ACF Integration

- Enable ACF JSON sync for predictable field configuration workflows across environments.

---

## Recommended Headless Setup

1. Enable template redirects.
2. Set destination to your front-end URL policy.
3. Enable XML-RPC disable in [Global Security](/global-security/global-security).
4. Configure [WordPress Mode](/wordpress-mode/wordpress-mode) for Pro applications only operation.
