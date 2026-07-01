# Coolify Deployment Notes

Target:

- VPS: `root@31.97.12.201`
- Temporary domain: `my.constructedmatter.com`
- Future production domain: `constructedmatter.com`
- GitHub repo: `https://github.com/Qallus/cmi.git`

## Coolify App Setup

1. Create a new application in Coolify from the GitHub repo.
2. Use Dockerfile build mode.
3. Set the exposed port to `3000`.
4. Attach the domain `my.constructedmatter.com`.
5. Enable HTTPS / Let's Encrypt.
6. Set environment variables from `.env.example`.

## Build-time vs Runtime variables — READ THIS (security critical)

A deploy leaked secrets because Coolify was injecting **every** environment
variable into the image as a Docker `--build-arg`. Build args are baked into
image layers/metadata (`docker history`) — so any secret marked "build variable"
is effectively published inside the image.

**Rule: exactly one variable may be a build variable — `NEXT_PUBLIC_APP_URL`.
Everything else is runtime-only.** The `Dockerfile` enforces this on its side
(it only declares `ARG NEXT_PUBLIC_APP_URL`); you must enforce the matching
setting in Coolify.

In the Coolify app → **Environment Variables**, for each variable:

- `NEXT_PUBLIC_APP_URL` → **Build Variable = ON** (needs to be inlined at build).
- **Every other variable** (all `SUPABASE_*`, `SESSION_SECRET`,
  `STAFF_USERS_JSON`, `TWILIO_*`, `SMTP_*`, `IMAP_*`, `RESEND_*`, `HERMES_*`,
  `OPENAI_API_KEY`, `RECAPTCHA_*`, `WP_*`, `NOTIFY_*`, `PUBLIC_SITE_URL`, …) →
  **Build Variable = OFF** (runtime only).

The server reads these from `process.env` at run time, so runtime-only is all it
ever needs. If you ever see a secret listed as an `ARG …=value` line in the
deploy log's "Final Dockerfile", a secret is still marked as a build variable —
turn it off.

## Required Environment Variables

Set these in Coolify, not in the repo. Unless noted, keep **Build Variable =
OFF** (runtime only):

```text
NODE_ENV=production
PORT=3000
PUBLIC_SITE_URL=https://my.constructedmatter.com
SESSION_SECRET=<long random string>
STAFF_USERS_JSON=[{"email":"you@example.com","name":"Your Name","role":"staff","password":"temporary-strong-password"}]
SUPABASE_URL=<supabase url>
SUPABASE_ANON_KEY=<supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<supabase service role key>
WP_BASE_URL=https://wp-constructedmatter-com-985548.hostingersite.com/wp-json
WP_BASIC_USER=<wordpress user/email>
WP_BASIC_APP_PASSWORD=<rotated wordpress app password>
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_MESSAGING_SERVICE_SID=<preferred, if available>
TWILIO_FROM_NUMBER=<fallback number if no messaging service sid>
BOLT_AGENT_URL=https://agent.constructedmatter.com
BOLT_AGENT_API_KEY=<bolt api key>
NOTIFY_EMAIL=hello@constructedmatter.com
NOTIFY_BCC=jeremy@constructedmatter.com
SMTP_ENDPOINT=<optional mailer endpoint>
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<temporary mailbox>
SMTP_PASS=<temporary mailbox password>
MAIL_FROM=<temporary mailbox>
IMAP_HOST=imap.hostinger.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=<temporary mailbox>
IMAP_PASS=<temporary mailbox password>
```

`STAFF_USERS_JSON` is the live login source for `/api/auth/login`. Add the CMI admins and staff in Coolify with their real passwords or `password_hash` values. Do not commit that JSON with real passwords to Git.

## Supabase

Run in this order:

1. `supabase/schema.sql` if this is a fresh database.
2. `supabase/production_extensions.sql`.

Then confirm the old `anon_all_*` policies are gone.

## Twilio

Configure these webhooks:

```text
Inbound SMS:     https://my.constructedmatter.com/api/twilio/inbound
Status callback: https://my.constructedmatter.com/api/twilio/status-callback
```

When the primary domain changes, update:

- `PUBLIC_SITE_URL`
- Twilio webhook URLs
- Any generated share links/QR links that should use the new domain

## Smoke Test

```text
GET  https://my.constructedmatter.com/health
POST https://my.constructedmatter.com/api/auth/login
GET  https://my.constructedmatter.com/api/auth/session
GET  https://my.constructedmatter.com/staff-dashboard.html
POST https://my.constructedmatter.com/api/messages/send
POST https://my.constructedmatter.com/api/leads/contact
POST https://my.constructedmatter.com/api/leads/quote
```

## Immediate Secret Rotation

Rotate these before deployment:

- Any staff passwords/access codes that were previously embedded in `dashboard.html`.
- The WordPress application password previously embedded in `staff-dashboard.html`.
- The FluentCRM webhook hash previously embedded in public pages, if possible.

### Rotate now — leaked via a build log (2026-07-01)

These appeared as build-arg values in a deployment log and must be treated as
compromised. Rotate each, then update the (runtime-only) value in Coolify:

- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` (Supabase → API settings).
- `SESSION_SECRET` (generate a new long random string; invalidates sessions).
- `STAFF_USERS_JSON` staff passwords (set new passwords for all listed admins).
- `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY_SID` / `TWILIO_API_KEY_SECRET`
  (Twilio console → API keys; roll the auth token).
- `SMTP_PASS` / `IMAP_PASS` (Hostinger mailbox password).
- `RESEND_API_KEY` and `OPENAI_API_KEY` / `HERMES_AGENT_API_KEY`.
- `RECAPTCHA_SECRET_KEY`.
- `WP_BASIC_APP_PASSWORD` (WordPress application password).

After rotating, confirm the next deploy's "Final Dockerfile" shows **no**
`ARG <secret>=…` lines — only `ARG NEXT_PUBLIC_APP_URL`.

## Git Push

After reviewing the diff:

```bash
git add .
git commit -m "Add production backend and Coolify deployment"
git push origin main
```

Coolify should redeploy automatically if GitHub webhooks are enabled. Otherwise, trigger a manual redeploy.
