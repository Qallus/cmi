# Constructed Matter Production API Contract

This static frontend now expects same-origin backend endpoints. The backend must hold all WordPress, FluentCRM, Fluent Boards, Twilio, Supabase service-role, email, and Bolt Agent secrets.

## Required Environment Variables

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WP_BASE_URL=https://wp-constructedmatter-com-985548.hostingersite.com/wp-json
WP_BASIC_USER=
WP_BASIC_APP_PASSWORD=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_MESSAGING_SERVICE_SID=
TWILIO_FROM_NUMBER=
BOLT_AGENT_URL=https://agent.constructedmatter.com
BOLT_AGENT_API_KEY=
SESSION_SECRET=
NOTIFY_EMAIL=
NOTIFY_BCC=
SMTP_ENDPOINT=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
IMAP_HOST=
IMAP_PORT=
IMAP_SECURE=
IMAP_USER=
IMAP_PASS=
PUBLIC_SITE_URL=
```

## Auth

### `POST /api/auth/login`

Request:

```json
{ "email": "user@example.com", "password": "secret" }
```

Response:

```json
{ "token": "jwt-or-session-token", "role": "staff", "name": "J. Waters" }
```

Requirements:

- Validate credentials server-side.
- Set a secure, HTTP-only, same-site cookie when possible.
- Return only a short-lived token to browser storage if a cookie-only setup is not available.
- Roles: `staff`, `client`, `vendor`.

### `POST /api/auth/register`

Creates a contact, optional client user, FluentCRM subscriber, and verification email.

## WordPress Proxy

### `ANY /api/wp-json/*`

Proxy authenticated dashboard requests to `WP_BASE_URL`.

Requirements:

- Require valid staff session.
- Inject WordPress Basic/Auth header server-side.
- Preserve method, body, query string, and content headers.
- Block unexpected high-risk routes unless explicitly allowed.

Initial allowlist:

```text
/wp/v2/posts
/wp/v2/categories
/wp/v2/tags
/wp/v2/users
/wp/v2/media
/fluent-crm/v2/*
/fluent-boards/v2/*
/fluent-booking/v2/*
```

## Leads And Notifications

### `POST /api/leads/contact`

Create/update:

- Supabase `contacts`
- Supabase `quotes` when project fields are present
- FluentCRM contact/list/tags
- Email notification
- Optional Bolt follow-up suggestion

### `POST /api/leads/quote`

Create/update:

- Supabase `contacts`
- Supabase `quotes`
- FluentCRM contact/list/tags/custom fields
- Email notification
- Optional project intake Bolt summary

### `POST /api/notifications/email`

Staff-only server-side mailer endpoint for internal/dashboard use. Public lead
forms should rely on `/api/leads/contact` and `/api/leads/quote` to send
sanitized notifications server-side.

## Messaging / Twilio

### `POST /api/messages/send`

Request:

```json
{
  "to": "+14805550123",
  "body": "Message body",
  "contact_id": "uuid-or-null",
  "client_project_id": "uuid-or-null",
  "channel": "sms"
}
```

Behavior:

- Require staff session.
- Check `sms_opt_outs`.
- Send via Twilio.
- Insert/update `message_threads` and `messages`.
- Return provider SID and status.

### `POST /api/messages/bulk`

Request:

```json
{
  "name": "May client update",
  "segment": { "type": "Client", "tags": ["Active Project"] },
  "body": "Bulk message body",
  "scheduled_at": null
}
```

Behavior:

- Require staff session.
- Create `bulk_campaigns` and `bulk_campaign_recipients`.
- Queue sends with rate limiting.
- Skip opt-outs and invalid numbers.

### `POST /api/twilio/inbound`

Twilio webhook for inbound SMS.

Behavior:

- Validate Twilio signature.
- Store raw payload in `twilio_webhook_events`.
- Match phone to `contacts`.
- Insert inbound `messages`.
- Create/update `message_threads`.
- Trigger Bolt summary/reply suggestion.

### `POST /api/twilio/status-callback`

Twilio delivery callback.

Behavior:

- Validate Twilio signature.
- Update `messages.status`, `sent_at`, `delivered_at`, `error_message`.

## Bolt Agent

### `POST /api/bolt/runs`

Uses the OpenAI-compatible Bolt API:

```js
new OpenAI({
  baseURL: `${BOLT_AGENT_URL}/v1`,
  apiKey: BOLT_AGENT_API_KEY
})
```

Model is always `hermes-agent`.

Request:

```json
{
  "run_type": "draft_project_update",
  "client_project_id": "uuid",
  "input": {
    "field_notes": "Notes",
    "photos": []
  }
}
```

Behavior:

- Require staff session.
- Insert `hermes_agent_runs`.
- Call Bolt Agent service.
- Store prompt/messages/output.
- Return generated draft and `run_id`.
- Any outbound communication must be `needs_approval` first.

### `POST /api/bolt/runs/:id/approve`

Approves a proposed draft/message/update and optionally publishes/sends it.

## Client Project Pages

### `GET /api/client-projects/:slug`

Authenticated client/staff project payload.

### `GET /api/share/:token`

Public or limited share payload.

Requirements:

- Reject revoked/expired tokens.
- Increment `project_share_links.scan_count`.
- Return only visibility-approved updates/media/documents.

### `POST /api/client-projects/:id/share-links`

Create expiring/revocable share link and optional QR code.

### `POST /api/client-projects/:id/updates`

Create draft/published update. Supports Bolt-generated drafts and SMS/email notifications.

## Production Security Checklist

- Never expose WordPress Basic Auth, Twilio Auth Token, Supabase service role, or Bolt key in HTML.
- Rotate any secrets that were previously committed or shipped.
- Run `supabase/production_extensions.sql` and verify anon CRUD policies are gone.
- Enforce HTTPS.
- Add request rate limiting to auth, leads, messaging, and Twilio webhooks.
- Log all sends, webhooks, Bolt outputs, approvals, and share-link scans.
