# Project Manager — Gantt Timeline Source of Truth

## File Purpose

This document is the source-of-truth planning file for the Project Manager / Gantt Timeline feature. Codex should review this file before modifying the project management, scheduling, task, punch list, notification, template, or dashboard code.

Recommended location:

`/docs/project-manager-gantt-timeline.md`

This feature is intended to support both construction-style project management workflows and adaptable production-style workflows. It should be built in a flexible way so a project can contain phases, tasks, punch list items, approvals, dependencies, schedule updates, comments, files, and notifications.

---

# Core Objective

Build or extend a Gantt-based project management system where each project has a clear visual timeline. A project should be the parent record, and all related phases, tasks, punch list items, dependencies, files, updates, and notifications should be associated with that project.

The system should support:

- Project-level schedule management
- Project phases
- Project tasks
- Punch list items
- Milestones
- Dependencies
- Drag-and-drop schedule adjustment
- Minute-level timeline flexibility
- Tooltips showing time/date changes while dragging
- Notifications for team members, vendors, subcontractors, customers, and admins
- Internal and customer-visible items
- Construction workflow templates
- Repeatable Gantt workflow templates
- Kanban, list/table, calendar, and Gantt views where applicable
- Project activity history and schedule change logs

---

# Required Parent / Child Relationship

Every task, phase, milestone, punch list item, dependency, schedule update, file, comment, and notification must be associated with a project.

The project name should always be visible or easily accessible when viewing related records.

## Required Relationship Rules

- A project can have many phases.
- A project can have many tasks.
- A project can have many milestones.
- A project can have many punch list items.
- A project can have many room/area records.
- A project can have many dependencies between tasks.
- A project can have many schedule updates.
- A project can have many notifications.
- A project can have many files/photos.
- A task must belong to a project.
- A punch list item must belong to a project.
- A punch list item may optionally belong to a phase, task, room, or area.
- A dependency must belong to a project and connect two project schedule items.

## Important UX Requirement

Anywhere a task or punch list item appears, show the associated project name.

Examples:

- Task table rows should include `Project Name`.
- Punch list table rows should include `Project Name`.
- Kanban cards should show the project name.
- Notifications should include the project name.
- Task detail drawers should include the project name.
- Punch list drawers should include the project name.
- Schedule change logs should include the project name.

---

# Dashboard Placement

Add the feature as a first-class dashboard module.

Suggested sidebar label:

`Project Manager`

Alternative labels:

- Project Management
- Gantt Timeline
- Production Schedule
- Project Schedule

Preferred label:

`Project Manager`

Suggested navigation structure:

```text
Dashboard
Analytics
Orders / Jobs
Project Manager
Production / Operations
Bookings
Payments
Messages
Customers / Clients
Users
Settings
```

## Project Manager Sections / Tabs

Suggested sections:

```text
Overview
Gantt Timeline
Tasks
Milestones
Punch List
Kanban
Calendar
Schedule Updates
Templates
Reports
Settings
```

---

# Main Views

## 1. Project Manager Overview

The overview page should provide a high-level command center for projects.

Should include:

- Active projects
- Project status
- Project manager
- Client/customer
- Start date
- Target completion date
- Days remaining
- Schedule health
- Open tasks
- Overdue tasks
- Blocked tasks
- Open punch items
- Upcoming milestones
- Recent schedule updates
- Recent project activity
- Quick action buttons

Suggested quick actions:

- Add Project
- Add Task
- Add Milestone
- Add Punch Item
- Apply Template
- View Gantt Timeline
- Export Schedule

---

## 2. Gantt Timeline View

The Gantt timeline is the main scheduling interface.

Should include:

- Project grouping
- Phase grouping
- Task bars
- Milestone markers
- Punch list markers or linked task rows
- Dependency lines
- Status colors
- Priority indicators
- Assigned users/vendors/subcontractors
- Client/customer visibility icons
- Blocked indicators
- Approval/payment gates where applicable
- Zoom controls
- Drag-and-drop date/time adjustment
- Click-to-open details drawer

## Required Gantt Timeline Behavior

The timeline should visually represent project phases, tasks, milestones, dependencies, punch items, and schedule changes.

Required behavior:

