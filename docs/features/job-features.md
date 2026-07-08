# CMI Jobs Feature — Buildertrend-Inspired Job Management Workflow

## Purpose

This document defines the Jobs feature for the Constructed Matter, Inc. web application. The goal is to add a full job-management experience inspired by Buildertrend while adapting it to the CMI workflow, terminology, design system, database, permissions, and existing sales / project lifecycle process.

The Jobs feature should allow CMI staff to create, view, manage, map, price, organize, and archive construction jobs from one central area of the web app.

This should connect with the CMI sales process documented in:

`docs/features/cmi-sales-process-leads-opportunities.md`

Jobs should not replace Leads or Opportunities. A Job is the project record that exists once the work has enough substance to require a unique job number (defined by a unique number sequence and the job name: Example: 23_001_Conrad Interior), project management, pricing, scheduling, client access, internal users, vendors, documents, financials, and reporting.

---

## Buildertrend Reference Screens Reviewed

The reference screenshots show the following Buildertrend job areas:

1. Job Summary
2. Job Info / Job Details
3. Job Price Summary
4. Jobs List
5. Jobs Map
6. Add New Job From Scratch
7. Add New Job From Template
8. Job Clients tab
9. Job Internal Users tab
10. Job Subs / Vendors tab
11. Job Advanced Settings tab
12. Builder's Risk Insurance tab

These screens show that every job is treated as a central record with many related pages and modules connected to it. All Builder Trend Job features screenshots are available at: docs\screenshots\builder-trend-jobs

---

## Core Job Definition

A Job is a construction project record inside the CMI web app.

Every Job must have:

- Job number
- Job name
- Job type
- Job status
- Job address
- Client / contact association
- Project manager association
- Schedule information
- Financial / pricing information
- Internal user access
- Subcontractor / vendor access
- Related files, documents, messages, tasks, logs, estimates, change orders, invoices, selections, and warranty requests

A Job should be searchable, filterable, reportable, and accessible from multiple areas of the app.

---

## Required Job Fields

### Primary Fields

| Field | Requirement | Description |
|---|---:|---|
| Job ID | Required | Internal database UUID or primary key |
| Job Number | Required | Unique job number associated with the project |
| Job Name | Required | Unique display name, usually client name or project name |
| Job Type | Required | Warranty, Residential, Commercial, ADU, Remodel, New Build, etc. |
| Job Status | Required | Draft, Presale, Open, Active Budget, Pre-Construction, Active Project, Warranty, Closed, On Hold, Cancelled |
| Job Address | Required when known | Full physical project address |
| Street Address | Required when known | Street address |
| City | Required when known | City |
| State | Required when known | State |
| Zip Code | Required when known | Zip code |
| Job Color | Optional | Visual color used for list/map/calendar/schedule |
| Job Group | Optional | Grouping category for reporting or templates |
| Related Lead ID | Optional | Links the job back to the source Lead |
| Related Opportunity ID | Recommended | Links the job back to the Opportunity that created it |
| Client Contact ID(s) | Required before client portal access | Associated client contacts |
| Project Manager ID(s) | Recommended | Internal CMI users managing the project |
| Created By | Required | User who created the job |
| Created At | Required | Timestamp |
| Updated At | Required | Timestamp |

---

## Job Number Rules

The job number is a unique identifier for each job. The screenshots show job number formats like:

- `23_001_Conrad Interior`
- `24_031_Nielsen Residence`
- `24_060_Stanley Residence`
- `25_000_Osborn Drive`

CMI should support a consistent job-number format.

Recommended format:

`YY_###_ProjectName`

Examples:

- `26_001_Smith Residence`
- `26_002_Arcadia ADU`
- `26_003_Osborn Remodel`

### Job Number Behavior

- Job numbers must be unique.
- Job numbers should be created when an Opportunity becomes a real project record.
- Job numbers should not be required for a basic marketing Lead.
- Job numbers may be generated automatically but should allow staff override if they have permission.
- The system should prevent duplicate job numbers.
- Job numbers should remain stable after creation.
- If a job number changes, the change should be recorded in the audit log.

---

## Job Types

The system should allow CMI to manage configurable job types.

Initial job types:

