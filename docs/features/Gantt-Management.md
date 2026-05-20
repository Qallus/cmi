# Constructed Matter CRM — Gantt Project Management Feature

## File Purpose

This document defines the **Gantt Chart Project Management** feature for the Constructed Matter, Inc. Staff Dashboard.

Use this as the source-of-truth planning document for Codex when building the project management, scheduling, task tracking, punch list, and client-visible timeline functionality inside the CMI CRM.

Recommended file name:

`Gantt-Management.md`

Recommended location:

`/docs/Gantt-Management.md`

Alternative location:

`/docs/features/Gantt-Management.md`

---

## Feature Overview

The Gantt Chart Project Management feature gives Constructed Matter a clear, visual way to manage project schedules from start to finish inside the CRM.

Each project should be broken down into phases, milestones, tasks, deadlines, dependencies, punch items, assignments, and project updates. The goal is to give internal staff, subcontractors, vendors, and clients the appropriate level of visibility into what is happening, when it is happening, and who is responsible.

This feature should work inside the CMI Staff Dashboard and eventually connect to the Client Dashboard where selected project milestones, schedule updates, and visible tasks can be shared with clients.

The experience should feel similar to a modern construction management platform like Buildertrend, but customized for Constructed Matter’s own CRM, workflows, branding, and dashboard structure.

---

## Primary Goals

The Gantt Project Management feature should help CMI:

- Manage full project timelines from proposal to closeout.
- Create project phases and tasks with start dates, due dates, owners, and dependencies.
- Track progress visually using a Gantt-style timeline.
- Assign work to staff, subcontractors, and vendors.
- Identify delays, blockers, and schedule conflicts.
- Connect punch list items to project closeout.
- Give clients a clean, simplified schedule view.
- Improve internal communication and accountability.
- Reduce missed deadlines and unclear project ownership.
- Create a scalable foundation for future construction management SaaS features.

---

## Staff Dashboard Placement

Add this feature to the **CMI Staff Dashboard** as a major dashboard module.

Suggested navigation label:

`Project Management`

Suggested sub-navigation:

- Project Timeline
- Gantt Chart
- Tasks
- Milestones
- Punch List
- Schedule Updates
- Subcontractor Assignments
- Client Visibility
- Reports

---

## Recommended Dashboard Pages

### 1. Project Management Overview

A high-level project management landing page for staff.

Should include:

- Active projects
- Project status
- Project manager
- Start date
- Target completion date
- Days remaining
- Schedule health
- Open tasks
- Overdue tasks
- Open punch items
- Upcoming milestones

Suggested UI components:

- Project cards
- Project status badges
- Schedule health indicators
- Quick action buttons
- Search and filters
- Table/list toggle

---

### 2. Project Gantt Chart Page

The main visual scheduling page.

Should include:

- Project phases
- Tasks
- Milestones
- Dependencies
- Date ranges
- Drag-and-drop date adjustments if supported
- Status colors
- Assigned users
- Critical path indicators if possible
- Zoom controls: week, month, quarter
- Internal/client visibility indicators

Suggested controls:

- Filter by project
- Filter by phase
- Filter by assignee
- Filter by status
- Filter by client-visible items
- Export schedule
- Add phase
- Add task
- Add milestone

---

### 3. Task List Page

A list/table view of all tasks connected to project schedules.

Should include:

- Task name
- Project
- Phase
- Assigned user
- Start date
- Due date
- Priority
- Status
- Percent complete
- Dependency/blocker
- Client visibility
- Last updated

---

### 4. Milestones Page

A timeline or table view of key project checkpoints.

Should include:

- Milestone name
- Project
- Related phase
- Target date
- Actual completion date
- Status
- Notes
- Client-visible toggle

---

### 5. Punch List Page

A closeout-focused task list for punch items, repairs, incomplete work, client walkthroughs, and final approvals.

Should include:

- Punch item title
- Project
- Room/area
- Assigned user/vendor
- Priority
- Due date
- Status
- Photo uploads
- Before/after images
- Client approval status
- Internal notes

