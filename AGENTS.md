# AGENTS.md — Constructed Matter / CMI Web App

## Project

You are working on the Constructed Matter, Inc. hybrid website and staff web app.

Primary public site:

```text
https://my.constructedmatter.com/
```

Primary staff dashboard:

```text
https://my.constructedmatter.com/staff-dashboard.html
```

GitHub repository:

```text
https://github.com/Qallus/cmi
```

This is a hybrid HTML/JS website and dashboard connected to Supabase, Resend, WordPress, FluentCRM Pro, FluentBoards Pro, FluentBooking Pro, WS Form, and the WordPress API.

The site is close to complete. Your job is to inspect the existing codebase, identify loose ends, and help button up the project without rebuilding it from scratch.

---

## Main Objective

Perform a full codebase and data-model review, then create a safe implementation plan for completing the CMI website/web app.

Focus especially on:

1. Supabase data tables and relationships.
2. Projects section in the staff dashboard.
3. Portfolio section in the staff dashboard.
4. WordPress portfolio/team/blog sync.
5. FluentCRM contacts sync.
6. FluentBoards project/task sync.
7. FluentBooking appointments sync.
8. WS Form quote/lead submissions.
9. Resend transactional emails.
10. Dashboard settings and API/webhook configuration.
11. Security, access control, RLS, and environment variables.
12. Cleanup of broken placeholders, mojibake/encoding issues, loading states, and incomplete dashboard actions.

---

## Operating Rules

1. Inspect before editing.
2. Do not rewrite the app from scratch.
3. Preserve working code.
4. Follow the existing repo structure and plain HTML/JS patterns unless the repo clearly uses additional tooling.
5. Make the smallest safe change that fully solves the approved task.
6. Do not remove public pages or dashboard sections unless explicitly asked.
7. Do not expose API keys, Supabase service keys, WordPress app passwords, webhook secrets, or Resend keys in frontend code.
8. Do not rely on frontend-only security for the staff dashboard.
9. Use server-side or protected API routes/functions where credentials are required.
10. Create SQL migrations or clearly labeled SQL update files for Supabase changes.
11. Run available checks or syntax validation when possible.
12. Summarize changed files, data-table changes, and blockers after work.

---

## Do Not Do

Never:

- Hardcode production secrets.
- Commit `.env` values.
- Expose Supabase service role key to browser JavaScript.
- Expose WordPress app passwords to the frontend.
- Expose FluentCRM, FluentBoards, FluentBooking, WS Form, or Resend secrets to the frontend.
- Delete existing dashboard sections without approval.
- Rename database tables blindly.
- Break existing public URLs.
- Break portfolio project pages.
- Break contact/booking/quote data flows.
- Keep permissive anonymous CRUD RLS policies in production.
- Trust staff-dashboard-only UI checks as security.
- Ship forms with no error state or success confirmation.

---

## Current Known App Areas

The staff dashboard includes these sections and flows:

```text
Overview
Contacts
Projects
Bookings
Quotes & Leads
Portfolio
Blog
Team
Documents
Settings
```

The current dashboard also includes:

```text
New Project / Portfolio form
Fluent Boards project/task area
FluentCRM contacts area
FluentBooking appointments area
Quotes & Leads list
Team member add/edit forms
Documents, contracts, and SOW forms
WordPress API settings
FluentCRM webhook settings
```

Use these as current app features to inspect and complete.

---

## Important Current Issues to Look For

Inspect for:

- Incomplete loading states such as “Navigate here to load...”.
- Placeholder or broken text such as `??`, `### �`, and mojibake replacement characters.
- Projects/Portfolio mismatch or duplicated concepts.
- Portfolio data not syncing to WordPress CPT.
- Project/task data not syncing to FluentBoards.
- Contacts not syncing properly with FluentCRM.
- Bookings not syncing properly with FluentBooking.
- Quote/lead records not creating contacts or tasks.
- Team member data not syncing to WordPress team CPT.
- Blog post data not syncing to WordPress.
- Documents/SOW/contracts not saving correctly or lacking export/PDF behavior.
- Settings storing credentials insecurely.
- RLS policies allowing anonymous full CRUD.
- Media uploads relying only on URLs instead of Supabase Storage or WordPress media.
- Missing audit/integration logs.
- Missing dashboard authentication or server-side access checks.