- Residential
- Commercial
- Whole Home Remodel
- Kitchen Remodel
- Bathroom Remodel
- ADU / Casita
- Addition
- New Build
- Tenant Improvement
- Warranty
- Service Work
- Internal / Admin
- Template
- Other

Job types should be editable by authorized admins.

---

## Job Statuses

The system should support both high-level lifecycle statuses and job-operational statuses.

Recommended statuses:

- Draft
- Lead Linked
- Opportunity
- Active Budget
- Pre-Construction / Design
- Active Project
- Warranty
- Closed
- Long Lead
- Not Moving Forward
- On Hold
- Cancelled

Buildertrend-style statuses visible in screenshots include:

- Presale
- Open
- Warranty
- Closed

CMI can map these as follows:

| Buildertrend-Style Status | CMI Status Meaning |
|---|---|
| Presale | Opportunity, Active Budget, or Pre-Construction |
| Open | Active Project |
| Warranty | Warranty |
| Closed | Closed / Archived |

---

## Main Jobs Navigation

The primary top-level navigation should include:

- Sales
- Jobs
- Project Management
- Files
- Messaging & Communication
- Financial ("Coming Soon")
- Reports

The Jobs section should include:

- Jobs Summary / Dashboard
- Jobs List
- Jobs Map
- Add Job
- Job Templates
- Job Detail Pages

---

## Jobs List Page

The Jobs List page should show all jobs in a table format with other views including list, kanban, and calendar views.

### Required Columns

- Select checkbox
- Job color
- Job name
- Job number
- Street address
- City
- State
- Zip code
- Project manager
- Clients
- Client phone
- Job type
- Job status
- Start date
- Completion date
- Last activity

### Required Features

- Search jobs
- Filter jobs
- Sort columns
- Select multiple jobs
- View job details
- Standard View dropdown
- Saved custom views
- List / Map toggle
- Pagination or infinite scroll
- Export support
- Role-based visibility

### Recommended Filters

- Status
- Job type
- Project manager
- Client
- City
- Zip code
- Job group
- Warranty status
- Active / closed
- Date range

---

## Jobs Map Page

The Jobs Map page should plot jobs by address.

### Required Features

- Map / Satellite toggle
- Job pins
- Left-side job list
- View button for each job
- Cluster button
- Map all button
- Search and filters inherited from Jobs List
- Click a pin to open job preview
- Click View to open job summary

### Address and Geocoding Requirements

- Jobs must store address data cleanly.
- Jobs should support latitude and longitude if available.
- If latitude / longitude are missing, the app should geocode the address when possible.
- Jobs without valid addresses should appear in the list but not on the map.

---

## Job Summary Page

The Job Summary page is the main landing page for a single job.

### Header

The header should show:

- Job name
- Job number
- Job status badge
- Job address link
- Options menu
- Back to jobs / summary link

### Summary Card

The summary should show:

- Job name
- Job number
- Status badge
- Address
- Internal users currently clocked in
- Link to time sheets
- Client avatars
- Project manager avatars
- Add client button
- Add project manager button

### Dashboard Cards

The page should include dashboard cards for:

- Updates shared with clients this month
- Client Updates
- Daily Logs
- This Week's Agenda
- Past Due For You
- Due Today
- Action Items
- Recent Activity From Your Team

### Job Sidebar

The sidebar should show:

- Company branding
- Selected job card
- Job status
- Client names
- Address
- Jobs / Templates toggle
- Add Job button
- Job search
- Filter and sort controls
- Scrollable job list

---

## Job Info / Job Details Page

The Job Info page should be the editable settings page for a job.

### Tabs

The page should include the following tabs:

- Job details
- Clients
- Internal users
- Subs / vendors
- Advanced settings
- Builder's Risk Insurance or CMI Insurance / Risk

### Job Details Tab

Fields:

- Title / Job name
- Prefix
- Status
- Related Lead status
- Related Lead link
- View related Lead button
- Contract price
- Job type
- Manage job types link
- Contract type
- Fixed price
- Open book
- Address
- Street address
- City
- State
- Zip code
- Notes for internal users
- Notes for subs / vendors

Schedule fields:

- Projected start
- Actual start
- Projected completion
- Actual completion
- Update actual dates based on Schedule checkbox
- Schedule color
- Work days