---

### 6. Schedule Updates Page

Used to log timeline changes, delay reasons, and client/team notifications.

Should include:

- Project
- Related task/phase/milestone
- Previous date
- Updated date
- Reason for schedule change
- Impact notes
- Notify team toggle
- Notify client toggle
- Updated by
- Updated date/time

---

## User Roles and Permissions

The feature should respect CMI user roles.

### Super Admin

Can:

- View all projects
- Create/edit/delete phases
- Create/edit/delete tasks
- Manage milestones
- Manage punch list
- Assign users
- Change visibility settings
- View all internal and client-visible items
- Export reports
- Manage templates

### Staff

Can:

- View assigned projects
- Create/edit tasks depending on permissions
- Update task status
- Add schedule updates
- Manage punch items
- Upload files/photos
- Add internal notes

### Project Manager

Can:

- Manage full schedule for assigned projects
- Assign staff, subcontractors, and vendors
- Create phases, tasks, and milestones
- Approve completed punch items
- Control client visibility
- Send schedule updates

### Subcontractor

Can:

- View assigned tasks only
- View project access instructions
- Update task status if allowed
- Upload completion photos
- Add notes to assigned tasks
- Confirm availability or completion

### Vendor

Can:

- View assigned procurement or delivery tasks
- Confirm delivery dates
- Upload documents
- Add status updates

### Client

Can:

- View client-visible milestones
- View approved schedule updates
- View selected tasks if enabled
- View punch list items requiring approval
- Submit comments or approval if enabled

---

## Core Data Models

Codex should adapt these models to the existing app architecture, database, ORM, API routes, and dashboard component structure.

### Project

Represents a CMI construction project.

Suggested fields:

- id
- project_name
- client_id
- project_manager_id
- project_address
- project_type
- start_date
- target_completion_date
- actual_completion_date
- project_status
- schedule_health
- project_visibility
- created_at
- updated_at

---

### Project Phase

Represents a major section of the project timeline.

Suggested fields:

- id
- project_id
- phase_name
- phase_description
- start_date
- end_date
- phase_status
- assigned_manager_id
- display_order
- client_visible
- internal_notes
- created_at
- updated_at

Example phase names:

- Pre-Construction
- Design / Planning
- Permitting
- Procurement
- Site Preparation
- Framing
- Mechanical / Electrical / Plumbing
- Interior Finishes
- Inspections
- Final Walkthrough
- Closeout

---

### Project Task

Represents a scheduled task inside a project phase.

Suggested fields:

- id
- project_id
- phase_id
- task_name
- task_description
- assigned_to_user_id
- assigned_to_company_id
- start_date
- due_date
- estimated_duration
- percent_complete
- task_status
- task_priority
- dependency_task_id
- is_blocked
- blocker_reason
- client_visible
- attachments
- internal_notes
- created_by
- created_at
- updated_at

Recommended statuses:

- Not Started
- In Progress
- Waiting on Materials
- Waiting on Subcontractor
- Needs Review
- Completed
- Approved
- Reopened
- Blocked

Recommended priorities:

- Low
- Normal
- High
- Critical
- Blocking Closeout

---

### Project Milestone

Represents a key project checkpoint.

Suggested fields:

- id
- project_id
- phase_id
- milestone_name
- target_date
- actual_completion_date
- milestone_status
- client_visible
- notes
- created_at
- updated_at

Example milestones:

- Contract Signed
- Permit Submitted
- Permit Approved
- Materials Ordered
- Construction Start
- Inspection Passed
- Final Walkthrough
- Project Complete

---

### Task Dependency

Represents a relationship between two tasks.

Suggested fields:

- id
- project_id
- parent_task_id
- dependent_task_id
- dependency_type
- required_completion_date
- delay_impact_notes
- auto_shift_schedule
- created_at
- updated_at

Example dependency types:

- Finish to Start
- Start to Start
- Finish to Finish
- Start to Finish

---

### Schedule Update