---

## First Task Behavior

When first asked to review this project:

1. Read this `AGENTS.md`.
2. Read `CLAUDE.md` if present.
3. Inspect the repo structure.
4. Inspect `supabase/schema.sql` and any seed/migration files.
5. Inspect `staff-dashboard.html`.
6. Inspect public pages:
   - `index.html`
   - `portfolio.html`
   - `team.html`
   - `quote.html`
   - `contact.html`
   - `resources.html`
   - `regen.html`
7. Inspect any JS modules or inline scripts.
8. Inspect integration code for Supabase, WordPress, FluentCRM, FluentBoards, FluentBooking, WS Form, and Resend.
9. Inspect environment/config patterns.
10. Provide a review report.
11. Do not modify files until a plan is approved.

---

## Recommended Review Report Format

Return:

```text
1. Executive Summary
2. Current Repo / Tech Stack Findings
3. Current Supabase Schema Findings
4. Projects Dashboard Findings
5. Portfolio Dashboard Findings
6. WordPress API / CPT Sync Findings
7. FluentCRM Findings
8. FluentBoards Findings
9. FluentBooking Findings
10. WS Form / Quotes & Leads Findings
11. Resend / Email Findings
12. Security / RLS / Auth Findings
13. UI / UX / Dashboard Cleanup Findings
14. Missing Tables or Fields
15. Recommended Phase 1 Fixes
16. Recommended Phase 2 Fixes
17. Recommended Phase 3 Fixes
18. Questions / Blockers
```

---

## Supabase Tables to Verify

The current schema may already include some of these. Do not duplicate existing tables. Map and extend safely.

### Core Existing Tables to Verify

```text
contacts
projects
bookings
quotes
documents
portfolio
team_members
blog_posts
```

### Recommended Additional Tables / Improvements

Consider adding or improving these if missing:

```text
profiles
staff_users
staff_roles
clients
companies
project_categories
project_services
project_statuses
project_media
project_updates
project_tasks
project_notes
portfolio_categories
portfolio_services
portfolio_media
portfolio_metrics
quote_services
booking_event_types
document_signatures
integration_logs
webhook_events
email_logs
sms_logs
settings
api_connections
activity_logs
media_library
```

---

## Recommended Supabase Relationship Model

Use this as the target relationship reference, adapting to the existing schema.

```text
contacts
  -> quotes
  -> bookings
  -> projects
  -> documents
```

```text
companies
  -> contacts
  -> projects
```

```text
projects
  -> project_media
  -> project_updates
  -> project_tasks
  -> project_notes
  -> documents
  -> portfolio
```

```text
portfolio
  -> portfolio_media
  -> portfolio_categories
  -> portfolio_services
```

```text
team_members
  -> project_tasks
  -> projects
```

```text
blog_posts
  -> media_library
```

```text
bookings
  -> contacts
  -> booking_event_types
```

```text
quotes
  -> contacts
  -> quote_services
  -> projects
```

```text
integration_logs
  -> contacts / projects / bookings / quotes / portfolio / team_members / blog_posts / documents
```

```text
webhook_events
  -> integration_logs
```

---

## Table-Specific Review Requirements

### `contacts`

Verify it supports:

- FluentCRM ID
- First name
- Last name
- Email
- Phone
- Company
- Type: Client, Lead, Vendor, Sub Contractor
- Status
- Address fields
- Tags
- Lists if FluentCRM lists are used
- Source
- Last activity
- Notes

Recommended improvements:

- Add `company_id` if companies are separate.
- Add `fluentcrm_status`.
- Add `fluentcrm_lists`.
- Add `fluentcrm_tags`.
- Add `last_synced_at`.
- Add `sync_status`.