- Show projects as parent groups.
- Show phases as grouped timeline sections under projects.
- Show individual tasks as timeline bars.
- Show milestones as fixed date markers.
- Show punch list items either as their own rows or linked to related tasks/rooms.
- Show dependencies between tasks.
- Show overdue tasks clearly.
- Show blocked tasks clearly.
- Show approval gates clearly.
- Show payment/deposit gates where applicable.
- Allow filtering by project, phase, assignee, status, priority, customer-visible, blocked, and overdue.
- Allow staff to update task status.
- Allow project managers/admins to adjust dates.
- Keep a history of schedule changes.
- Respect customer visibility settings.
- Support a simplified customer-facing timeline view in a future phase.

## Minute-Level Drag Behavior

The timeline should support flexible drag adjustments by the minute.

Dragging behavior:

- Users can click and drag a task, phase, milestone, or schedule item left or right on the timeline.
- The item’s start and/or end time should update based on the drag movement.
- The system should support minute-level changes when the timeline zoom level supports it.
- While dragging, show a tooltip with the new date/time.
- If the item duration is preserved, dragging left/right should move both start and end time together.
- If resizing is supported, dragging the left handle adjusts the start time and dragging the right handle adjusts the end time.
- Tooltip should show:
  - New start date/time
  - New end date/time
  - Duration
  - Difference from original schedule, such as `+45 minutes`, `-2 hours`, `+1 day`
- When the user releases the item, save the updated date/time.
- Log the schedule change.
- Trigger notifications if configured.

Example tooltip:

```text
Start: Mar 18, 2026 9:15 AM
End: Mar 18, 2026 11:45 AM
Duration: 2h 30m
Shift: +45 minutes
```

## Timeline Zoom Levels

Recommended zoom levels:

- Hour
- Day
- Week
- Month
- Quarter

Minute-level drag should be most precise in Hour and Day views.

## Drag Restrictions

The system should respect permissions:

- Super Admin can drag/resize any schedule item.
- Project Manager can drag/resize items in assigned projects.
- Staff may drag/resize assigned tasks only if permission allows.
- Subcontractor/vendor can update status only unless permission allows.
- Client/customer cannot drag internal schedule items.

## Dependency-Aware Dragging

If dependencies exist:

- Warn users when moving an item impacts dependent tasks.
- Optionally ask whether to auto-shift dependent tasks.
- Log dependency impact.
- Do not silently break dependency rules.

Future preferred behavior:

- Auto-shift dependent items when enabled.
- Highlight impacted tasks before saving.
- Show dependency conflict warnings.

---

## 3. Task List View

A table/list view of project tasks.

Required fields:

- Task name
- Project name
- Project ID
- Phase
- Assigned user
- Assigned company/vendor/subcontractor
- Start date/time
- End date/time
- Due date/time
- Estimated duration
- Priority
- Status
- Percent complete
- Dependency/blocker
- Is blocked
- Blocker reason
- Customer/client visibility
- Last updated

Actions:

- Add task
- Edit task
- Delete task
- Duplicate task
- Mark complete
- Mark blocked
- Assign user
- Link dependency
- Add note
- Add file/photo

---

## 4. Punch List View

Punch list items should be project-associated and optionally linked to phases, rooms/areas, tasks, and customer approvals.

Required fields:

- Punch item title
- Project name
- Project ID
- Related phase
- Related task
- Room/area
- Assigned user/vendor/subcontractor
- Priority
- Due date/time
- Status
- Before photos
- After photos
- File attachments
- Customer/client visible toggle
- Customer approval required
- Customer approval status
- Project manager approval status
- Internal notes
- Created by
- Completed by
- Completed at
- Created at
- Updated at

Recommended statuses:

- Open
- In Progress
- Waiting on Customer
- Waiting on Vendor
- Needs Review
- Completed
- Approved
- Reopened
- Canceled

Punch list actions:

- Add punch item
- Edit punch item
- Delete punch item
- Assign owner
- Add before photo
- Add after photo
- Mark completed
- Request approval
- Approve item
- Reopen item
- Add internal note
- Add customer note

---

## 5. Kanban View

Kanban should provide a workflow view of tasks and punch list items.

Suggested columns:

```text
Not Started
Ready
In Progress
Waiting on Customer
Waiting on Vendor
Needs Review
Blocked
Completed
Approved
```

