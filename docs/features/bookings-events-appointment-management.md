# Constructed Matter, Inc. — Bookings, Events & Appointment Management

## File Purpose

This document is the source-of-truth planning file for adding a complete Bookings, Events, and Appointment Management system to the Constructed Matter, Inc. dashboard / web app.

Recommended location:

`/docs/bookings-events-appointment-management.md`

The goal is to create a flexible booking system that integrates with users, staff, clients, vendors, subcontractors, appointments, one-time events, frontend booking pages, and projects.

This system should work like an internal scheduling platform combined with client-facing booking pages. It should support appointment scheduling, event registration, project-related meetings, staff calendars, vendor/subcontractor coordination, and project-specific booking workflows.

---

# Feature Overview

The Bookings, Events & Appointment Management system should allow Constructed Matter, Inc. to schedule, manage, and track all appointment and event activity from one central dashboard.

This includes:

- Staff appointments
- Client appointments
- Vendor appointments
- Subcontractor appointments
- Project appointments
- Site visits
- Consultations
- Project walkthroughs
- Inspections
- Design meetings
- Selections meetings
- Final walkthroughs
- Punch list reviews
- Delivery windows
- Material/vendor meetings
- One-time events
- Public event registration
- Project-specific booking pages

The system should connect directly to users, projects, clients, vendors, subcontractors, Gantt timelines, project phases, tasks, punch lists, notifications, and frontend booking pages.

---

# Primary Goals

The booking system should allow CMI to:

- Let clients book appointments through frontend booking pages.
- Let vendors and subcontractors book or confirm scheduling windows.
- Let staff/admins create and manage internal appointments.
- Let admins create one-time event booking pages.
- Connect appointments to projects.
- Connect appointments to project phases, tasks, milestones, and punch list items.
- Display appointments in list, calendar, Kanban, and Gantt-style views.
- Manage staff availability.
- Prevent scheduling conflicts.
- Notify staff, clients, vendors, and subcontractors by email, SMS, and dashboard alerts where supported.
- Track appointment status and event registration status.
- Create a scalable system similar to Cal.com or Fluent Booking Pro, but customized for CMI construction workflows.

---

# Recommended Dashboard Placement

Add this feature as a first-class dashboard module.

Suggested sidebar label:

`Bookings`

Alternative labels:

- Appointments
- Events
- Scheduling
- Calendar
- Booking Manager

Preferred label:

`Bookings`

Suggested dashboard navigation area:

```text
Dashboard
Projects
Project Management
Gantt Timeline
Tasks
Punch List
Bookings
Clients
Users
Reports
Settings
```

---

# Core Booking Types

## Staff Appointments

Used for internal scheduling and team coordination.

Examples:

- Internal project meeting
- Staff planning session
- Project manager review
- Design review
- Estimating meeting
- Site coordination meeting
- Team follow-up

## Client Appointments

Used for client-facing scheduling.

Examples:

- Initial consultation
- Site visit
- Project walkthrough
- Design meeting
- Selections meeting
- Client decision meeting
- Final walkthrough
- Punch list approval
- Warranty follow-up

## Vendor Appointments

Used for vendor coordination.

Examples:

- Vendor meeting
- Material delivery window
- Product review
- Procurement check-in
- Vendor walkthrough
- Delivery confirmation

## Subcontractor Appointments

Used for subcontractor scheduling and site coordination.

Examples:

- Subcontractor site access
- Trade start date
- Inspection prep
- Subcontractor walkthrough
- Completion review
- Repair/rework appointment

## Project Appointments

Used to connect appointments directly to active projects.

Examples:

- Project kickoff
- Phase review
- Inspection
- Client walkthrough
- Punch list review
- Final closeout meeting

## One-Time Events

Used for single scheduled events that may have attendees or registration.

Examples:

- Open house
- Ribbon cutting
- Client appreciation event
- Project milestone event
- Vendor demo
- Internal company meeting
- Training session
- Project handoff meeting
- Community event
- Special inspection event