Additional information fields:

- Job group
- Project managers
- Funded by construction loan
- Square feet
- Permit number
- Lot info

Accounting / integration fields:

- QuickBooks customer association or future accounting integration field
- Estimate / invoice sync state
- Accounting customer ID

---

## Clients Tab

The Clients tab should manage client contacts and client portal permissions.

### Required Features

- Add client contact
- Choose from existing contacts
- Create new contact
- List associated client contacts
- Remove client contact
- Client portal permissions
- Client payment settings

### Client Permissions

Project management visibility:

- Project manager phone number
- Locked selections
- Schedule phases
- Schedule items
- Time frame dropdown

Client submission permissions:

- Change order requests
- Warranty claims
- Client messages
- Files / documents
- Photos

Financial visibility:

- Job Price Summary
- Remaining Invoice Balance
- Purchase Orders / Bills
- Invoices
- Job Costing Budget

Client payment options:

- Credit cards
- ACH / bank transfer
- Client pays processing fees
- Minimum / maximum payment amounts

---

## Internal Users Tab

The Internal Users tab should control which CMI team members can access a job.

### Required Features

- Add internal user
- Remove internal user
- View user list
- Access status badges
- Notification checkbox per user
- Invite when job is saved

### Access Statuses

- Presale
- Open
- Warranty
- Closed

CMI should map these to the internal lifecycle permissions as needed.

### Internal User Fields

- User avatar
- Name
- Role
- Status access
- Notifications enabled
- Last active

---

## Subs / Vendors Tab

The Subs / Vendors tab should manage subcontractor and vendor access.

### Required Features

- Add sub / vendor
- Remove sub / vendor
- Search existing subs / vendors
- Invite sub / vendor when job is saved
- Empty state when no subs / vendors have access
- Vendor notification preferences

### Vendor Access Options

- Schedule visibility
- Assigned tasks
- Files
- Messages
- Purchase orders
- Change orders
- Selections
- Daily logs

---

## Advanced Settings Tab

The Advanced Settings tab should control deeper project management, template, financial, and budget behavior.

### Project Management Options

- Enable geofencing on Time Clock shifts
- Allow creation of allowances
- Enable schedule publishing
- Enable client updates
- Enable daily logs
- Enable warranty claims

### Template Options

- Make this job a working template
- Save current job as template
- Apply template to future job

### Margin and Markup

- Percentage type
- Markup
- Margin
- Percentage value
- Apply to new estimate line items
- Apply to change orders

### Taxes

- Default tax rate
- Manage tax rates

### Budget

- Projection reference default
- Include Time Clock labor in Job Costing Budget
- Budget visibility settings

### Purchase Orders

- Individual Purchase Order limit
- Total Job Purchase Order limit

---

## Builder's Risk Insurance / CMI Risk Tab

The screenshots show a Buildertrend Insurance Services panel. CMI may not need the exact same third-party insurance integration, but the feature area should be reserved for risk / insurance details.

Recommended tab name:

`Insurance / Risk`

Fields and features:

- Builder's risk status
- Insurance provider
- Policy number
- Policy start date
- Policy end date
- Coverage amount
- Certificate files
- Notes
- Risk checklist
- Request quote placeholder

This can be implemented as a placeholder if no insurance integration exists yet.

---

## Job Price Summary Page

The Job Price Summary page should show a printable financial summary of the job.

### Required Features

- Print button
- Display on printout settings
- Show approved Change Orders checkbox
- Show Invoices checkbox
- Update printout button
- Company logo and contact information
- Client information
- Job address
- Contract price subtotal
- Approved Change Orders table
- Invoice table
- Totals

### Approved Change Orders Table

Columns:

- Title
- Date
- Price
- Status

### Invoice Table

Columns:

- Invoice number
- Date
- Due date
- Amount
- Paid
- Balance
- Status

### Print Requirements

- Clean print stylesheet
- Company branding
- Client-ready layout
- Hide app navigation when printing
- Include generated date

---

## Add Job From Scratch

The New Job From Scratch flow should allow staff to create a new job manually.

### Required Tabs

- Job details
- Clients
- Internal users
- Subs / vendors
- Advanced settings
- Insurance / Risk

### Required Fields Before Save