Kanban cards should show:

- Project name
- Task/punch title
- Phase
- Assignee
- Due date/time
- Status
- Priority
- Blocked indicator
- Customer-visible indicator

Drag behavior:

- Dragging a card between columns updates the status.
- Moving to Blocked should prompt for blocker reason.
- Moving to Completed may trigger review/approval workflow.

---

## 6. Calendar View

Calendar should show schedule items by date/time.

Views:

- Day
- Week
- Month

Calendar should show:

- Project tasks
- Milestones
- Installations
- Appointments
- Punch deadlines
- Delivery/shipping dates
- Customer walkthroughs

Actions:

- Click item to open detail drawer.
- Drag item to reschedule if allowed.
- Create task from a date/time slot.
- Filter by project, assignee, status, and type.

---

## 7. Schedule Updates View

Used to track timeline changes, delay reasons, customer/team notifications, and audit history.

Fields:

- Project name
- Related type
- Related item ID
- Previous start date/time
- Previous end date/time
- Updated start date/time
- Updated end date/time
- Previous status
- Updated status
- Reason for change
- Schedule impact
- Notify customer/client
- Notify team
- Updated by
- Created at

Schedule updates should be created when:

- A Gantt item is dragged or resized.
- A task date changes.
- A task is blocked.
- A dependency causes a schedule shift.
- A milestone date changes.
- A punch item due date changes.
- A project completion date changes.

---

# User Roles and Permissions

The feature should respect user roles and permissions.

## Super Admin

Can:

- View all projects
- Create/edit/delete projects
- Create/edit/delete phases
- Create/edit/delete tasks
- Create/edit/delete milestones
- Create/edit/delete punch items
- Manage dependencies
- Drag/resize all Gantt items
- Manage templates
- Manage notifications
- Export reports
- Control customer visibility

## Project Manager

Can:

- Manage assigned projects
- Create/edit phases
- Create/edit tasks
- Create/edit milestones
- Create/edit punch items
- Assign staff/vendors/subcontractors
- Drag/resize schedule items in assigned projects
- Approve completed punch items
- Control customer visibility for assigned projects
- Send schedule updates

## Staff

Can:

- View assigned projects/tasks
- Update assigned task status
- Add notes/files/photos
- Add punch items if permitted
- Update punch item status if assigned
- Drag/resize assigned tasks only if permitted

## Vendor / Subcontractor

Can:

- View assigned tasks only
- View project access instructions
- Update task status if allowed
- Upload completion photos
- Add notes to assigned tasks
- Confirm availability/completion

## Customer / Client

Can:

- View customer-visible project schedule items
- View customer-visible milestones
- View approved schedule updates
- View punch list items requiring approval
- Submit comments
- Approve/reopen punch list items if enabled
- Cannot access internal notes, cost-sensitive tasks, private blockers, or internal staff comments

---

# Core Data Models

Codex should adapt these models to the existing app architecture, database, ORM, Supabase, API routes, and dashboard component structure.

## projects

Represents the parent project.

Suggested fields:

- id
- project_name
- project_slug
- client_id
- customer_id
- project_manager_id
- project_address
- project_type
- project_description
- start_datetime
- target_completion_datetime
- actual_completion_datetime
- project_status
- schedule_health
- project_visibility
- created_by
- created_at
- updated_at

## project_phases

Represents a major section of a project timeline.

Suggested fields:

- id
- project_id
- phase_name
- phase_description
- start_datetime
- end_datetime
- phase_status
- assigned_manager_id
- display_order
- customer_visible
- internal_notes
- created_at
- updated_at

## project_schedule_items

Represents any item shown on the Gantt timeline.

This can support tasks, milestones, approvals, payment gates, installation items, delivery items, and punch-linked items.

Suggested fields:

- id
- project_id
- phase_id
- item_name
- item_description
- item_type
- assigned_to_user_id
- assigned_to_company_id
- start_datetime
- end_datetime
- due_datetime
- estimated_duration_minutes
- actual_duration_minutes
- percent_complete
- item_status
- item_priority
- dependency_task_id
- is_blocked
- blocker_reason
- customer_visible
- internal_only
- requires_approval
- approval_status
- requires_payment
- payment_status
- attachments
- internal_notes
- customer_notes
- created_by
- created_at
- updated_at