### `projects`

Verify it supports:

- FluentBoards board/task IDs
- Project title
- Description
- Client/contact relationship
- Status
- Stage
- Priority
- Category
- Location
- Square footage
- Budget
- Start/due/completed dates
- Board name
- Assignees
- Tags
- Image
- Portfolio relationship

Recommended improvements:

- Separate “internal project/task” from “public portfolio project.”
- Add `portfolio_id` or `is_portfolio_project`.
- Add project type, services, gallery/media, timeline, project manager, client-visible flag, internal notes.
- Add `last_synced_at` and `sync_status`.

### `portfolio`

Verify it supports:

- WordPress post ID
- Title
- Slug
- Category
- Year
- Location
- Description
- Featured image
- Gallery images
- Status
- Sort order

Recommended improvements:

- Add `project_id` to link dashboard project to public portfolio item.
- Add `services_used`.
- Add `timeline`.
- Add `square_feet`.
- Add `video_url`.
- Add `seo_title`.
- Add `seo_description`.
- Add `published_at`.
- Add `last_synced_at`.
- Add `sync_status`.

### `bookings`

Verify it supports:

- FluentBooking ID
- Contact relationship
- Booking type
- Title
- Start/end datetime
- Status
- Location
- Meeting URL
- Notes
- Host name/email

Recommended improvements:

- Add timezone.
- Add event type ID.
- Add cancellation reason.
- Add reschedule link.
- Add `last_synced_at`.
- Add `sync_status`.

### `quotes`

Verify it supports:

- FluentCRM ID
- Contact relationship
- Name/email/phone
- Project type
- Location
- Square feet
- Budget range
- Timeline
- Services
- Description
- Status
- Estimated value
- Source

Recommended improvements:

- Add WS Form submission ID.
- Add WordPress form ID.
- Add assigned staff/user.
- Add converted project ID.
- Add integration source metadata.
- Add follow-up status.
- Add `last_synced_at`.

### `documents`

Verify it supports:

- Contract and SOW types
- Client info
- Project info
- Scope/description/deliverables/exclusions
- Terms/payment/warranty/change order/dispute
- CMI rep/prepared by
- Status
- Notes

Recommended improvements:

- Use UUID primary key unless there is a reason for text IDs.
- Add `contact_id`.
- Add `project_id`.
- Add `file_url`.
- Add PDF export path.
- Add signature fields.
- Add sent/signed/completed timestamps.
- Add Resend email status.

### `team_members`

Verify it supports:

- WordPress post ID
- Name
- Slug
- Role
- Department
- Bio
- Tagline
- Email
- Phone
- Profile photo
- Secondary hover photo
- Attributes
- Availability
- Sort order
- Status

Recommended improvements:

- Store key attributes as JSON objects with title and description, not just text array.
- Add LinkedIn URL.
- Add schedule JSON.
- Add `last_synced_at`.
- Add `sync_status`.

### `blog_posts`

Verify it supports:

- WordPress post ID
- Title
- Slug
- Category
- Excerpt
- Content
- Featured image
- Author
- Status
- Published date

Recommended improvements:

- Add tags.
- Add gallery images.
- Add SEO title/description.
- Add scheduled publish datetime.
- Add `last_synced_at`.
- Add `sync_status`.

---

## Security / RLS Requirements

The project must not rely on permissive anonymous CRUD in production.

Review current policies and recommend moving toward:

- Public read only for published portfolio/team/blog/public site data.
- Authenticated staff CRUD for dashboard data.
- Service role only for sensitive integration writes.
- Private access for contacts, quotes, bookings, documents, and internal projects.
- Audit logging for staff/admin actions.
- Server-side verification for webhooks.
- No secrets in browser code.

Expected access model:

```text
Public users:
  Can read published portfolio, published team, published blog, public site content.

Staff users:
  Can read/write dashboard data based on role.

Admin users:
  Can manage settings, integrations, users, and sync jobs.

Service role / backend:
  Can process webhooks and sync data.
```