- Job name
- Job type
- Job status
- Job number or generated job number

Recommended fields before save:

- Address
- Client contact
- Project manager
- Projected start date
- Projected completion date

### Draft Behavior

- New jobs may be saved as Draft if required fields are incomplete.
- Draft jobs should not be visible to clients or vendors.
- Draft jobs should appear to admins and authorized staff.

---

## Add Job From Template

The New Job From Template flow should allow staff to create a new job using an existing template.

### Modal / Page Fields

- New job name
- Job group
- Job type
- Projected start date
- Turn schedule online checkbox
- Contract type
- Contact
- Accounting customer
- Source template

### Template Import Should Copy

Depending on selected options, the system may copy:

- Schedule template
- Task template
- Phase structure
- Budget categories
- Cost codes
- Selections
- Allowances
- Files / folder structure
- Internal users
- Vendor roles
- Client permissions defaults
- Advanced settings

### Template Import Should Not Copy By Default

- Client-specific private files
- Invoices
- Payments
- Actual costs
- Daily logs
- Messages
- Warranty claims
- Change order history

---

## Job Templates

Jobs can be marked as templates.

Templates should be used for repeatable project types such as:

- Whole Home Remodel
- Kitchen Remodel
- Bathroom Remodel
- ADU / Casita
- Addition
- New Build
- Commercial TI
- Warranty

Template records should be separated visually from active jobs.

---

## Related Job Pages / Modules

Each job should act as the parent record for related modules.

Recommended job-scoped pages:

- `/jobs`
- `/jobs/map`
- `/jobs/new`
- `/jobs/new-from-template`
- `/jobs/:jobId/summary`
- `/jobs/:jobId/info`
- `/jobs/:jobId/price-summary`
- `/jobs/:jobId/schedule`
- `/jobs/:jobId/tasks`
- `/jobs/:jobId/files`
- `/jobs/:jobId/messages`
- `/jobs/:jobId/photos`
- `/jobs/:jobId/daily-logs`
- `/jobs/:jobId/change-orders`
- `/jobs/:jobId/invoices`
- `/jobs/:jobId/purchase-orders`
- `/jobs/:jobId/selections`
- `/jobs/:jobId/warranty`
- `/jobs/:jobId/activity`
- `/jobs/:jobId/settings`

---

## Data Model Recommendations

### jobs

Suggested fields:

- id
- organization_id
- related_lead_id
- related_opportunity_id
- job_number
- job_name
- job_type_id
- status
- lifecycle_stage
- job_color
- job_group_id
- contract_type
- contract_price
- street_address
- city
- state
- zip_code
- full_address
- latitude
- longitude
- projected_start_date
- actual_start_date
- projected_completion_date
- actual_completion_date
- update_actual_dates_from_schedule
- schedule_color
- work_days
- funded_by_construction_loan
- square_feet
- permit_number
- lot_info
- internal_notes
- vendor_notes
- is_template
- source_template_id
- created_by
- created_at
- updated_at
- archived_at

### job_types

- id
- organization_id
- name
- description
- color
- sort_order
- is_active

### job_groups

- id
- organization_id
- name
- description
- sort_order

### job_contacts

- id
- job_id
- contact_id
- role
- is_primary
- portal_access_enabled
- permissions_json
- created_at

### job_internal_users

- id
- job_id
- user_id
- role
- access_statuses
- notifications_enabled
- created_at

### job_vendors

- id
- job_id
- vendor_id
- role
- access_permissions_json
- notifications_enabled
- created_at

### job_settings

- id
- job_id
- geofencing_enabled
- allow_allowances
- schedule_online
- client_updates_enabled
- daily_logs_enabled
- warranty_claims_enabled
- markup_type
- markup_percentage
- default_tax_rate_id
- projection_reference_default
- include_time_clock_labor_in_budget
- individual_po_limit
- total_po_limit

### job_insurance

- id
- job_id
- status
- provider
- policy_number
- policy_start_date
- policy_end_date
- coverage_amount
- notes
- created_at
- updated_at

---

## Permissions

### Admin / Owner

Can:

- Create jobs
- Edit all job fields
- Delete or archive jobs
- Manage templates
- Manage job types
- Manage job groups
- Assign users
- Assign vendors
- View financials
- View reports