Suggested item_type values:

- phase
- task
- milestone
- approval
- payment
- deposit
- customer_action
- production_step
- shipping
- delivery
- installation
- inspection
- punch_item
- quality_control
- closeout

## project_tasks

If the app separates tasks from schedule items, use this table or map tasks to project_schedule_items.

Required relationship:

- Every task must have `project_id`.

Suggested fields:

- id
- project_id
- phase_id
- schedule_item_id
- task_name
- task_description
- assigned_to_user_id
- assigned_to_company_id
- start_datetime
- end_datetime
- due_datetime
- estimated_duration_minutes
- percent_complete
- task_status
- task_priority
- is_blocked
- blocker_reason
- customer_visible
- internal_notes
- created_by
- created_at
- updated_at

## project_milestones

Represents key project checkpoints.

Suggested fields:

- id
- project_id
- phase_id
- milestone_name
- target_datetime
- actual_completion_datetime
- milestone_status
- customer_visible
- notes
- created_at
- updated_at

## project_dependencies

Represents relationships between schedule items.

Suggested fields:

- id
- project_id
- parent_schedule_item_id
- dependent_schedule_item_id
- dependency_type
- required_completion_datetime
- delay_impact_notes
- auto_shift_schedule
- created_at
- updated_at

Dependency types:

- Finish to Start
- Start to Start
- Finish to Finish
- Start to Finish

## project_punch_items

Represents punch list items tied to a project.

Required relationship:

- Every punch item must have `project_id`.

Suggested fields:

- id
- project_id
- phase_id
- schedule_item_id
- related_task_id
- room_area_id
- punch_title
- punch_description
- assigned_to_user_id
- assigned_to_company_id
- priority
- due_datetime
- status
- photo_uploads
- file_attachments
- before_photo
- after_photo
- customer_visible
- customer_approval_required
- customer_approval_status
- project_manager_approval_status
- internal_notes
- customer_notes
- created_by
- completed_by
- completed_at
- created_at
- updated_at

## project_room_areas

Used to group punch list items by location.

Suggested fields:

- id
- project_id
- room_area_name
- area_status
- assigned_reviewer_id
- notes
- completion_datetime
- created_at
- updated_at

Example areas:

- Kitchen
- Primary Bathroom
- Living Room
- Bedroom
- Garage
- Exterior
- Entry
- Office
- Mechanical Room
- Landscape Area
- Installation Site
- Vehicle
- Production Area

## project_schedule_updates

Tracks schedule changes and communication.

Suggested fields:

- id
- project_id
- related_type
- related_id
- previous_start_datetime
- previous_end_datetime
- updated_start_datetime
- updated_end_datetime
- previous_status
- updated_status
- reason_for_change
- schedule_impact
- notify_customer
- notify_team
- created_by
- created_at

## project_notifications

Tracks notifications related to projects, tasks, punch items, approvals, and schedule changes.

Suggested fields:

- id
- project_id
- related_type
- related_id
- recipient_user_id
- recipient_email
- recipient_phone
- recipient_type
- channel
- notification_type
- subject
- message
- status
- provider_message_id
- error_message
- scheduled_for
- sent_at
- created_at

Channels:

- in_app
- email
- sms
- slack
- telegram

---

# Forms Required

## Project Form

Fields:

- Project Name
- Client / Customer
- Project Address
- Project Manager
- Project Type
- Project Description
- Start Date/Time
- Target Completion Date/Time
- Project Template
- Internal Notes
- Customer Visibility Toggle

## Phase Form

Fields:

- Project
- Phase Name
- Phase Description
- Start Date/Time
- End Date/Time
- Phase Status
- Assigned Manager
- Display Order
- Customer Visible / Internal Only
- Phase Notes

## Task Form

Fields:

- Project
- Phase
- Task Name
- Task Description
- Start Date/Time
- End Date/Time
- Due Date/Time
- Assigned To
- Priority
- Status
- Dependency / Blocking Task
- Estimated Duration Minutes
- Percent Complete
- Attachments
- Internal Notes
- Customer Visibility Toggle

## Milestone Form

Fields:

- Project
- Phase
- Milestone Name
- Target Date/Time
- Actual Completion Date/Time
- Status
- Notes
- Customer Visible Toggle