Tracks timeline changes and project schedule communication.

Suggested fields:

- id
- project_id
- related_type
- related_id
- previous_start_date
- previous_due_date
- updated_start_date
- updated_due_date
- status_update
- reason_for_change
- schedule_impact
- notify_client
- notify_team
- created_by
- created_at

---

### Punch Item

Represents an individual punch list item.

Suggested fields:

- id
- project_id
- phase_id
- room_area_id
- punch_title
- punch_description
- assigned_to_user_id
- assigned_to_company_id
- priority
- due_date
- status
- photo_uploads
- file_attachments
- before_photo
- after_photo
- client_visible
- client_approval_required
- client_approval_status
- project_manager_approval_status
- internal_notes
- created_by
- completed_by
- completed_at
- created_at
- updated_at

---

### Room / Area

Used to group punch items by location.

Suggested fields:

- id
- project_id
- room_area_name
- area_status
- assigned_reviewer_id
- notes
- completion_date
- created_at
- updated_at

Example areas:

- Kitchen
- Primary Bathroom
- Living Room
- Exterior
- Garage
- Entry
- Office
- Mechanical Room
- Landscape Area

---

## Forms Required

### 1. Project Schedule Setup Form

Purpose:

Used to create the initial project timeline.

Fields:

- Project Name
- Client Name
- Project Address
- Project Manager
- Start Date
- Target Completion Date
- Project Type
- Project Phase Template
- Internal Notes
- Client Visibility Toggle

---

### 2. Project Phase Form

Purpose:

Used to create major timeline sections inside the Gantt chart.

Fields:

- Phase Name
- Phase Description
- Phase Start Date
- Phase End Date
- Phase Status
- Assigned Manager
- Display Order
- Client Visible / Internal Only
- Phase Notes

---

### 3. Task Creation Form

Purpose:

Used to add individual tasks to the project timeline.

Fields:

- Task Name
- Task Description
- Related Project
- Related Phase
- Start Date
- Due Date
- Assigned To
- Task Priority
- Task Status
- Dependency / Blocking Task
- Estimated Duration
- Percent Complete
- Attachments
- Internal Notes
- Client Visibility Toggle

---

### 4. Milestone Form

Purpose:

Used to define important project checkpoints.

Fields:

- Milestone Name
- Target Date
- Actual Completion Date
- Related Project
- Related Phase
- Milestone Status
- Notes
- Client Visible Toggle

---

### 5. Task Dependency Form

Purpose:

Used to connect tasks that rely on each other.

Fields:

- Parent Task
- Dependent Task
- Dependency Type
- Required Completion Date
- Delay Impact Notes
- Auto-Shift Schedule Toggle

---

### 6. Schedule Update Form

Purpose:

Used by project managers to update dates, statuses, progress, delays, and schedule impact.

Fields:

- Related Project
- Related Task / Phase / Milestone
- Current Status
- Previous Start Date
- Previous Due Date
- Updated Start Date
- Updated Due Date
- Percent Complete
- Reason for Change
- Schedule Impact
- Notify Client Toggle
- Notify Team Toggle

---

### 7. Subcontractor Task Assignment Form

Purpose:

Used to assign work to subcontractors or vendors.

Fields:

- Project
- Task / Scope of Work
- Subcontractor / Vendor
- Contact Person
- Start Date
- Due Date
- Required Documents
- Access Instructions
- Notes
- Confirmation Status

---

### 8. Client Schedule View Settings Form

Purpose:

Used to control what the client can see.

Fields:

- Project
- Visible Phases
- Visible Milestones
- Hidden Internal Tasks
- Show Completion Percent
- Show Delays
- Show Notes
- Client Notification Preferences

---

## Punch / Task List Forms

### 1. Punch Item Form

Purpose:

Used to create individual punch list items.

Fields:

- Punch Item Title
- Description
- Related Project
- Related Room / Area
- Related Phase
- Assigned To
- Priority
- Due Date
- Status
- Photo Upload
- File Attachment
- Client Visible Toggle
- Internal Notes