### Project Manager

Can:

- View assigned jobs
- Edit operational job details
- Manage schedule, tasks, logs, photos, files, and messages
- Add vendors if allowed
- View financials if allowed

### Internal Team Member

Can:

- View assigned jobs
- View tasks, files, messages, schedule, and logs based on permissions
- Receive notifications

### Client

Can:

- View portal-approved job information
- View approved schedule items
- View approved files
- Submit change order requests if enabled
- Submit warranty claims if enabled
- View approved invoices if enabled
- Send messages if enabled

### Vendor / Subcontractor

Can:

- View assigned job areas
- View assigned tasks
- Upload files if enabled
- Send messages if enabled
- View purchase orders if enabled

---

## Reporting Requirements

Jobs should support reporting for:

- Total jobs by status
- Active jobs
- Warranty jobs
- Closed jobs
- Jobs by project manager
- Jobs by job type
- Jobs by city / zip code
- Jobs by revenue / contract value
- Upcoming starts
- Upcoming completions
- Overdue completion dates
- Active budget to job conversion
- Pre-construction to active project conversion
- Warranty requests by job
- Client update frequency
- Daily log frequency

---

## AI Agent Implications

The CMI AI Agent should understand the Jobs feature and be able to help staff with job-related tasks.

Allowed AI-assisted tasks may include:

- Summarize job status
- Draft client updates
- Draft internal notes
- Summarize recent activity
- Summarize daily logs
- Prepare meeting notes
- Identify overdue tasks
- Identify missing job information
- Draft warranty response summaries
- Generate job reports
- Help create job templates
- Help classify jobs by type or status

The AI Agent should not make financial, legal, construction-code, contract, or insurance decisions without human review.

---

## Implementation Notes

- Use the existing CMI design system and dashboard layout.
- Do not copy Buildertrend branding.
- Do not imply an official Buildertrend integration unless one is actually implemented.
- Use Buildertrend screenshots only as workflow inspiration.
- Keep terminology aligned with CMI ownership's sales process.
- Connect Jobs to Leads and Opportunities where possible.
- Preserve existing data and avoid destructive migrations.
- Add migrations safely.
- Use role-based access control.
- Add audit logs for important job changes.
- Make all new pages responsive.

---

## Acceptance Criteria

The feature is complete when:

1. Staff can view all jobs in a searchable, filterable Jobs List.
2. Staff can view jobs on a map.
3. Staff can create a job from scratch.
4. Staff can create a job from a template.
5. Each job has a Summary page.
6. Each job has editable Job Info / Job Details.
7. Each job can have clients, internal users, and vendors assigned.
8. Each job can store schedule, address, project manager, job type, status, and financial summary data.
9. Each job can display a printable Job Price Summary.
10. Jobs can connect back to related Leads and Opportunities.
11. Jobs can support Warranty and Closed states.
12. The system supports future project modules such as files, messages, daily logs, change orders, invoices, selections, and warranty claims.

---

# Claude Code Prompt

Use the following prompt inside Claude Code in VS Code.

