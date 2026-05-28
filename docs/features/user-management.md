# Constructed Matter, Inc. — User Management

## File Purpose

This document is the source-of-truth planning file for adding a complete User Management system to the Constructed Matter, Inc. web app / CRM.

Recommended location:

`/docs/user-management.md`

The goal is to allow Super Admins and authorized staff to manage users inside the CMI dashboard, including adding users, inviting users, editing users, disabling/removing users, assigning roles, and controlling what each user can access.

---

# Feature Overview

The User Management feature should provide a clean backend dashboard experience for managing all user types connected to Constructed Matter, Inc.

This includes:

- Internal staff
- Project managers
- Designers
- Estimators
- Superintendents
- Subcontractors
- Vendors
- Clients
- View-only users

The system should connect naturally to the CMI project management system, Gantt timeline, construction project templates, task assignments, punch lists, schedule updates, client visibility settings, and notifications.

---

# Primary Goals

The User Management feature should allow CMI to:

- View all users in one dashboard area.
- Add new users manually.
- Invite users by email.
- Edit user details.
- Assign roles.
- Change user status.
- Disable/reactivate users.
- Remove users safely when appropriate.
- Connect users to projects.
- Assign users to project tasks.
- Assign users to punch list items.
- Track invite status.
- Protect sensitive dashboard areas with role-based access.
- Preserve historical project, task, punch list, and note records when a user is disabled.

---

# Recommended Dashboard Placement

Add this feature as a first-class dashboard module.

Suggested sidebar label:

`Users`

Alternative labels:

- Team
- Staff & Users
- User Management

Preferred label:

`Users`

Suggested dashboard navigation area:

```text
Dashboard
Projects
Project Management
Gantt Timeline
Tasks
Punch List
Clients
Users
Reports
Settings
```

---

# Core User Fields

Each user profile should include:

- id
- auth_user_id
- first_name
- last_name
- display_name
- email
- phone
- role
- status
- company_id
- company_name
- job_title
- avatar_url
- notes
- last_login_at
- invited_at
- invite_accepted_at
- disabled_at
- created_at
- updated_at

Required fields:

- First Name
- Last Name
- Email
- Role

Optional fields:

- Phone
- Company / Organization
- Job Title
- Avatar / Profile Photo
- Notes

---

# User Statuses

Recommended statuses:

- Active
- Invited
- Pending
- Disabled
- Removed
- Suspended

## Status Behavior

### Active

User can log in and access areas allowed by their role.

### Invited

User has been invited but has not accepted the invitation yet.

### Pending

User record exists but setup is incomplete.

### Disabled

User cannot log in or access the dashboard, but historical project/task/punch records remain intact.

### Removed

User has been removed from active management, but historical records should remain preserved.

### Suspended

User is temporarily blocked from access.

---

# Recommended User Roles

## Super Admin

Full access to all dashboard areas, users, projects, settings, templates, schedules, tasks, punch lists, clients, reports, and system configuration.

Can:

- View all users
- Add users
- Invite users
- Edit users
- Disable/reactivate users
- Manage roles
- View all projects
- Manage project templates
- Manage Gantt timeline
- Manage punch lists
- Manage settings
- View reports

## Admin

Can manage most operational areas, including users, projects, tasks, schedules, clients, vendors, and reports, but may not access system-level settings unless allowed.

Can:

- View users
- Invite users
- Edit most users
- Manage projects
- Manage tasks
- Manage punch lists
- View reports

Cannot:

- Remove the last Super Admin
- Promote themselves beyond their allowed role
- Access restricted system settings unless permitted

## Project Manager

Can manage assigned projects, schedules, Gantt timelines, project tasks, punch lists, client-visible updates, subcontractor assignments, and project documents.

Can:

- View assigned projects
- Manage project schedule
- Add/edit tasks
- Assign staff/subcontractors/vendors
- Manage punch items
- Approve completed punch items
- Control client visibility on assigned projects
- Send schedule updates

## Staff

Can view assigned work, update tasks, add notes, upload files/photos, and update task/punch status based on permissions.

Can:

- View assigned projects/tasks
- Update task status
- Add notes
- Upload files/photos
- Update punch items assigned to them

## Designer

Can access design-related tasks, project files, selections, plans, renderings, and design approvals.

Can:

- View assigned design tasks
- Upload design files
- Add design notes
- Update design task status
- Participate in client selections/approvals if allowed

## Estimator

Can access leads, estimates, proposals, project scopes, client details, and pre-construction information.

Can:

- View leads/proposals if present
- View project scope
- Create/update estimates if supported
- Add notes to pre-construction records

## Superintendent