---

### 2. Room / Area Punch List Form

Purpose:

Used to organize punch items by location.

Fields:

- Project
- Room / Area Name
- Area Status
- Assigned Reviewer
- Notes
- Completion Date

---

### 3. Punch Review Form

Purpose:

Used during walkthroughs, inspections, or internal reviews.

Fields:

- Project
- Reviewer Name
- Review Date
- Area Reviewed
- New Punch Items
- Photos
- Notes
- Client Comments
- Signature / Approval

---

### 4. Punch Completion Form

Purpose:

Used to mark punch items as completed.

Fields:

- Punch Item
- Completed By
- Completion Date
- Completion Notes
- Before Photo
- After Photo
- Client Approval Required
- Project Manager Approval
- Final Status

---

### 5. Client Approval Form

Purpose:

Used when the client needs to approve completed work.

Fields:

- Project
- Punch Item
- Client Approval Status
- Client Notes
- Approval Date
- Signature
- Reopen Item Toggle

---

## Task Categories

Recommended categories:

- Design
- Permitting
- Selections
- Procurement
- Construction
- Subcontractor Work
- Inspection
- Change Order
- Client Decision
- Pay Application
- Closeout
- Warranty
- Punch List

---

## Gantt Chart Behavior

The Gantt chart should visually represent the relationship between phases, tasks, milestones, and schedule changes.

Required behavior:

- Show project phases as grouped timeline sections.
- Show individual tasks as timeline bars.
- Show milestones as fixed date markers.
- Show dependencies between tasks.
- Show overdue tasks clearly.
- Show blocked tasks clearly.
- Allow filtering by project, phase, assignee, task status, and priority.
- Allow staff to update task status.
- Allow project managers to adjust dates.
- Keep a history of schedule changes.
- Respect client visibility settings.
- Support a simplified client-facing timeline view.

Preferred behavior:

- Drag-and-drop task rescheduling.
- Auto-shift dependent tasks when a blocking task moves.
- Critical path highlighting.
- Color-coded statuses.
- Progress percentage on task bars.
- Expand/collapse phases.
- Export to PDF or CSV.
- Calendar sync in a future phase.

---

## Client Visibility Rules

Not everything in the Gantt chart should be visible to clients.

Client-visible items may include:

- Major phases
- Key milestones
- Approved schedule updates
- Final walkthrough dates
- Client decision deadlines
- Punch items requiring client approval

Internal-only items may include:

- Staff notes
- Subcontractor/vendor comments
- Internal task assignments
- Cost-sensitive work
- Scheduling conflicts
- Private delays
- Internal blockers
- Management notes

Every phase, task, milestone, punch item, and schedule update should include a client visibility setting.

---

## Notifications

This feature should eventually support notifications.

Potential notification triggers:

- New task assigned
- Task due soon
- Task overdue
- Task completed
- Task blocked
- Milestone reached
- Schedule changed
- Punch item added
- Punch item completed
- Client approval requested
- Client approved punch item
- Client reopened punch item

Possible notification channels:

- In-app notification
- Email
- SMS in a future phase
- Dashboard alert

---

## Reports and Exports

Future reporting options:

- Project schedule report
- Open task report
- Overdue task report
- Punch list report
- Client-visible timeline export
- Subcontractor task report
- Project closeout report
- Schedule delay report

---

## Suggested Implementation Phases

### Phase 1 — Data and Basic UI

Build the foundation.

Tasks:

- Create data models for phases, tasks, milestones, schedule updates, and punch items.
- Add Project Management navigation to the Staff Dashboard.
- Build basic task list page.
- Build basic phase and milestone forms.
- Build project-level schedule overview.
- Add client visibility toggles.

---

### Phase 2 — Gantt Timeline View

Build the visual scheduling interface.

Tasks:

- Add Gantt chart component.
- Display phases, tasks, and milestones.
- Add filters and date controls.
- Add status colors.
- Add task details drawer/modal.
- Add basic dependency display.