```text
You are working inside the Constructed Matter, Inc. web application codebase.

Review this documentation file first:

`docs\features\job-features.md`

Also review the related sales process documentation:

`docs\features\cmi-sales-process-leads-opportunities.md`

Your task is to implement a Buildertrend-inspired Jobs feature for the Constructed Matter app, using CMI terminology, branding, permissions, database conventions, and design system.

The goal is to add the same core job-management functionality shown in the Buildertrend reference screenshots, without copying Buildertrend branding or creating a dependency on Buildertrend.

The Jobs feature must include:

1. Jobs List
2. Jobs Map
3. Job Summary page
4. Job Info / Job Details page
5. Job Price Summary page
6. New Job From Scratch flow
7. New Job From Template flow
8. Job Clients tab
9. Job Internal Users tab
10. Job Subs / Vendors tab
11. Job Advanced Settings tab
12. Insurance / Risk tab
13. Job templates
14. Relationship between Jobs, Leads, and Opportunities

Before writing code, inspect the current repository and identify the existing structure for:

- routes
- pages
- components
- layouts
- dashboard navigation
- database schema
- migrations
- Supabase tables or ORM models
- auth and role permissions
- contacts
- clients
- leads
- opportunities
- projects
- tasks
- files
- messages
- financial records
- reports

Then implement the Jobs feature in the cleanest way that fits the current architecture.

Core requirements:

- Every job must have a unique job number.
- Every job must have a unique job name.
- Every job must have a job type.
- Every job must have a job status.
- Every job should support a job address.
- Jobs should connect to related Leads and Opportunities when applicable.
- A job number should be created when an Opportunity becomes a real project record.
- Basic marketing Leads should not require job numbers.
- Jobs should support Draft, Opportunity, Active Budget, Pre-Construction / Design, Active Project, Warranty, Closed, Long Lead, Not Moving Forward, On Hold, and Cancelled states where appropriate.
- Jobs should support Buildertrend-style status mapping for Presale, Open, Warranty, and Closed if useful.

Build the Jobs List page with:

- searchable table
- filters
- sorting
- job color
- job name
- job number
- address
- city
- state
- zip code
- project manager
- clients
- client phone
- job type
- job status
- list/map toggle
- saved view placeholder if not already supported

Build the Jobs Map page with:

- map display
- job pins based on job address or latitude/longitude
- left-side job list
- View buttons
- cluster button placeholder if clustering is not implemented yet
- map all button placeholder if needed
- fallback for jobs without valid geocoding

Build the Job Summary page with:

- job name
- job status badge
- job address
- internal users clocked in placeholder or integration with time clock if present
- clients section
- project managers section
- past due items card
- due today card
- action items card
- recent activity card
- weekly agenda card
- client updates / daily logs summary card

Build the Job Info page with tabs:

- Job details
- Clients
- Internal users
- Subs/vendors
- Advanced settings
- Insurance / Risk

The Job details tab should include:

- title / job name
- prefix
- status
- related lead status and link
- related opportunity link if available
- contract price
- job type
- contract type
- fixed price / open book
- address fields
- schedule fields
- job group
- project managers
- construction loan flag
- square feet
- permit number
- lot info
- internal notes
- vendor notes

The Clients tab should include:

- add existing contact
- create new contact
- associated client contacts list
- client portal permissions
- financial visibility permissions
- client submission permissions for change orders and warranty claims
- client payment settings placeholders if payment processing is not implemented

The Internal Users tab should include:

- add internal user
- remove internal user
- user list
- status access badges
- notification checkbox

The Subs / Vendors tab should include:

- add sub/vendor
- remove sub/vendor
- empty state
- access permissions placeholder
- notification settings placeholder

The Advanced Settings tab should include:

- geofencing option
- allowance option
- template option
- margin / markup settings
- tax settings
- budget settings
- purchase order limits

The Insurance / Risk tab should include:

- builder's risk status
- insurance provider
- policy number
- policy start/end dates
- coverage amount
- certificate file placeholder
- notes
- request quote placeholder

Build the Job Price Summary page with:

- print button
- print options
- show approved change orders checkbox
- show invoices checkbox
- company branding area
- client information
- job address
- contract price subtotal
- approved change orders table
- invoice table
- totals
- print-friendly styling

Build New Job From Scratch with:

- job details form
- clients tab
- internal users tab
- subs/vendors tab
- advanced settings tab
- insurance/risk tab
- save as draft support
- validation for required fields

Build New Job From Template with:

- modal or page
- new job name
- job group
- job type
- projected start date
- turn schedule online checkbox
- contract type
- contact selector
- accounting customer placeholder
- source template selector
- save action
- copy safe template data only

Add or update database tables/migrations as needed for:

- jobs
- job_types
- job_groups
- job_contacts
- job_internal_users
- job_vendors
- job_settings
- job_insurance
- job_templates if needed

Preserve all existing functionality. Do not remove existing features unless they directly conflict with this workflow. If there is an existing Projects or Jobs structure, extend it rather than duplicating it, unless a clean migration requires a new model.

Use role-based permissions. Clients and vendors should only see job information explicitly allowed by staff.

Add comments around:

- job number generation
- lead/opportunity to job conversion
- template import behavior
- role-based access
- print summary calculations

After implementation, provide a summary with:

- files changed
- tables/migrations added
- UI pages/components added
- assumptions made
- anything intentionally left as placeholder
- follow-up tasks needed
```