## Punch Item Form

Fields:

- Project
- Related Phase
- Related Task
- Related Room / Area
- Punch Item Title
- Description
- Assigned To
- Priority
- Due Date/Time
- Status
- Photo Upload
- File Attachment
- Customer Visible Toggle
- Customer Approval Required
- Internal Notes

## Schedule Update Form

Fields:

- Project
- Related Task / Phase / Milestone / Punch Item
- Current Status
- Previous Start Date/Time
- Previous End Date/Time
- Updated Start Date/Time
- Updated End Date/Time
- Percent Complete
- Reason for Change
- Schedule Impact
- Notify Customer Toggle
- Notify Team Toggle

## Dependency Form

Fields:

- Project
- Parent Schedule Item
- Dependent Schedule Item
- Dependency Type
- Required Completion Date/Time
- Delay Impact Notes
- Auto-Shift Schedule Toggle

---

# Notifications

The system should support notifications for project activity, schedule changes, assignments, approvals, punch list updates, and customer-visible updates.

## Notification Triggers

Potential triggers:

- New project created
- New task assigned
- Task due soon
- Task overdue
- Task completed
- Task blocked
- Task reopened
- Schedule item dragged/rescheduled
- Dependency conflict created
- Milestone reached
- Schedule changed
- Punch item added
- Punch item assigned
- Punch item completed
- Punch item approved
- Punch item reopened
- Customer approval requested
- Customer approved punch item
- Customer commented
- File uploaded
- Project status changed
- Customer-visible update posted

## Notification Recipients

- Project manager
- Assigned staff
- Assigned vendor/subcontractor
- Customer/client
- Super Admin
- Billing/admin if payment gate is involved

## Notification Channels

- In-app notification
- Email
- SMS
- Slack in future phase
- Telegram in future phase

## Example Notification Messages

Task assignment:

```text
You were assigned a new task for {{project_name}}: {{task_name}}. Due: {{due_datetime}}.
```

Schedule changed:

```text
Schedule updated for {{project_name}}: {{item_name}} moved from {{old_start}}–{{old_end}} to {{new_start}}–{{new_end}}.
```

Punch approval requested:

```text
Approval requested for punch item in {{project_name}}: {{punch_title}}.
```

Customer schedule update:

```text
Project update for {{project_name}}: {{update_summary}}.
```

## SMS Compliance Note

If SMS is used, only send SMS to users/customers who have provided SMS consent. Include STOP/HELP language where appropriate.

---

# Construction Template Basics

The system should include starter construction templates for repeatable project schedules.

Templates should be selectable when creating a project. Once selected, the system should automatically create phases, tasks, milestones, dependencies, and punch list placeholders.

## Template Categories

- Kitchen Remodel
- Bathroom Remodel
- Bedroom Remodel
- Garage Remodel
- Casita / ADU
- Home Addition / Extension
- New Home Construction
- Landscape / Backyard Project
- Commercial Tenant Improvement
- Exterior Renovation

## Common Construction Phases

- Sales / Proposal
- Contract / Deposit
- Design / Planning
- Selections / Specifications
- Permitting
- Procurement
- Site Preparation
- Demolition
- Foundation / Structural
- Framing
- Mechanical / Electrical / Plumbing
- Inspections
- Drywall / Paint
- Interior Finishes
- Cabinetry / Fixtures
- Flooring
- Exterior Work
- Landscaping
- Final Walkthrough
- Punch List
- Closeout
- Warranty

---

# Template 1 — Kitchen Remodel Basics

Timeline items:

1. Project Created
2. Contract Signed
3. Deposit Paid
4. Site Measurement
5. Design / Layout Review
6. Selections Confirmed
7. Permits Submitted if required
8. Materials Ordered
9. Demolition
10. Rough Plumbing / Electrical
11. Framing / Structural Adjustments
12. Inspection
13. Drywall / Paint
14. Cabinet Installation
15. Countertop Template
16. Countertop Installation
17. Backsplash Installation
18. Appliance Installation
19. Flooring / Finish Work
20. Final Inspection
21. Customer Walkthrough
22. Punch List Created
23. Punch Items Completed
24. Customer Approval
25. Final Payment
26. Project Closeout

