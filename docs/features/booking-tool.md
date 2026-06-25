# Booking Tool — Feature & Replication Guide

A scheduling/appointments system: configurable appointment types, computed
availability, a public 3-step booking flow, public event pages with
registration, an admin dashboard, and side-effects (CRM contact, client user,
project schedule item, calendar-sync queue, notification queue). Built on
**Next.js (App Router) + Supabase**.

---

## 1. Feature Overview

- **Appointment types** (services) with duration, buffers, min-notice,
  max-days-in-advance, location type, color, and "creates a project schedule
  item" behavior.
- **Public booking** (`/book`) — 3-step wizard: pick type → pick date & time
  (computed slots) → enter details → confirm. Consent checkboxes (email/SMS).
- **Public event pages** (`/events/[slug]`) — one-time events with capacity,
  optional approval, and registration.
- **Admin dashboard** (`/dashboard/bookings`) — List / Calendar / Events /
  Availability views; create appointments and event pages; confirm / complete /
  cancel; assign staff; link to projects.
- **Availability engine** — generates 15-min slots from weekly rules, honoring
  buffers, min notice, max advance, blocked times, and existing appointments.
- **Side-effects on booking**: find/create CRM contact, optionally create a
  "client" user (invite), optionally create a **project schedule item** (shows on
  the Gantt), queue a **calendar-sync** event, and queue **notifications**
  (email/SMS/dashboard).
- **Calendar connections** (Google/Outlook/Apple/CalDAV/manual) + a sync queue
  (workers are future; the records/queue exist).

---

## 2. Data Model (Supabase)

RLS enabled (permissive); admin access gated at the API layer.

### `booking_appointment_types`
`name, slug, description, duration_minutes, buffer_before_minutes,
buffer_after_minutes, min_notice_minutes, max_days_in_advance, location_type
(phone_call|video_meeting|in_person|onsite|inspection|delivery|custom_location),
meeting_url, color, client_visible, creates_project_schedule_item,
default_schedule_type (task|milestone), default_phase, default_priority,
display_order, is_active`. Seeded with ~10 types (Discovery Call, Site
Consultation, Design Consultation, Estimate, Client Update, Sub Site Walk, Vendor
Delivery, Inspection, Final Walkthrough, Warranty Visit).

### `booking_appointments`
`appointment_type_id, contact_id, staff_user_id, assigned_staff_user_id,
project_id, project_schedule_item_id, event_page_id, customer_first_name/
last_name/email/phone, company_name, project_name, start_time, end_time,
timezone (default America/Phoenix), status, location_type/location/meeting_url,
customer_notes, internal_notes, cancellation_reason, client_visible,
show_on_project_manager, create_or_link_user, email_consent, sms_consent,
calendar_sync_status (queued|synced|failed|skipped|conflict), calendar_synced_at,
external_calendar_event_id, created_at/updated_at/confirmed_at/canceled_at/
completed_at`.

**AppointmentStatus**: `pending | confirmed | rescheduled | canceled | completed
| no_show | follow_up_needed | awaiting_client | awaiting_staff |
awaiting_project_info`.

### Supporting tables
- **booking_availability_rules** — weekly recurring windows: `staff_user_id?,
  appointment_type_id?, day_of_week (0–6), start_time, end_time, timezone,
  is_available`.
- **booking_blocked_times** — one-off busy periods: `staff_user_id?, title,
  start_time, end_time, reason, blocks_public_booking`.
- **booking_notifications** — outbound queue: `appointment_id?, recipient_type,
  recipient_email/phone, channel (email|sms|dashboard), notification_type,
  subject, body, status (queued|sent|failed|skipped), sent_at`.
- **booking_event_pages** — `appointment_type_id?, host_staff_user_id?,
  project_id?, title, slug (unique), summary, description, start_time, end_time,
  timezone, location_type/location/meeting_url, capacity, registration_count,
  requires_approval, client_visible, show_on_project_manager, status (draft|
  published|private|archived|canceled), seo_*`.
- **booking_event_registrations** — `event_page_id, appointment_id?, contact_id?,
  staff_user_id?, first/last/email/phone/company, status (registered|
  pending_approval|approved|waitlisted|canceled|attended|no_show), notes`.
- **booking_calendar_connections** — `staff_user_id, provider (google|outlook|
  apple_ical|caldav|manual), provider_account_email, calendar_id/name,
  sync_direction (one_way_in|one_way_out|two_way|three_way), status, token refs,
  last_synced_at`.
- **booking_calendar_sync_events** — sync queue: `connection_id?, appointment_id?,
  event_page_id?, staff_user_id, provider, provider_event_id, sync_direction,
  sync_status, payload`.
- **booking_question_fields / _answers** — optional custom form fields per type.

Relationships: appointment → contact, staff_user (client), assigned staff,
project, project_schedule_item, event_page.