---

# Frontend Booking Pages

The system should support public or semi-private frontend booking pages.

Suggested frontend routes:

```text
/book
/book/[bookingTypeSlug]
/appointments/[bookingTypeSlug]
/events/[eventSlug]
/projects/[projectSlug]/book
```

## Frontend Booking Page Types

### Public Booking Page

A general public-facing booking page where customers can schedule approved appointment types.

### Staff-Specific Booking Page

A booking page tied to a specific staff member’s availability.

### Project-Specific Booking Page

A booking page tied to a specific project, used for clients, vendors, or subcontractors.

### Event Registration Page

A public or private page for one-time event booking or RSVP.

### Client Portal Booking Page

A logged-in client booking page showing appointments related to their project.

### Vendor/Subcontractor Booking Page

A role-specific booking page that allows vendors and subcontractors to confirm availability, schedule access windows, or book project-related time slots.

---

# Frontend Booking Flow

The customer, client, vendor, subcontractor, or public user should be able to:

1. Open a booking page.
2. Select a booking type or event.
3. Select a date.
4. Select an available time slot.
5. Enter contact details.
6. Add notes or answer custom questions.
7. Submit the booking.
8. Receive a confirmation.
9. Receive reminders before the appointment/event.
10. Receive reschedule/cancel updates if changes occur.

## Suggested Booking Form Fields

Default fields:

- First Name
- Last Name
- Email
- Phone
- Company Name
- Booking Type
- Preferred Date
- Preferred Time
- Message / Notes
- SMS Consent
- Email Consent
- Booking Policy Agreement

Optional project-related fields:

- Project Name
- Project ID
- Project Address
- Related Phase
- Related Task
- Related Milestone
- Related Punch Item
- Preferred Staff Member
- Vendor/Subcontractor Company
- Site Access Notes
- Parking / Gate Code
- File Upload
- Photos

Optional event fields:

- Number of Attendees
- Guest Names
- Meal Preference if needed
- T-Shirt Size if needed
- Registration Notes
- RSVP Status
- Waitlist Consent

---

# Dashboard Views

The booking system should support multiple dashboard views.

## 1. Overview View

The overview page should show:

- Today’s appointments
- Upcoming appointments
- Pending appointments
- Confirmed appointments
- Completed appointments
- Canceled appointments
- No-show appointments
- Upcoming events
- Pending event registrations
- Appointments requiring follow-up
- Booking conflicts
- Staff availability summary

Quick actions:

- Create Appointment
- Create Event
- Block Time
- Manage Availability
- Create Booking Type
- View Calendar

## 2. List View

A searchable/filterable list of appointments and events.

Columns:

- Title
- Type
- Person / Company
- Role Type
- Project
- Date
- Start Time
- End Time
- Status
- Assigned Staff
- Location
- Created Date
- Actions

Filters:

- Status
- Booking Type
- Event Type
- Staff Member
- Client
- Vendor
- Subcontractor
- Project
- Date Range
- Location Type

## 3. Calendar View

A day/week/month calendar view.

Calendar items should show:

- Appointment title
- Time
- Customer/client/vendor/sub name
- Project name if connected
- Assigned staff
- Status
- Type color

Calendar actions:

- Click appointment to view details.
- Create appointment from an open time slot.
- Drag/reschedule appointment if feasible.
- Filter by staff, status, type, and project.
- Show blocked time.
- Show one-time events.

## 4. Kanban View

A board view for appointment workflow.

Suggested columns:

```text
New Request
Pending Confirmation
Confirmed
In Progress
Completed
Follow-Up Needed
Canceled / No Show
```

Kanban card fields:

- Appointment title
- Person / company
- Booking type
- Project name
- Date/time
- Status
- Assigned staff
- Contact buttons
- Notes indicator

## 5. Gantt View