---

## Integration Requirements

### WordPress API

Verify:

- WordPress base URL.
- Auth method.
- App password handling.
- Portfolio CPT sync.
- Team CPT sync.
- Blog post sync.
- Media upload sync.
- Error handling.
- Sync logs.

### FluentCRM Pro

Verify:

- Contact create/update.
- Lists/tags sync.
- Lead/quote metadata.
- Booking metadata.
- Contact status.
- Error handling.
- Sync logs.

### FluentBoards Pro

Verify:

- Project/task sync.
- Board IDs.
- Stage/status mapping.
- Priority mapping.
- Assignee mapping.
- Due date sync.
- Error handling.
- Sync logs.

### FluentBooking Pro

Verify:

- Booking fetch/webhook.
- Appointment create/update.
- Contact mapping.
- Calendar status.
- Event type mapping.
- Host mapping.
- Error handling.
- Sync logs.

### WS Form

Verify:

- Quote/contact forms submit correctly.
- Submissions create quotes.
- Submissions create or update contacts.
- Lead source is stored.
- Notifications are sent.
- Form metadata is logged.

### Resend

Verify:

- Email templates.
- Contact/lead notifications.
- Booking confirmations.
- Quote follow-ups.
- Document/SOW/contract sends.
- Delivery/bounce/error logging.

---

## Dashboard Cleanup Priorities

Inspect and improve:

- Projects tab data loading.
- Portfolio tab CRUD and sync.
- Add Project form save/publish behavior.
- FluentBoards navigation/loading behavior.
- Contacts list loading.
- Bookings calendar/list switch.
- Quotes & Leads status updates.
- Team member add/edit, including secondary photo and key attributes.
- Documents export/PDF behavior.
- Settings page secure handling.
- Broken text/encoding issues.
- Empty states.
- Success/error toasts.
- Loading spinners.
- Form validation.
- Mobile/responsive dashboard behavior.

---

## Environment Variables to Verify

Add safe placeholders to `.env.example` if applicable.

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

WORDPRESS_BASE_URL=
WORDPRESS_USERNAME=
WORDPRESS_APP_PASSWORD=

FLUENTCRM_BASE_URL=
FLUENTCRM_API_KEY=
FLUENTCRM_API_SECRET=
FLUENTCRM_WEBHOOK_SECRET=

FLUENTBOARDS_BASE_URL=
FLUENTBOARDS_API_KEY=
FLUENTBOARDS_API_SECRET=
FLUENTBOARDS_WEBHOOK_SECRET=

FLUENTBOOKING_BASE_URL=
FLUENTBOOKING_API_KEY=
FLUENTBOOKING_API_SECRET=
FLUENTBOOKING_WEBHOOK_SECRET=

WS_FORM_WEBHOOK_SECRET=

RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_FROM_NAME=

ADMIN_EMAIL=
APP_URL=
DASHBOARD_URL=
```

---

## Acceptance Criteria

Work is complete only when:

- Existing public site and dashboard behavior is preserved.
- Data model changes are documented in SQL.
- No secrets are exposed to browser code.
- Supabase RLS is reviewed and improved.
- Dashboard actions have loading/success/error states.
- Projects and Portfolio sections save/load/sync correctly.
- WordPress/Fluent/WS Form/Resend integration gaps are identified.
- Integration logs or webhook event records exist or are planned.
- Code changes are summarized.
- Blockers are clearly listed.

---

## Suggested First Prompt

Use this as the first prompt from the user:

```text
Read AGENTS.md and CLAUDE.md first.

Inspect the Constructed Matter / CMI repo only. Do not edit files yet.

Review the current website, staff dashboard, Supabase schema, Projects section, Portfolio section, WordPress API sync, FluentCRM, FluentBoards, FluentBooking, WS Form, Resend, environment variables, dashboard security, and RLS policies.

Provide a full technical review that identifies what exists, what is incomplete, what is missing, and what should be built first. Then provide a phased implementation plan.
```