> Migrations: `booking_system_phase1.sql` (types, appointments, rules, blocked
> times, notifications, question fields) + `booking_events_calendar_sync.sql`
> (event pages, registrations, calendar connections, sync queue).

---

## 3. Availability Engine (`lib/booking/availability.ts`)
`buildAvailabilitySlots({ appointmentType, dateKey, rules, appointments,
blockedTimes, now })`:
1. Day-of-week from `dateKey`; bail if beyond `max_days_in_advance`.
2. Use rules for that day where `is_available`.
3. Walk each window in **15-min steps**; slot end = start + `duration_minutes`.
4. Expand by `buffer_before/after`; skip if it overlaps any active appointment or
   blocked time, or starts before `now + min_notice_minutes`.
5. Return sorted available slots.

Constants: Phoenix offset (no DST yet), `SLOT_STEP_MINUTES = 15`, busy statuses =
pending/confirmed/rescheduled/awaiting_*.

---

## 4. API Routes

### Public (no auth)
| Route | Methods | Purpose |
|---|---|---|
| `/api/booking/appointment-types` | GET | Active types (ordered by display_order). |
| `/api/booking/availability` | GET | `?appointment_type_id=&date=YYYY-MM-DD` → slots. |
| `/api/booking/appointments` | POST | Create appointment (source `public`, status `pending`). |
| `/api/booking/events/[slug]/register` | POST | Register for an event page (capacity-checked). |

### Admin (`requireAdmin`)
| Route | Methods | Purpose |
|---|---|---|
| `/api/admin/bookings` | GET | Full `BookingData` for the dashboard. |
| `/api/admin/bookings` | POST | Create appointment (source `dashboard`, auto-confirmed) **or** `resource:"event_page"`. |
| `/api/admin/bookings` | PATCH | Update status/notes/assignment; syncs the linked schedule item. |

---

## 5. Side-effects (`lib/booking/data.ts` → `createBookingAppointment`)
On create:
1. **Contact** — find by email, else insert (`type: Lead`, source booking).
2. **Client user** (if `create_or_link_user`) — find by email, else insert a
   `staff_user` with `role_slug: client`, `status: invited`, + an invite record
   (email/SMS per consent).
3. **Project schedule item** (if `show_on_project_manager` or
   `type.creates_project_schedule_item`) — insert into `project_schedule_items`
   using the type's `default_schedule_type/phase/priority`; link back.
4. **Calendar sync** — enqueue a `booking_calendar_sync_events` row for the
   assigned staff's connection (or `manual`).
5. **Notifications** — enqueue email (if consent) + SMS (if consent) + a
   dashboard notification for staff.

On update: status transitions set `confirmed_at/canceled_at/completed_at`, sync
the linked schedule item (e.g., completed → progress 100, canceled → canceled),
and re-trigger calendar sync when staff is assigned.

Other functions: `loadBookingData`, `loadAppointmentTypes`,
`loadAvailabilitySlots`, `updateBookingAppointment`, `createBookingEventPage`,
`registerForEventPage`, `loadPublicEventPage`.

---

## 6. UI
- **Admin** `app/dashboard/bookings/` — `page.tsx` + `bookings-client.tsx`
  (List/Calendar/Events/Availability views, metrics, detail panel with
  confirm/complete/cancel, "Add appointment" + "One-time event" modals).
- **Public booking** `app/book/` — `public-booking-client.tsx` (3-step wizard +
  slot loader + summary sidebar + confirmation).
- **Event pages** `app/events/[slug]/` — `event-registration-client.tsx`
  (event info + registration form + capacity state).

---

## 7. Integrations & env
- **Notifications**: queued in `booking_notifications` (a worker sends them via
  your email/SMS providers — Resend / Twilio). Consent stored per appointment.
- **Calendar sync**: connections + a sync queue exist; OAuth workers
  (Google/Outlook) are future.
- **Project Manager**: tight integration via `project_schedule_items`
  (appointments/events can appear on the Gantt).
- **Timezone**: defaults to `America/Phoenix` (no DST logic yet — generalize for
  other regions).
- Public routes (`/book`, `/events/*`, `/api/booking/*`) must be **excluded from
  auth middleware**.

---

## 8. Replication checklist
1. Apply both booking migrations (depends on contacts, staff_users, projects,
   project_schedule_items). Seed appointment types + default Mon–Fri rules.
2. Port `lib/booking/{types,availability,data}.ts` (+ demo-data optional).
3. Implement public routes (types, availability, appointments, event register)
   and admin routes (GET/POST/PATCH).
4. Build the admin dashboard (4 views + modals), the public 3-step wizard, and
   the event registration page.
5. Wire the side-effects (contact/user/schedule-item/sync/notifications).
6. Add notification + calendar-sync workers when ready.
7. Generalize the timezone handling if you operate outside Arizona.