A Gantt-style view for project-connected appointments and events.

Use cases:

- Site visits on the project timeline
- Inspections tied to phases
- Vendor delivery windows
- Subcontractor scheduled work
- Client walkthroughs
- Punch list reviews
- Final closeout appointments
- Event planning timelines

Gantt appointment items should connect to:

- Project ID
- Project name
- Phase
- Task
- Milestone
- Punch item
- Assigned user
- Start date/time
- End date/time
- Status

If the current project management Gantt supports dragging, appointments in the Gantt view should eventually support horizontal dragging/rescheduling with time tooltips.

---

# Appointment Detail Drawer / Page

Each appointment should have a detail drawer or page.

Suggested sections:

- Appointment Details
- Contact Information
- Project Connection
- Assigned Staff
- Location / Meeting Info
- Notes
- Files / Photos
- Notification History
- Reschedule History
- Activity Log

## Appointment Fields

- id
- title
- booking_type_id
- appointment_type
- project_id
- project_name
- phase_id
- task_id
- milestone_id
- punch_item_id
- customer_id
- client_id
- vendor_id
- subcontractor_id
- assigned_staff_id
- created_by_user_id
- first_name
- last_name
- email
- phone
- company_name
- start_time
- end_time
- timezone
- status
- location_type
- location_name
- location_address
- meeting_url
- customer_notes
- internal_notes
- sms_consent
- email_consent
- cancellation_reason
- reschedule_reason
- completed_at
- canceled_at
- created_at
- updated_at

## Appointment Actions

- Confirm
- Reschedule
- Cancel
- Mark Completed
- Mark No Show
- Mark Follow-Up Needed
- Send Reminder
- Add Note
- Link to Project
- Link to Task
- Link to Punch Item
- Assign Staff
- Message Customer/Client/Vendor/Subcontractor

---

# Event Management

The system should support one-time events.

## Event Examples

- Client appreciation event
- Open house
- Ribbon cutting
- Project milestone event
- Vendor demo
- Staff training
- Internal meeting
- Community event
- Special walkthrough
- Project handoff meeting

## Event Fields

- id
- event_title
- event_slug
- event_description
- event_type
- project_id
- project_name
- host_user_id
- location_type
- location_name
- location_address
- meeting_url
- start_time
- end_time
- timezone
- capacity
- registration_status
- is_public
- requires_approval
- waitlist_enabled
- notification_enabled
- created_at
- updated_at

## Event Registration Fields

- id
- event_id
- user_id
- customer_id
- client_id
- vendor_id
- subcontractor_id
- first_name
- last_name
- email
- phone
- company_name
- attendee_count
- registration_status
- guest_names
- notes
- sms_consent
- email_consent
- created_at
- updated_at

## Event Registration Statuses

- Registered
- Pending Approval
- Waitlisted
- Canceled
- Attended
- No Show

## Event Actions

- Create Event
- Edit Event
- Publish / Unpublish Event
- View Registrations
- Add Attendee
- Remove Attendee
- Approve Registration
- Move to Waitlist
- Send Event Reminder
- Export Attendee List

---

# Availability Management

Admins and staff should be able to customize availability.

## Availability Settings

- Working days
- Working hours
- Staff-specific availability
- Booking-type-specific availability
- Project-specific booking windows
- Event-specific registration windows
- Lunch breaks
- Blocked dates
- Holidays
- Vacation
- Travel time
- Buffer before appointment
- Buffer after appointment
- Minimum notice period
- Maximum booking window
- Appointment duration
- Capacity per slot

## Blocked Time

Blocked time should prevent new bookings.

Examples:

- Personal unavailable time
- Internal meetings
- Travel time
- Inspection blocks
- Install windows
- Holiday closures
- Project work blocks

Blocked time fields:

- id
- user_id
- title
- start_time
- end_time
- timezone
- reason
- blocks_public_booking
- project_id optional
- created_at
- updated_at

---

