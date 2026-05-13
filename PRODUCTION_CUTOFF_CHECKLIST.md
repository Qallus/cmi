# End-Of-Day Production Readiness Checklist

## P0 Before Deploy

- Rotate the WordPress application password that was previously embedded in `staff-dashboard.html`.
- Rotate all staff passwords/access codes that were previously embedded in `dashboard.html`.
- Deploy backend endpoints from `PRODUCTION_API_CONTRACT.md`.
- Run `supabase/schema.sql` only for a fresh database, then run `supabase/production_extensions.sql`.
- Verify these old policies no longer exist:
  - `anon_all_contacts`
  - `anon_all_projects`
  - `anon_all_bookings`
  - `anon_all_quotes`
  - `anon_all_documents`
  - `anon_all_portfolio`
  - `anon_all_team`
  - `anon_all_blog`
- Confirm `staff-dashboard.html` loads only after a valid `/api/auth/login` session.
- Confirm `/api/wp-json/*` requires staff auth and injects WordPress credentials server-side.
- Confirm `/api/messages/send` requires staff auth and sends through Twilio server-side.
- Confirm contact, quote, and register forms post to same-origin `/api/*` routes.

## P0 Smoke Tests

- Login as staff.
- Reject bad staff password.
- Reject unknown staff dashboard access with no token/cookie.
- Submit contact form.
- Submit quote form.
- Register a client.
- Load dashboard Contacts.
- Load dashboard Projects/Fluent Boards.
- Create a dashboard SMS to a test Twilio number.
- Receive inbound SMS from the test number.
- Verify message row exists in Supabase `messages`.
- Open `client-project.html?slug=test-project`.
- Open `client-project.html?token=test-share-token`.
- Revoke share token and verify link fails.

## P1 Today If Time Allows

- Add dashboard navigation items for:
  - Messages
  - Bulk Campaigns
  - Hermes Agent
  - Client Projects
  - Share Links / QR Codes
- Add staff UI for creating project updates.
- Add staff UI for creating share links and QR codes.
- Add Hermes draft button on project update form.
- Add delivery status badges to contact SMS history.
- Add opt-out handling for inbound `STOP`, `STOPALL`, `UNSUBSCRIBE`, `CANCEL`, `END`, and `QUIT`.

## P1 Backend Jobs

- Queue bulk SMS sends instead of sending in a blocking request.
- Add rate limiting to auth, lead forms, messaging, and webhooks.
- Add Twilio signature validation.
- Add webhook replay protection.
- Add audit logs for all staff sends and Hermes approvals.

## Known Production Gaps

- This repo is currently static HTML. The new frontend expects a same-origin backend.
- Supabase service-role operations must not be performed in browser JavaScript.
- Hermes Agent cannot safely send messages without approval records.
- Bulk messaging must honor opt-out rules and Twilio throughput limits.
- Client project links require token expiration/revocation checks server-side.
