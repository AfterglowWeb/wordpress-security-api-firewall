<span style="display:inline-block;padding:1px 8px;border-radius:3px;background:#1565c0;color:#fff;font-size:11px;font-weight:600">PRO</span>

# Emails

Email templates define reusable transactional messages fired by [Automations](/automations/automations). Emails are a Pro feature and do not exist in the free tier.

---

## Emails List

The default view is the emails list. It follows the same pattern as other entry lists in the plugin:

- **Add** a new template with the add button.
- **Enable / Disable** an entry with the toggle. A confirmation is required.
- **Delete** an entry. A confirmation is required.

---

## Email Editor

- **Title** — display name used in the admin list.
- **Description** — internal notes, not sent to recipients.
- **To** — recipient email address.
- **CC** — carbon copy recipients.
- **BCC** — blind carbon copy recipients.
- **Subject** — email subject line.
- **Body** — HTML email content. A full payload mapping system — allowing automation event data to be referenced as placeholders in the subject and body — is coming soon.

---

## SMTP Settings

The second tab in the panel is SMTP configuration. Like all settings in Pro, SMTP is scoped per application — each application can use a different sender identity and mail server.

Configurable fields: SMTP host, port, encryption, username, password, and sender name / address. If SMTP is disabled, WordPress `wp_mail()` is used as fallback.

---

## FAQ

**How are emails triggered?**

Emails are fired by automations. Create an automation, configure its event and conditions, then add a *Send Email* action pointing to a template.

**Can I send to multiple recipients?**

Yes. Fill in To, CC, and BCC as needed. Multiple addresses in the same field can be comma-separated.

**Are sent emails logged?**

Sent emails are recorded in the application log with timestamp, recipient, and delivery status.