Can manage field schedules, subcontractors, inspections, site notes, photos, punch items, and field updates.

Can:

- View field schedule
- Update field tasks
- Manage subcontractor assignments
- Add site notes/photos
- Track inspections
- Manage punch items

## Subcontractor

Can view only assigned projects/tasks, update assigned task status, upload completion photos, add notes, and see relevant access instructions.

Can:

- View assigned tasks only
- View project access instructions
- Upload completion photos
- Add notes to assigned tasks
- Confirm availability or completion

Cannot:

- View unrelated projects
- View private client/internal notes
- Manage users
- Manage project financials

## Vendor

Can view assigned procurement/delivery items, upload documents, confirm delivery dates, and update vendor-related statuses.

Can:

- View assigned vendor tasks
- Confirm delivery dates
- Upload documents
- Add status updates

## Client

Can view client-visible project information, approved milestones, selected schedule items, punch items requiring approval, and project documents made visible to them.

Can:

- View client-visible project timeline
- View approved milestones
- View selected schedule updates
- View punch items requiring approval
- Add comments if enabled
- Approve/reopen punch items if enabled

Cannot:

- View internal notes
- View subcontractor/vendor comments
- View management notes
- Manage staff users

## Viewer

Read-only access to permitted dashboard/project areas.

Can:

- View permitted dashboard areas
- View assigned/client-visible information
- Cannot create/edit/delete records

---

# User Management Pages

## 1. Users Overview

A high-level User Management landing page.

Should include overview cards:

- Total Users
- Active Users
- Pending Invites
- Disabled Users
- Staff Users
- Clients
- Subcontractors
- Vendors

Suggested quick actions:

- Add User
- Invite User
- Export Users later
- Filter by Role
- Filter by Status

---

## 2. Users List / Table

Create a searchable, filterable table.

Columns:

- Name
- Email
- Phone
- Role
- Status
- Company / Organization
- Last Login
- Created Date
- Actions

Actions:

- View
- Edit
- Resend Invite
- Disable
- Reactivate
- Remove/Delete if allowed

Filters:

- Search by name/email/phone
- Role
- Status
- Company
- User Type

Recommended table behavior:

- Sort by name
- Sort by created date
- Sort by role
- Sort by status
- Pagination if needed
- Empty state
- Loading state
- Error state

---

## 3. Add User

Allow authorized users to manually add a new user.

Fields:

- First Name
- Last Name
- Email
- Phone
- Role
- Company / Organization
- Job Title
- Notes
- Send Invite Email toggle
- Active / Pending status

Rules:

- Email is required.
- Email must be unique.
- Role is required.
- Phone is optional but should be validated if provided.
- New user should receive an invite if the invite toggle is enabled.
- Do not expose temporary passwords.
- Follow the existing auth provider pattern.

---

## 4. Invite User

Allow Super Admin/Admin to invite users by email.

Invite fields:

- First Name
- Last Name
- Email
- Phone
- Role
- Company / Organization
- Custom invite message
- Related project optional
- Send invite button

Invite behavior:

- Create user profile record if appropriate.
- Create invite record or auth invite using the existing auth system.
- Send invite email.
- Mark user status as Invited or Pending.
- Allow resend invite.
- Allow cancel invite if feasible.
- Track invite sent date and accepted date if feasible.

Invite statuses:

- Pending
- Sent
- Accepted
- Expired
- Canceled

---

## 5. Edit User

Allow authorized users to update:

- First Name
- Last Name
- Email if allowed
- Phone
- Role
- Status
- Company / Organization
- Job Title
- Notes
- Assigned projects if supported
- Permissions if supported

Important rules:

- Do not allow a user to accidentally remove the last Super Admin.
- Do not allow unauthorized users to promote themselves.
- Do not allow staff to edit users above their permission level.
- Confirm before changing critical roles.
- Confirm before disabling/removing users.
- Preserve historical records.

---

## 6. User Detail Drawer / Page

When clicking a user, show a detail drawer or detail page.

Suggested sections:

- Profile Info
- Role & Status
- Contact Details
- Assigned Projects
- Assigned Tasks
- Assigned Punch Items
- Invite Status
- Recent Activity
- Internal Notes

Suggested actions:

- Edit User
- Resend Invite
- Disable User
- Reactivate User
- View Assigned Projects
- View Assigned Tasks
- View Assigned Punch Items

---

## 7. Disable / Reactivate User

Prefer disabling over hard delete.

Supported actions:

- Disable user
- Reactivate user
- Remove from project
- Remove from company/team
- Hard delete only if safe and supported

Rules:

- Disabled users should not be able to log in.
- Disabled users should not appear as active assignees.
- Existing historical records should remain connected to the disabled user.
- Do not delete project history, task history, notes, or punch list ownership when a user is disabled.
- Do not allow disabling the last Super Admin.

---

# Role-Based Access Control

Use the existing auth/permission pattern if available.

If role-based access is not fully implemented, create a clean foundation that supports it.

The system should be designed so roles can control access to:

- Dashboard
- Users
- Projects
- Project Management
- Gantt Timeline
- Tasks
- Punch List
- Clients
- Vendors
- Subcontractors
- Files
- Reports
- Settings
- Templates

Suggested permissions:

- users.view
- users.create
- users.invite
- users.edit
- users.disable
- users.delete
- users.manage_roles
- projects.view
- projects.create
- projects.edit
- projects.delete
- tasks.view
- tasks.create
- tasks.edit
- tasks.assign
- punch.view
- punch.create
- punch.edit
- punch.approve
- settings.view
- settings.edit

Phase 1 does not need a full custom permission matrix unless the current app already supports it. Role-based checks are enough for the first version.

---

# Project Assignment

The User Management feature should support future project assignments.

Project Manager, Staff, Subcontractor, Vendor, and Client users should be connectable to projects.

Examples:

- Assign a Project Manager to a project.
- Assign Staff to project tasks.
- Assign Subcontractors to assigned tasks only.
- Assign Vendors to procurement/delivery tasks.
- Assign Clients to client-visible project views.

If project assignment tables already exist, reuse them. If not, prepare the data model for future project assignments.

---

# Task / Punch List Assignment

Users should connect to existing project tasks and punch list items.

Required relationship rules:

- A task can be assigned to a user.
- A task can be assigned to a company/vendor/subcontractor if supported.
- A punch item can be assigned to a user.
- A punch item can be assigned to a company/vendor/subcontractor if supported.
- Disabled users should remain visible on historical assignments.
- New assignments should not allow disabled users unless intentionally allowed by admin.

---

# Notifications

User Management should support notifications.

Notification triggers:

- User invited
- Invite resent
- Invite accepted
- User role changed
- User disabled
- User reactivated
- User assigned to project
- User assigned to task
- User assigned to punch item
- User removed from project

Notification channels:

- Email
- In-app notification if available
- SMS in a future phase

---

# Suggested Data Model

Codex should adapt these models to the existing database, ORM/API, Supabase patterns, and auth system.

Do not duplicate existing auth users.

Use existing auth user/profile tables if available.

## user_profiles

Suggested fields:

- id
- auth_user_id
- first_name
- last_name
- display_name
- email
- phone
- role
- status
- company_id
- company_name
- job_title
- avatar_url
- notes
- last_login_at
- invited_at
- invite_accepted_at
- disabled_at
- created_at
- updated_at

## user_invites

Suggested fields:

- id
- email
- first_name
- last_name
- phone
- role
- status
- invite_token
- invited_by_user_id
- related_project_id
- custom_message
- expires_at
- accepted_at
- canceled_at
- created_at
- updated_at

## user_project_assignments

Suggested fields:

- id
- user_id
- project_id
- project_role
- assigned_by_user_id
- assigned_at
- removed_at
- created_at
- updated_at

## user_activity_logs

Suggested fields:

- id
- user_id
- actor_user_id
- action
- description
- metadata
- created_at

---

# API Routes / Server Actions

Follow the existing app conventions.

Suggested functionality:

- List users
- Get single user
- Create user
- Invite user
- Resend invite
- Update user
- Disable user
- Reactivate user
- Remove user
- Update role
- Assign user to project
- Remove user from project

Suggested routes if using API routes:

- GET /api/admin/users
- GET /api/admin/users/:id
- POST /api/admin/users
- POST /api/admin/users/invite
- POST /api/admin/users/:id/resend-invite
- PATCH /api/admin/users/:id
- PATCH /api/admin/users/:id/role
- POST /api/admin/users/:id/disable
- POST /api/admin/users/:id/reactivate
- DELETE /api/admin/users/:id
- POST /api/admin/users/:id/projects
- DELETE /api/admin/users/:id/projects/:projectId

---

# Suggested UI Components

Use existing dashboard and ShadCN-style components where available.

Suggested components:

- UsersPage
- UsersOverviewCards
- UsersTable
- UserFilters
- UserSearch
- UserStatusBadge
- UserRoleBadge
- UserDrawer
- UserForm
- InviteUserForm
- UserProjectAssignments
- UserActivityList
- DisableUserConfirmDialog
- RemoveUserConfirmDialog
- ResendInviteButton
- EmptyUsersState
- UsersLoadingState
- UsersErrorState