# Calendar Sync

The system should be built to support calendar sync.

Potential providers:

- Google Calendar
- Microsoft Outlook / Office 365
- Apple Calendar via ICS subscription
- CalDAV in a future phase
- Manual ICS export in a future phase

## Calendar Sync Goals

The system should support:

- Connecting one primary calendar.
- Adding multiple additional calendars later.
- Reading busy/free availability.
- Writing confirmed bookings to selected calendars.
- Preventing double bookings.
- Choosing which calendars block availability.
- Choosing which calendar receives new appointments.
- Saving external event IDs.
- Updating external events when appointments are rescheduled or canceled.

## Phase 1 Calendar Approach

If full external calendar integration is not ready, Phase 1 should still support:

- Internal appointment calendar.
- Manual availability rules.
- Manual blocked time.
- Future-ready calendar connection data model.
- Safe service layer where Google/Microsoft sync can be added later.

---

# Notifications

The system should notify the correct people at the correct time.

## Notification Recipients

- Admin
- Assigned staff
- Client
- Customer
- Vendor
- Subcontractor
- Event attendees

## Notification Channels

- Email
- SMS
- In-app dashboard alert
- Future Slack / Telegram

## Notification Triggers

- New appointment created
- Appointment confirmed
- Appointment rescheduled
- Appointment canceled
- Appointment reminder
- Appointment completed
- No-show marked
- Follow-up needed
- Staff assigned
- Client appointment booked
- Vendor appointment booked
- Subcontractor appointment booked
- Event created
- Event registration submitted
- Event registration approved
- Event reminder
- Event canceled
- Project appointment updated

## Reminder Timing

Recommended default reminders:

- Immediately after booking
- 24 hours before
- 2 hours before
- 30 minutes before

## SMS Compliance

SMS messages should respect consent.

SMS should include:

- Business name
- Appointment/event date and time
- Booking type
- Location or meeting link
- Help/opt-out language where appropriate

Example SMS:

```text
Constructed Matter: Your {{booking_type}} is confirmed for {{date}} at {{time}}. Reply HELP for help or STOP to opt out.
```

---

# Suggested Statuses

## Appointment Statuses

- Pending
- Confirmed
- Rescheduled
- In Progress
- Completed
- Canceled
- No Show
- Follow-Up Needed
- Waiting on Client
- Waiting on Vendor
- Waiting on Subcontractor

## Event Statuses

- Draft
- Published
- Registration Open
- Registration Closed
- Full
- Waitlist Open
- Completed
- Canceled

## Booking Type Statuses

- Active
- Inactive
- Internal Only
- Public
- Project Only

---

# Role-Based Access

The booking system should respect user roles.

## Super Admin / Admin

Can:

- View all appointments and events.
- Create/edit/delete appointments.
- Create/edit/delete events.
- Manage booking types.
- Manage availability.
- Manage blocked time.
- View all registrations.
- Send notifications.
- Connect bookings to projects.

## Staff

Can:

- View assigned appointments.
- Create appointments if allowed.
- Update assigned appointment status.
- Add notes.
- View related project appointments.
- Manage own availability if allowed.

## Project Manager

Can:

- View project-related appointments.
- Create appointments for assigned projects.
- Connect appointments to project tasks/milestones/punch items.
- Manage project walkthroughs and client meetings.

## Client

Can:

- View their project-related appointments.
- Book approved client-facing appointment types.
- Register for approved events.
- Cancel/reschedule if allowed.

## Vendor

Can:

- View vendor-related bookings.
- Confirm delivery or meeting times.
- Register for vendor-facing events if allowed.

## Subcontractor

Can:

- View assigned project appointments.
- Confirm site access windows.
- Register for subcontractor-facing meetings or events if allowed.

## Public User

Can:

- Book approved public appointment types.
- Register for public events.
- Cannot view private appointments or internal data.

---

# Suggested Data Model