---

# Template 2 — Bathroom Remodel Basics

Timeline items:

1. Project Created
2. Contract Signed
3. Deposit Paid
4. Site Measurement
5. Design / Layout Review
6. Selections Confirmed
7. Materials Ordered
8. Demolition
9. Rough Plumbing / Electrical
10. Waterproofing
11. Inspection
12. Tile Installation
13. Vanity / Cabinet Installation
14. Fixture Installation
15. Glass / Shower Door Installation
16. Paint / Finish Work
17. Final Inspection
18. Customer Walkthrough
19. Punch List Created
20. Punch Items Completed
21. Customer Approval
22. Final Payment
23. Project Closeout

---

# Template 3 — Garage / Casita / ADU Basics

Timeline items:

1. Project Created
2. Contract Signed
3. Deposit Paid
4. Site Review
5. Design / Plans
6. Engineering if required
7. Permit Submitted
8. Permit Approved
9. Site Prep
10. Foundation / Slab
11. Framing
12. Roofing / Exterior Shell
13. Rough Electrical / Plumbing / HVAC
14. Inspection
15. Insulation
16. Drywall
17. Paint
18. Interior Finishes
19. Exterior Finishes
20. Final Inspection
21. Customer Walkthrough
22. Punch List Created
23. Punch Items Completed
24. Customer Approval
25. Final Payment
26. Project Closeout

---

# Template 4 — New Home Construction Basics

Timeline items:

1. Project Created
2. Contract Signed
3. Deposit Paid
4. Plans Finalized
5. Engineering Finalized
6. Permit Submitted
7. Permit Approved
8. Site Preparation
9. Excavation
10. Foundation
11. Framing
12. Roofing
13. Windows / Exterior Openings
14. Rough Plumbing
15. Rough Electrical
16. Rough HVAC
17. Inspection
18. Insulation
19. Drywall
20. Paint
21. Cabinets
22. Countertops
23. Flooring
24. Fixtures
25. Appliances
26. Exterior Finish
27. Landscape / Hardscape
28. Final Inspection
29. Customer Walkthrough
30. Punch List Created
31. Punch Items Completed
32. Customer Approval
33. Final Payment
34. Project Closeout

---

# Template 5 — Landscape / Backyard Basics

Timeline items:

1. Project Created
2. Contract Signed
3. Deposit Paid
4. Site Measurement
5. Design / Layout Review
6. Material Selections
7. Permits / HOA Approval if required
8. Site Prep
9. Demo / Clearing
10. Grading
11. Irrigation / Utilities
12. Hardscape
13. Structures / Shade / Patio
14. Turf / Planting
15. Lighting
16. Cleanup
17. Customer Walkthrough
18. Punch List Created
19. Punch Items Completed
20. Customer Approval
21. Final Payment
22. Project Closeout

---

# Workflow Template Data Model

If templates are database-backed, use a structure like this.

## project_workflow_templates

Fields:

- id
- template_name
- template_slug
- template_category
- description
- project_type
- is_active
- is_system_template
- created_by
- created_at
- updated_at

## project_workflow_template_items

Fields:

- id
- workflow_template_id
- item_key
- item_name
- item_description
- item_type
- phase_name
- default_duration_minutes
- default_start_offset_minutes
- default_owner_role
- default_status
- default_priority
- customer_visible
- internal_only
- blocks_production
- requires_approval
- requires_payment
- requires_deposit
- dependency_key
- dependency_type
- display_order
- created_at
- updated_at

## project_workflow_template_applications

Optional table to track template usage.

Fields:

- id
- workflow_template_id
- project_id
- applied_by
- applied_at
- created_schedule_item_count
- notes

---

# Applying Templates

When a template is applied:

1. Create phases from template phases.
2. Create schedule items from template items.
3. Attach every item to the selected project.
4. Convert default offsets/durations into real start/end date-times.
5. Preserve display order.
6. Preserve customer visibility settings.
7. Preserve approval/payment/deposit gates.
8. Create dependency records after schedule items are created.
9. Allow all generated schedule items to be edited manually after creation.
10. Do not modify the original template when generated items are edited.

## Dependency Key Mapping

Template dependencies should use temporary keys before real schedule IDs exist.

Example:

- `customer_approval` depends on `proof_created`
- `production_start` depends on `customer_approval`
- `ready_for_pickup` depends on `quality_control`

When applying the template:

1. Create all schedule items.
2. Map `item_key` to generated schedule item ID.
3. Create dependency records using the generated IDs.

---

# Customer / Client Visibility Rules

Not everything should be customer-visible.

Customer-visible items may include:

- Major phases
- Key milestones
- Approved schedule updates
- Final walkthrough dates
- Client/customer decision deadlines
- Punch items requiring approval
- Payment/deposit gates
- Installation appointments
- Delivery or pickup dates

Internal-only items may include:

- Internal staff notes
- Vendor/subcontractor comments
- Cost-sensitive items
- Scheduling conflicts
- Private delays
- Internal blockers
- Management notes
- Internal quality control notes

Every phase, task, milestone, punch item, and schedule update should include a visibility setting.

---

# Reports and Exports

Future reporting options:

- Project schedule report
- Open task report
- Overdue task report
- Punch list report
- Customer-visible timeline export
- Subcontractor/vendor task report
- Project closeout report
- Schedule delay report
- Schedule change log
- Project activity report
- Gantt PDF export
- CSV export

---

# Suggested Implementation Phases

## Phase 1 — Foundation

Build or verify the foundation.

Tasks:

- Ensure project model exists.
- Ensure tasks and punch list items are associated with project ID.
- Add/verify phases, tasks, milestones, dependencies, punch items, schedule updates.
- Add Project Manager navigation.
- Build/verify basic project overview.
- Build/verify task list page.
- Build/verify punch list page.
- Add customer visibility toggles.
- Add project name to all task/punch views.

## Phase 2 — Gantt Timeline

Build/extend the Gantt interface.

Tasks:

- Display project groups.
- Display phases, tasks, milestones, punch items.
- Add filters and zoom controls.
- Add status colors.
- Add task/punch detail drawer.
- Add dependency display.
- Add drag left/right rescheduling.
- Add minute-level tooltip during drag.
- Log schedule updates.

## Phase 3 — Punch List and Closeout

Tasks:

- Add punch item model/forms if missing.
- Add room/area grouping.
- Add photo/file uploads.
- Add completion workflow.
- Add customer approval workflow.
- Connect punch items to project closeout status.

## Phase 4 — Notifications and Customer Visibility

Tasks:

- Add notification triggers.
- Add customer-visible timeline view.
- Add customer approval requests.
- Add internal vs customer-visible schedule updates.
- Add activity log.
- Add email/SMS notification support if providers exist.

## Phase 5 — Templates and Advanced Scheduling

Tasks:

- Add construction workflow templates.
- Add template application system.
- Add auto-shift dependent tasks.
- Add schedule impact logging.
- Add critical path indicators.
- Add exports.
- Add reporting dashboard.
- Add calendar sync in future phase.

---

# Codex Instructions

When implementing this feature:

1. Review this document first.
2. Inspect the existing codebase before editing.
3. Do not rebuild existing working project management code.
4. Extend current models, routes, components, and dashboard patterns.
5. Ensure project name/project ID is associated with all tasks and punch list items.
6. Ensure task and punch list views display the related project name.
7. Add migrations instead of editing production schema directly.
8. Reuse existing auth, roles, dashboard layout, ShadCN components, tables, dialogs, drawers, buttons, forms, and styling.
9. Do not expose internal-only data to customers/clients.
10. Respect customer visibility settings.
11. Add loading, empty, success, and error states.
12. Add validation for date/time changes.
13. Log schedule changes when Gantt items are dragged or resized.
14. Run available checks after implementation.

---

# Success Criteria

This feature is successful when:

- Every task is associated with a project.
- Every punch list item is associated with a project.
- Project name displays in task and punch list views.
- Project managers can add/edit tasks, milestones, and punch items.
- Gantt timeline displays projects, phases, tasks, milestones, and punch items.
- Users can drag items right/left to adjust schedule timing.
- Dragging shows a tooltip with minute-level time changes.
- Schedule changes are saved and logged.
- Dependencies are supported or prepared.
- Notifications are triggered or prepared.
- Customer visibility is respected.
- Construction templates provide starter workflows.
- The system can grow into a full Buildertrend-style project management platform.