---

### Phase 3 — Punch List and Closeout

Build punch list management.

Tasks:

- Add punch item model and forms.
- Add room/area grouping.
- Add photo/file uploads.
- Add completion workflow.
- Add client approval workflow.
- Connect punch items to project closeout status.

---

### Phase 4 — Notifications and Client Visibility

Improve communication.

Tasks:

- Add notification triggers.
- Add client-visible timeline view.
- Add client approval requests.
- Add internal vs client-visible schedule updates.
- Add activity log.

---

### Phase 5 — Advanced Construction Management

Add deeper scheduling and reporting.

Tasks:

- Add drag-and-drop rescheduling.
- Add auto-shift dependent tasks.
- Add schedule impact logging.
- Add critical path indicators.
- Add PDF/CSV exports.
- Add reporting dashboard.
- Add future calendar sync.

---

## Suggested UI Style

Follow the existing CMI dashboard design system.

Preferred style direction:

- Clean modern dashboard layout
- ShadCN-style cards, tables, drawers, badges, tabs, and dialogs
- Light/dark mode support if the app already supports it
- Clear visual hierarchy
- Soft borders
- Rounded cards
- Simple status badges
- Minimal but useful color coding
- Mobile-friendly where practical, but optimize for desktop staff use first

---

## Suggested Components

Potential components:

- ProjectManagementOverview
- ProjectGanttChart
- ProjectTimeline
- ProjectPhaseList
- ProjectPhaseForm
- ProjectTaskList
- ProjectTaskForm
- ProjectTaskDrawer
- ProjectMilestoneList
- ProjectMilestoneForm
- TaskDependencyForm
- ScheduleUpdateForm
- SubcontractorAssignmentForm
- PunchList
- PunchItemForm
- PunchItemDrawer
- RoomAreaList
- ClientScheduleVisibilitySettings
- ScheduleHealthBadge
- TaskStatusBadge
- TaskPriorityBadge

---

## Codex Instructions

When implementing this feature:

1. Review the current CMI Staff Dashboard structure before creating new files.
2. Follow the existing app architecture, routing, naming conventions, styling system, and database patterns.
3. Do not duplicate existing project, task, user, client, vendor, or subcontractor models if they already exist.
4. Extend existing models when appropriate.
5. Build this feature in phases.
6. Start with the Staff Dashboard internal experience before the Client Dashboard.
7. Keep client visibility settings in place from the beginning.
8. Make the UI clean, practical, and construction-project focused.
9. Use reusable components.
10. Add mock data only if the database/API is not ready yet.
11. Clearly document any assumptions before making structural changes.
12. If a Gantt chart library is needed, recommend one before installing it.
13. Prioritize working functionality over visual polish in the first pass.
14. Keep the feature scalable for future SaaS-style project management features.

---

## Starter Prompt for Codex

Use the following prompt when starting this feature:

```text
Review the CMI Staff Dashboard codebase and the documentation file located at /docs/Gantt-Management.md.

I want to add a Project Management module to the Staff Dashboard that includes a Gantt-style project timeline, project phases, milestones, task management, punch list management, schedule updates, subcontractor/vendor assignments, and client visibility controls.

Before writing code, review the existing dashboard structure, routes, components, models, database schema, user roles, and styling system. Then provide a phased implementation plan based on the Gantt-Management.md document.

Start with Phase 1: data structure review, navigation placement, basic Project Management overview page, task list page, phase form, milestone form, and client visibility toggles.

Do not duplicate existing models. Extend the existing architecture where appropriate. Use the existing design system and dashboard UI patterns.
```

---

## Success Criteria

This feature is successful when:

- CMI staff can create a project schedule.
- Project managers can add phases, tasks, and milestones.
- Staff can view and update assigned tasks.
- Punch list items can be created and tracked.
- Schedule changes can be logged.
- Client visibility can be controlled per item.
- The Gantt chart clearly shows project timing, progress, blockers, and milestones.
- The system supports future client-facing project schedule views.