Codex should adapt this to the current architecture and database conventions.

## booking_types

Purpose:

Defines bookable appointment types.

Fields:

- id
- name
- slug
- description
- booking_category
- duration_minutes
- buffer_before_minutes
- buffer_after_minutes
- min_notice_minutes
- max_days_in_advance
- location_type
- default_meeting_url
- assigned_staff_id
- is_active
- is_public
- project_required
- requires_approval
- requires_payment
- requires_deposit
- deposit_amount
- color
- display_order
- created_at
- updated_at

## booking_appointments

Purpose:

Stores appointments.

Fields:

- id
- booking_type_id
- project_id
- project_name
- phase_id
- task_id
- milestone_id
- punch_item_id
- customer_id
- client_id
- vendor_id
- subcontractor_id
- assigned_staff_id
- created_by_user_id
- title
- first_name
- last_name
- email
- phone
- company_name
- start_time
- end_time
- timezone
- status
- location_type
- location_name
- location_address
- meeting_url
- customer_notes
- internal_notes
- sms_consent
- email_consent
- external_calendar_provider
- external_calendar_id
- external_event_id
- cancellation_reason
- reschedule_reason
- completed_at
- canceled_at
- created_at
- updated_at

## booking_events

Purpose:

Stores one-time events.

Fields:

- id
- event_title
- event_slug
- event_description
- event_type
- project_id
- project_name
- host_user_id
- location_type
- location_name
- location_address
- meeting_url
- start_time
- end_time
- timezone
- capacity
- registration_status
- is_public
- requires_approval
- waitlist_enabled
- notification_enabled
- created_at
- updated_at

## booking_event_registrations

Purpose:

Stores event attendees/registrations.

Fields:

- id
- event_id
- user_id
- customer_id
- client_id
- vendor_id
- subcontractor_id
- first_name
- last_name
- email
- phone
- company_name
- attendee_count
- registration_status
- guest_names
- notes
- sms_consent
- email_consent
- created_at
- updated_at

## booking_availability_rules

Purpose:

Stores working hours and availability rules.

Fields:

- id
- user_id
- booking_type_id
- day_of_week
- start_time
- end_time
- timezone
- is_available
- created_at
- updated_at

## booking_blocked_times

Purpose:

Stores unavailable time.

Fields:

- id
- user_id
- project_id
- title
- start_time
- end_time
- timezone
- reason
- blocks_public_booking
- created_at
- updated_at

## booking_calendar_connections

Purpose:

Stores connected calendar settings.

Important:

Do not expose tokens to the frontend. Use the existing secure storage pattern.

Fields:

- id
- user_id
- provider
- provider_account_email
- calendar_id
- calendar_name
- sync_direction
- blocks_availability
- write_events
- is_primary
- is_active
- last_synced_at
- created_at
- updated_at

## booking_notifications

Purpose:

Tracks booking/event notifications.

Fields:

- id
- appointment_id
- event_id
- registration_id
- recipient_type
- recipient_email
- recipient_phone
- channel
- notification_type
- status
- provider_message_id
- error_message
- scheduled_for
- sent_at
- created_at

## booking_question_fields

Purpose:

Defines custom booking/event form questions.

Fields:

- id
- booking_type_id
- event_id
- label
- field_key
- field_type
- placeholder
- help_text
- is_required
- options
- display_order
- created_at
- updated_at

## booking_question_answers

Purpose:

Stores answers from booking/event forms.

Fields:

- id
- appointment_id
- registration_id
- field_id
- field_key
- answer
- created_at
- updated_at

---

# API Routes / Server Actions

Follow the existing app conventions.

## Public Booking Routes

- GET /api/booking/types
- GET /api/booking/availability
- POST /api/booking/appointments
- GET /api/events/:slug
- POST /api/events/:slug/register

## Admin Booking Routes