Potential UI components:

- Card
- Table
- Dialog
- Sheet / Drawer
- Form
- Input
- Select
- Badge
- Button
- Dropdown Menu
- Tabs
- Toast

---

# Phase 1 Scope

Implement a clean working User Management foundation.

Phase 1 should include:

- Dashboard navigation entry labeled Users
- Users list/table
- Search users
- Filter users by role/status
- Add user form
- Invite user form
- Edit user form
- User detail drawer or modal
- Role field
- Status field
- First name
- Last name
- Email
- Phone
- Company / Organization optional
- Job Title optional
- Disable/reactivate user
- Resend invite if invite system is feasible
- Basic role-based access checks
- Supabase migration if needed
- API routes/server actions
- Loading, empty, success, and error states

Phase 1 should not include unless simple:

- Full custom permissions UI
- Complex team hierarchy
- Hard delete
- Advanced audit logs
- SMS invites
- Project assignment UI
- Client dashboard role-specific views
- Subcontractor portal
- Vendor portal
- Bulk import/export

---

# Phase 2 Ideas

Phase 2 can include:

- Project assignment UI
- Task assignment management
- Punch assignment management
- User activity log
- Invite expiration and canceling
- Permission matrix
- Custom roles
- Team/company grouping
- Client portal permissions
- Subcontractor-specific dashboard view
- Vendor-specific dashboard view
- SMS invite option
- User avatar/photo upload
- Bulk user import
- CSV export
- Password reset management
- Login history
- Two-factor authentication support if auth provider supports it

---

# Codex Instructions

When implementing this feature:

1. Review this file first.
2. Inspect the current codebase before editing.
3. Reuse the existing auth system.
4. Do not duplicate auth users.
5. Add database migrations instead of editing schema directly.
6. Do not expose secrets or auth tokens.
7. Protect user management routes from unauthorized access.
8. Do not allow users to escalate their own role.
9. Do not allow deletion/disabling of the last Super Admin.
10. Prefer disable/reactivate over hard delete.
11. Preserve project/task/punch history when users are disabled.
12. Use existing dashboard UI patterns.
13. Add loading, empty, success, and error states.
14. Run available checks after implementation.

---

# Codex Starter Prompt

Use this prompt after adding this file to the repo:

```text
I added a new planning document for Constructed Matter, Inc. user management:

- docs/user-management.md

Please review this document before making any code changes.

The goal is to add a complete User Management system to the existing CMI dashboard. This should include adding users, inviting users, editing users, disabling/reactivating users, assigning roles, and preparing the system for project/task/punch list assignments.

Before editing, inspect the existing repo structure, dashboard architecture, auth model, user/session handling, database schema, Supabase migrations, API routes/server actions, role/permission patterns, dashboard navigation, existing customer/client/vendor/subcontractor models, and current UI component system.

Do not create a disconnected user system. Extend the existing app architecture and reuse current auth, database, dashboard, styling, and API patterns wherever possible.

Start by producing a short implementation plan listing:

- files to change
- existing auth/user/profile tables that can be reused
- new migrations needed
- API routes or server actions needed
- dashboard UI components needed
- role/access-control approach
- invite approach
- risks or incompatibilities
- assumptions about the current repo structure

After the plan, implement Phase 1 only.

Phase 1 should include:

- dashboard navigation entry labeled Users
- users list/table
- search users
- filter users by role/status
- add user form
- invite user form
- edit user form
- user detail drawer or modal
- role field
- status field
- first name
- last name
- email
- phone
- company / organization optional
- job title optional
- disable/reactivate user
- resend invite if invite system is feasible
- basic role-based access checks
- Supabase migration if needed
- API routes/server actions
- loading, empty, success, and error states

Do not implement the full custom permissions UI, complex team hierarchy, hard delete, SMS invites, full project assignment UI, subcontractor portal, vendor portal, or bulk import/export in Phase 1 unless the existing repo already makes this simple.

When complete, summarize:

- what was added
- files changed
- migrations created
- routes/actions added
- how to test adding a user
- how to test inviting a user
- how to test editing a user
- how to test disabling/reactivating a user
- what should be handled in Phase 2
```

---

# Success Criteria

This feature is successful when:

- Authorized users can access a Users dashboard page.
- Users can be listed, searched, and filtered.
- A new user can be added.
- A user can be invited.
- A user can be edited.
- A user role can be changed by an authorized user.
- A user can be disabled/reactivated.
- The last Super Admin cannot be disabled or removed.
- Unauthorized users cannot access user management.
- Historical project/task/punch records are preserved.
- The foundation supports future project/task/punch assignments.
