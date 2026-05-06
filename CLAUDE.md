# CLAUDE.md — Constructed Matter / CMI Web App

## Read This First

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

Also read the root-level `AGENTS.md` file before implementing changes.

---

## Project Summary

This project is a hybrid static website / staff dashboard for Constructed Matter, Inc. The app appears to use plain HTML, JavaScript, Supabase, and integrations with WordPress, FluentCRM Pro, FluentBoards Pro, FluentBooking Pro, WS Form, and Resend.

The project is close to complete, but it needs a full codebase review and cleanup, especially around:

- Supabase data tables.
- Projects dashboard.
- Portfolio dashboard.
- WordPress portfolio/team/blog syncing.
- FluentCRM contacts.
- FluentBoards projects/tasks.
- FluentBooking appointments.
- WS Form quotes/leads.
- Resend email logging.
- Dashboard security.
- RLS policies.
- API/webhook settings.
- Broken dashboard placeholders and incomplete UI states.

Do not rebuild the site from scratch. Preserve the existing build and improve it carefully.

---

## Working Style

When working in this repo:

- Inspect before editing.
- Understand the current architecture.
- Preserve working code.
- Avoid large rewrites.
- Keep changes small and targeted.
- Follow existing file patterns.
- Do not assume this is a Next.js app unless the repo proves it.
- Treat it as a hybrid HTML/JS app unless code inspection shows otherwise.
- Protect secrets.
- Protect client/contact/project/document data.
- Improve Supabase schema safely.
- Add SQL changes in clear files or migrations.
- Explain blockers clearly.

---

## Current Known Dashboard Structure

The staff dashboard includes these sections:

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

Important dashboard features include:

- Portfolio “New Project” form.
- Projects / FluentBoards area.
- Blog editor.
- FluentCRM contacts manager.
- FluentBooking bookings list/calendar/add appointment.
- Quotes & Leads area.
- Team member add/edit forms.
- Documents, contracts, and SOW generator forms.
- WordPress API settings.
- FluentCRM webhook settings.

---

## Key Project Goal

Perform a full analysis and create an implementation plan for finishing the CMI website and dashboard.

The most important areas are:

1. Supabase schema cleanup.
2. Projects dashboard completion.
3. Portfolio dashboard completion.
4. Clear relationship between internal projects and public portfolio items.
5. WordPress API sync for portfolio/team/blog.
6. FluentBoards task/project sync.
7. FluentCRM contact/list/tag sync.
8. FluentBooking appointment sync.
9. WS Form quote/lead ingestion.
10. Resend email sending/logging.
11. Secure settings and environment variables.
12. RLS and dashboard access control.

---

## First Review Instructions

For the first review, do not edit files.

Inspect:

```text
README or project notes if present
index.html
staff-dashboard.html
dashboard.html
portfolio.html
team.html
quote.html
contact.html
resources.html
regen.html
services/
resources/
portfolio/
team/
supabase/schema.sql
supabase/seed.sql
any JavaScript files
any API/helper files
any config files
```

Return:

```text
1. Executive Summary
2. Current Architecture
3. Current Supabase Schema
4. Data Relationship Gaps
5. Projects Section Review
6. Portfolio Section Review
7. WordPress API Review
8. FluentCRM Review
9. FluentBoards Review
10. FluentBooking Review
11. WS Form Review
12. Resend Review
13. Dashboard Security/RLS Review
14. UI/UX Cleanup Items
15. Recommended Data Table Updates
16. Phase 1 Implementation Plan
17. Phase 2 Implementation Plan
18. Phase 3 Implementation Plan
19. Blockers / Questions
```

---

## Supabase Context

Current core schema appears to include these tables:

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

Review and improve these relationships:

```text
contacts
  -> quotes
  -> bookings
  -> projects
  -> documents
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

Recommended additional tables to consider:

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

Do not blindly create all of these. First inspect what already exists and propose a safe migration plan.

---

## Projects vs Portfolio

Keep this distinction clear.

### Projects

Internal operational work, mostly connected to FluentBoards.

Projects should track:

- Client/contact.
- Internal status.
- Stage.
- Priority.
- Budget.
- Dates.
- Assignees.
- Tasks.
- Notes.
- Documents.
- FluentBoards IDs.
- Internal project state.

### Portfolio

Public-facing website showcase items, mostly connected to WordPress CPT.

Portfolio should track:

- Public title.
- Slug.
- Category.
- Services used.
- Year.
- Location.
- Timeline.
- Square feet.
- Description.
- Featured image.
- Gallery.
- Video.
- Status.
- Sort order.
- WordPress post ID.
- SEO fields.
- Published date.

A project can become a portfolio item, but not every internal project should be public.

Add or recommend a relationship such as:

```text
portfolio.project_id -> projects.id
```

or:

```text
projects.portfolio_id -> portfolio.id
```

Choose the direction based on current code.

---

## Integration Expectations

### WordPress API

Used for:

- Portfolio CPT.
- Team CPT.
- Blog posts.
- Media.
- Public website content sync.

Review:

- Credentials.
- Endpoints.
- Media upload.
- Create/update/delete behavior.
- Sync status.
- Error handling.
- Logs.

### FluentCRM Pro

Used for:

- Contacts.
- Lists.
- Tags.
- Lead/customer metadata.
- Email marketing triggers.

Review:

- Contact sync.
- Lists/tags.
- Quote metadata.
- Booking metadata.
- Contact status.
- Error logging.

### FluentBoards Pro

Used for:

- Projects.
- Tasks.
- Stages.
- Assignees.
- Due dates.
- Workflow tracking.

Review:

- Board/task IDs.
- Sync direction.
- Stage/status mapping.
- Priority mapping.
- Task creation/update.
- Error logging.

### FluentBooking Pro

Used for:

- Appointments.
- Event types.
- Calendar/list views.
- Booking status.
- Host data.

Review:

- Booking sync.
- Appointment creation.
- Contact matching.
- Event type mapping.
- Status mapping.
- Error logging.

### WS Form

Used for:

- Quote/contact forms on WordPress or public site.
- Lead capture.
- Metadata.

Review:

- Submission webhook.
- Quote creation.
- Contact creation/update.
- Source tracking.
- Notifications.

### Resend

Used for transactional emails.

Review:

- API key handling.
- Email templates.
- Notifications.
- Booking confirmation emails.
- Quote follow-up emails.
- Document/SOW sends.
- Delivery/bounce/error logs.

---

## Security Priorities

The dashboard appears to store or manage sensitive data:

```text
Contacts
Client information
Quotes/leads
Projects
Budgets
Contracts
SOWs
Bookings
WordPress credentials
Webhook URLs
CRM data
```

Security requirements:

- Do not expose secrets in frontend JavaScript.
- Do not store API keys directly in local browser storage.
- Use environment variables or backend/config storage.
- Protect dashboard routes.
- Improve RLS from anonymous CRUD to public-read/staff-write where appropriate.
- Keep contacts, quotes, bookings, documents, settings, and internal projects private.
- Public visitors should only read published public content.
- Staff/admin access should be server-validated where possible.
- Webhooks should verify secrets.
- Integration logs should avoid storing raw secrets.

---

## Dashboard Cleanup Priorities

Review and clean:

- Broken characters like `�`.
- Placeholder headings like `### �`.
- `??` icons or placeholders.
- “Navigate here to load...” behavior.
- Empty state messaging.
- Loading states.
- Error states.
- Save success states.
- Form validation.
- Responsive layout.
- Portfolio image upload.
- Gallery upload.
- Team secondary/hover photo behavior.
- Key attributes as structured data.
- Document export/PDF behavior.
- Settings page credential safety.

---

## Suggested First Prompt for Claude Code

```text
Read CLAUDE.md and AGENTS.md first.

Inspect the Constructed Matter / CMI repo only. Do not edit files yet.

Review the current website, staff dashboard, Supabase schema, Projects section, Portfolio section, WordPress API sync, FluentCRM, FluentBoards, FluentBooking, WS Form, Resend, environment variables, dashboard security, and RLS policies.

Provide a full technical review that identifies what exists, what is incomplete, what is missing, and what should be built first. Then provide a phased implementation plan.
```

---

## Final Priorities

When making tradeoffs, prioritize:

1. Security and secrets handling.
2. Supabase schema correctness.
3. Projects and Portfolio data relationship.
4. Dashboard save/load behavior.
5. WordPress CPT sync.
6. FluentCRM contact sync.
7. FluentBoards project/task sync.
8. FluentBooking appointments.
9. WS Form lead capture.
10. Resend email logging.
11. UI polish and cleanup.