- GET /api/admin/bookings
- GET /api/admin/bookings/:id
- POST /api/admin/bookings
- PATCH /api/admin/bookings/:id
- DELETE /api/admin/bookings/:id
- POST /api/admin/bookings/:id/reschedule
- POST /api/admin/bookings/:id/cancel
- POST /api/admin/bookings/:id/complete
- POST /api/admin/bookings/:id/no-show
- POST /api/admin/bookings/:id/send-reminder

## Booking Types

- GET /api/admin/booking-types
- POST /api/admin/booking-types
- PATCH /api/admin/booking-types/:id
- DELETE /api/admin/booking-types/:id

## Event Routes

- GET /api/admin/events
- GET /api/admin/events/:id
- POST /api/admin/events
- PATCH /api/admin/events/:id
- DELETE /api/admin/events/:id
- GET /api/admin/events/:id/registrations
- POST /api/admin/events/:id/send-reminder

## Availability Routes

- GET /api/admin/booking/availability
- POST /api/admin/booking/availability
- PATCH /api/admin/booking/availability/:id
- DELETE /api/admin/booking/availability/:id

## Blocked Time Routes

- GET /api/admin/booking/blocked-times
- POST /api/admin/booking/blocked-times
- PATCH /api/admin/booking/blocked-times/:id
- DELETE /api/admin/booking/blocked-times/:id

---

# Suggested UI Components

Use existing dashboard and ShadCN-style components where available.

Suggested components:

- BookingsPage
- BookingOverviewCards
- BookingListView
- BookingCalendarView
- BookingKanbanView
- BookingGanttView
- AppointmentDrawer
- AppointmentForm
- AppointmentStatusBadge
- BookingTypeBadge
- BookingTypeForm
- PublicBookingPage
- PublicBookingDatePicker
- PublicBookingTimeSlots
- PublicBookingForm
- BookingConfirmation
- EventsPage
- EventForm
- EventRegistrationList
- EventPublicPage
- AvailabilitySettings
- WeeklyAvailabilityEditor
- BlockedTimeForm
- CalendarConnectionsSettings
- NotificationSettings
- BookingFilters
- BookingEmptyState
- BookingLoadingState
- BookingErrorState

---

# Existing App Integrations

## Users

Bookings should connect to the user management system.

Users may be:

- Hosts
- Assigned staff
- Clients
- Vendors
- Subcontractors
- Event attendees

## Projects

Bookings should connect to projects.

Each project-related appointment should include:

- project_id
- project_name
- related phase/task/milestone/punch item when applicable

## Gantt Timeline

Project appointments should be able to appear in the Gantt timeline when relevant.

Examples:

- Site visit
- Inspection
- Vendor delivery
- Subcontractor access window
- Client walkthrough
- Final closeout meeting

## Tasks / Punch List

Appointments may connect to:

- Task
- Milestone
- Punch item
- Client approval
- Subcontractor work item

## Notifications

Booking notifications should use existing email/SMS/in-app notification patterns where available.

## Client Dashboard

Clients should eventually see their own appointments and project events.

## Vendor/Subcontractor Dashboard

Vendors and subcontractors should eventually see their assigned bookings and event invitations.

---

# Phase 1 Scope

Phase 1 should build the foundation.

Include:

- Dashboard navigation entry labeled Bookings.
- Backend Bookings page.
- Appointment list view.
- Basic calendar view if feasible.
- Create/edit appointment form.
- Appointment detail drawer.
- Appointment statuses.
- Booking types table/model.
- Appointment table/model.
- Availability rules table/model.
- Blocked time table/model.
- Event table/model.
- Event registration table/model.
- Basic public booking page.
- Basic public event registration page if feasible.
- Project connection fields.
- User/staff assignment fields.
- Email/SMS consent fields.
- Notification hooks using existing providers if available.
- Loading, empty, success, and error states.

Do not include unless already simple:

- Full external calendar OAuth.
- Two-way calendar sync.
- Advanced drag/drop calendar.
- Full payment collection.
- Advanced automation.
- Full customer dashboard booking history.
- Full vendor/subcontractor portal views.
- Complex reporting.

---

# Phase 2 Ideas

- Google Calendar integration.
- Microsoft Calendar integration.
- Multiple calendar connections.
- Staff-specific booking pages.
- Project-specific booking pages.
- Reschedule/cancel links.
- Reminder scheduling.
- Event waitlists.
- Event capacity management.
- Custom form fields.
- Kanban drag/drop.
- Gantt integration.
- Appointment-to-task conversion.
- Appointment-to-project update conversion.
- Client dashboard appointment history.
- Vendor/subcontractor booking views.
- Payment/deposit collection.
- Analytics and reports.

---

# Codex Instructions

When implementing:

1. Review this file first.
2. Inspect the current codebase before editing.
3. Reuse the existing user, project, task, punch list, notification, and dashboard patterns where possible.
4. Add database migrations instead of editing schema directly.
5. Protect private appointment and project data.
6. Do not expose calendar tokens or secrets.
7. Respect role-based access.
8. Validate all public booking fields.
9. Prevent public users from listing private appointments.
10. Add loading, empty, success, and error states.
11. Keep Phase 1 practical and shippable.
12. Run available checks after implementation.

---

# Codex Starter Prompt

Use this prompt after adding this file to the repo:

```text
I added a new planning document for Constructed Matter, Inc.:

- docs/bookings-events-appointment-management.md

Please review this document before making any code changes.

The goal is to add a Bookings, Events, and Appointment Management system to the existing CMI dashboard. This should integrate with users, staff, clients, vendors, subcontractors, appointments, one-time events, frontend booking pages, project records, Gantt timeline, tasks, punch lists, and notifications.

Before editing, inspect the existing repo structure, dashboard architecture, auth model, user roles, project models, task/punch models, database migrations, API routes/server actions, notification patterns, dashboard UI, and frontend routing.

Do not create a disconnected booking app. Extend the existing CMI app and reuse current architecture, database patterns, auth checks, components, and styling wherever possible.

Start by producing a short implementation plan listing:

- files to change
- existing models/tables that can be reused
- new migrations needed
- API routes or server actions needed
- dashboard UI components needed
- frontend booking pages needed
- event registration pages needed
- availability approach
- notification approach
- calendar sync approach
- project connection approach
- risks or incompatibilities
- assumptions about the current repo structure

After the plan, implement Phase 1 only.

Phase 1 should include:

- dashboard navigation entry labeled Bookings
- backend Bookings page
- appointment list view
- basic calendar view if feasible
- create/edit appointment form
- appointment detail drawer
- appointment statuses
- booking types table/model
- appointment table/model
- availability rules table/model
- blocked time table/model
- event table/model
- event registration table/model
- basic public booking page
- basic public event registration page if feasible
- project connection fields
- user/staff assignment fields
- email/SMS consent fields
- notification hooks using existing providers if available
- loading, empty, success, and error states

Do not implement full external calendar OAuth, advanced drag/drop calendar, full payment collection, complex reporting, full vendor/subcontractor portals, or full customer dashboard booking history in Phase 1 unless the existing repo already makes this simple.

When complete, summarize:

- what was added
- files changed
- migrations created
- routes/actions added
- how to test booking creation
- how to test event registration
- how to test project-connected appointments
- how notifications are prepared or sent
- what should be handled in Phase 2
```

---

# Success Criteria

This feature is successful when:

- Admin/staff can access a Bookings dashboard page.
- Appointments can be listed, created, edited, canceled, and completed.
- Appointment records can connect to users and projects.
- Events can be created and registrations can be tracked.
- Public users can submit approved booking/event forms.
- Role-based access protects private appointment data.
- Notifications are prepared or sent through the existing system where available.
- The system supports future calendar sync.
- The system supports future client, vendor, and subcontractor dashboard views.
