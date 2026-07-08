# Constructed Matter, Inc. Sales Process, Leads, Opportunities & Project Lifecycle

## Purpose

This document defines the standardized sales, CRM, opportunity, pre-construction, production, warranty, and closed-project workflow for Constructed Matter, Inc. The goal is to create a clean distinction between marketing/CRM contacts, realistic project opportunities, active estimating work, committed pre-construction/design work, active construction projects, warranty tracking, and archived historical records.

This workflow should be used as the foundation for the Constructed Matter WebApp, staff dashboard, CRM structure, reporting, client portal, project management tools, and future AI agent workflows.

---

## Core Principle

Constructed Matter should treat **Lead**, **Opportunity**, and **Project** as related but separate concepts.

- A **Lead** is a person, company, contact, referral source, or audience member who could potentially generate work.
- An **Opportunity** is created once there is a realistic potential project and a job number should be assigned.
- A **Project** becomes active once the client has formally committed, a construction agreement is executed, or construction has a defined start date.

This separation allows Constructed Matter to track marketing activity, sales pipeline, pre-construction effort, production work, warranty obligations, and long-term client history without mixing everything into one generic “lead” status.

---

# 1. Lead

## Definition

A **Lead** is anyone who could potentially generate work for Constructed Matter, whether they currently have a project or not.

A Lead may be a potential client, referral partner, past client, homeowner, buyer, designer, architect, engineer, realtor, or any person or organization that fits Constructed Matter’s target audience or referral network.

## Lead Examples

Examples include:

- Architects
- Interior designers
- Engineers
- Realtors
- Past clients
- New home buyers
- Homeowners in targeted neighborhoods or zip codes
- Homeowners who have recently pulled permits
- Anyone who fits Constructed Matter’s target demographic
- Mass leads from marketing lists, events, campaigns, imports, forms, scraping, referrals, or outreach
- Any person or company that could become a client or refer work

## Lead Purpose

The Lead stage is primarily for marketing, relationship management, prospecting, nurturing, and future business development.

Leads do **not** require a job number unless they progress into a specific realistic project opportunity.

## Recommended Lead Fields

Each Lead should support the following data structure:

```yaml
lead:
  id: string
  lead_type:
    - homeowner
    - architect
    - interior_designer
    - engineer
    - realtor
    - past_client
    - new_home_buyer
    - neighborhood_homeowner
    - permit_based_lead
    - referral_partner
    - vendor_partner
    - mass_import
    - other
  first_name: string
  last_name: string
  company_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip_code: string
  source: string
  referral_source: string
  tags: string[]
  target_neighborhood: string
  target_zip_code: string
  notes: string
  assigned_owner: string
  status:
    - new
    - contacted
    - nurturing
    - qualified
    - unqualified
    - converted_to_opportunity
    - inactive
  created_at: datetime
  updated_at: datetime
```

## Lead Actions

The system should allow staff to:

- Create a lead manually.
- Import leads in bulk.
- Tag leads by source, geography, trade type, referral source, or campaign.
- Assign leads to a team member.
- Add notes and follow-up reminders.
- Connect leads to companies, contacts, projects, opportunities, emails, calls, meetings, files, and messages.
- Convert a lead into an opportunity when a realistic project exists.

---

# 2. Opportunity

## Definition

An **Opportunity** exists once there is a realistic potential project.

This is the point where Constructed Matter should create a **job number**.

An Opportunity is no longer just a general CRM contact. It represents a possible project with enough substance to track as real future work.

## When to Create an Opportunity

Create an Opportunity when one or more of the following are true:

- A homeowner has an idea for a renovation, addition, ADU, casita, remodel, or custom home project.
- Plans are being developed.
- The contact is working with an architect or designer.
- The project was referred by a realtor, architect, designer, engineer, past client, or referral partner.
- An existing client is discussing a future project.
- The project has a location, scope, budget range, drawings, concept, or realistic timeline.
- Constructed Matter needs to begin tracking the potential job as a specific project.

## Job Number Rule

A job number should be created when the record becomes an Opportunity.

The job number should follow the opportunity/project through the entire lifecycle:

```text
Opportunity → Active Budget → Pre-Construction / Design → Active Project → Warranty → Closed
```

If the Opportunity moves to Long Lead or Not Moving Forward, the job number remains associated with the record for historical reporting.

## Recommended Opportunity Fields

```yaml
opportunity:
  id: string
  job_number: string
  linked_lead_id: string
  linked_contact_ids: string[]
  linked_company_ids: string[]
  opportunity_name: string
  project_address: string
  city: string
  state: string
  zip_code: string
  project_type:
    - remodel
    - addition
    - adu
    - casita
    - custom_home
    - commercial
    - interior_renovation
    - exterior_renovation
    - other
  estimated_budget_range: string
  estimated_project_value: number
  estimated_start_date: date
  estimated_close_date: date
  probability_percent: number
  source: string
  referral_source: string
  assigned_owner: string
  stage:
    - opportunity
    - active_budget
    - pre_construction_design
    - active_project
    - warranty
    - closed
    - long_lead
    - not_moving_forward
  status_reason: string
  tags: string[]
  notes: string
  created_at: datetime
  updated_at: datetime
```

## Opportunity Actions

The system should allow staff to:

- Convert a lead into an opportunity.
- Create a job number automatically or manually.
- Link contacts, companies, referral sources, designers, architects, engineers, vendors, and internal staff.
- Add scope notes, files, photos, preliminary budgets, documents, drawings, and correspondence.
- Assign an opportunity owner.
- Track probability, expected value, forecast date, and current stage.
- Move the opportunity into Active Budget, Long Lead, or Not Moving Forward.

---

# 3. Active Budget

## Definition

**Active Budget** means Constructed Matter is actively investing time into evaluating, estimating, pricing, or refining the potential project.

This is the active estimating and pre-construction evaluation phase before the client formally commits.

## Typical Active Budget Activities

- Site visits
- Existing conditions documentation
- Matterport scanning
- Budget development
- Preliminary pricing
- Scope refinement
- Value engineering
- Budget revisions
- Early trade partner input
- Initial schedule considerations
- Owner/designer/architect coordination

## Active Budget Purpose

Active Budget should help Constructed Matter track:

- Which opportunities are consuming staff time.
- Which projects are likely to become future work.
- How much estimating and pre-construction effort is being invested.
- Conversion rates from budget effort to committed pre-construction or construction work.
- Reasons projects stall or fall out of the pipeline.

## Recommended Active Budget Fields

```yaml
active_budget:
  opportunity_id: string
  job_number: string
  budget_status:
    - initial_review
    - site_visit_scheduled
    - existing_conditions
    - matterport_complete
    - estimating
    - budget_sent
    - budget_revision
    - value_engineering
    - awaiting_client_response
    - ready_for_pre_construction
    - moved_to_long_lead
    - not_moving_forward
  budget_owner: string
  budget_due_date: date
  last_budget_sent_date: date
  budget_revision_count: number
  current_budget_total: number
  internal_estimated_cost: number
  projected_margin: number
  notes: string
  updated_at: datetime
```

## Active Budget Exit Paths

From Active Budget, a project can move into one of three primary paths:

1. **Pre-Construction / Design**
2. **Long Lead**
3. **Not Moving Forward**

---

# 4. Pre-Construction / Design

## Definition

**Pre-Construction / Design** means the client is moving forward with Constructed Matter.

At this stage, Constructed Matter should be comfortable forecasting the project as future work.

## Typical Activities

- Design coordination
- Engineering coordination
- Ongoing budgeting
- Constructability reviews
- Permitting
- Procurement planning
- Schedule planning
- Vendor and trade partner coordination
- Client selections
- Pre-construction documentation
- Final scope alignment

## Forecasting Impact

Projects in Pre-Construction / Design should appear in forecasting reports as future work unless marked otherwise.

The project is not yet active production, but it has moved beyond general estimating and should be treated as a committed or highly probable future project.

## Recommended Fields

```yaml
pre_construction_design:
  opportunity_id: string
  job_number: string
  agreement_status:
    - pending
    - signed
    - verbal_commitment
    - design_only
    - pre_construction_agreement
  design_team: string[]
  architect: string
  designer: string
  engineer: string
  permit_status:
    - not_started
    - in_progress
    - submitted
    - comments_received
    - approved
  procurement_status:
    - not_started
    - planning
    - pricing
    - selections_needed
    - ready
  projected_construction_start_date: date
  projected_construction_value: number
  forecast_probability_percent: number
  notes: string
  updated_at: datetime
```

## Exit Path

Pre-Construction / Design normally moves into **Active Project** once the construction agreement has been executed, the client is fully committed, or construction has a defined start date.

---

# 5. Active Project

## Definition

An **Active Project** means the construction agreement has been executed, the client is fully committed, and construction has either started or has a defined start date.

The project is now in active production.

## Typical Activities

- Project schedule management
- Field coordination
- Daily logs
- Subcontractor coordination
- Client communication
- Change orders
- Selections tracking
- Photos and documentation
- RFIs and project correspondence
- Budget and billing tracking
- Inspections
- Punch list management

## Recommended Fields

```yaml
active_project:
  project_id: string
  job_number: string
  construction_agreement_status:
    - signed
    - committed
    - pending_final_signature
  start_date: date
  projected_completion_date: date
  actual_completion_date: date
  project_manager: string
  superintendent: string
  client_ids: string[]
  project_status:
    - scheduled
    - active
    - delayed
    - on_hold
    - punch_list
    - substantial_completion
    - complete
  contract_value: number
  approved_change_orders_total: number
  current_project_value: number
  notes: string
  updated_at: datetime
```

## Exit Path

Once construction is complete, the project should move into **Warranty**.

---

# 6. Warranty

## Definition

**Warranty** begins when construction is complete.

The project remains active for warranty tracking, typically for two years.

## Warranty Portal Requirement

Clients should be able to submit warranty requests through the client portal or website so that warranty issues remain organized and connected to the project record.

## Recommended Warranty Features

The WebApp should support:

- Client warranty request submission.
- Warranty ticket creation.
- Project-linked warranty records.
- Photo and file uploads.
- Request status tracking.
- Internal assignment.
- Communication history.
- Warranty due dates and expiration date.
- Reporting on open and closed warranty issues.

## Recommended Fields

```yaml
warranty:
  project_id: string
  job_number: string
  warranty_start_date: date
  warranty_expiration_date: date
  warranty_period_months: 24
  warranty_status:
    - active
    - request_received
    - scheduled
    - in_progress
    - resolved
    - expired
  open_warranty_request_count: number
  closed_warranty_request_count: number
  notes: string
  updated_at: datetime
```

## Exit Path

When the warranty period expires, the project moves to **Closed**.

---

# 7. Closed

## Definition

**Closed** means the warranty period has expired and the project is archived.

Closed projects should remain fully searchable and connected to all historical project data.

## Closed Project Records Should Preserve

- Drawings
- Documents
- Budgets
- Contracts
- Change orders
- Photos
- Videos
- Matterport scans
- Permits
- Warranty records
- Client correspondence
- Internal notes
- Vendor/subcontractor history
- Final project value
- Project timeline
- Lessons learned

## Recommended Fields

```yaml
closed_project:
  project_id: string
  job_number: string
  closed_date: date
  archive_status:
    - archived
    - searchable
  final_contract_value: number
  final_project_value: number
  final_margin: number
  closeout_notes: string
  searchable_keywords: string[]
  updated_at: datetime
```

---

# 8. Alternate Path: Long Lead

## Definition

**Long Lead** means the project is real, but not ready to move forward.

These records should remain in the follow-up pipeline with reminders.

## Long Lead Examples

- Waiting on financing
- Waiting on design
- Future purchase
- Planning for next year
- Timing is not right
- Client is interested but not ready
- Architect/designer is still developing plans
- Project depends on a future event or decision

## Recommended Fields

```yaml
long_lead:
  opportunity_id: string
  job_number: string
  long_lead_reason:
    - waiting_on_financing
    - waiting_on_design
    - future_purchase
    - planning_for_next_year
    - timing_not_right
    - client_not_ready
    - other
  follow_up_date: date
  follow_up_owner: string
  follow_up_frequency:
    - weekly
    - monthly
    - quarterly
    - custom
  notes: string
  updated_at: datetime
```

## Long Lead Actions

The system should allow staff to:

- Set follow-up reminders.
- Assign follow-up responsibility.
- Add notes and reason tags.
- Move the record back to Active Budget when timing improves.
- Move the record to Not Moving Forward if the project dies.

---

# 9. Alternate Path: Not Moving Forward

## Definition

**Not Moving Forward** means the project is no longer active.

The record should remain in the system with a clear reason so Constructed Matter can report on lost opportunities.

## Reason Tags

Possible reasons include:

- Not feasible
- Outside budget
- Chose another builder
- Project cancelled
- Project indefinitely postponed
- Client unresponsive
- Scope not aligned
- Timeline not aligned
- Outside Constructed Matter’s ideal project type
- Duplicate opportunity
- Other

## Recommended Fields

```yaml
not_moving_forward:
  opportunity_id: string
  job_number: string
  lost_reason:
    - not_feasible
    - outside_budget
    - chose_another_builder
    - cancelled
    - on_hold_indefinitely
    - client_unresponsive
    - scope_not_aligned
    - timeline_not_aligned
    - not_ideal_project_type
    - duplicate
    - other
  lost_to_builder: string
  lost_date: date
  notes: string
  updated_at: datetime
```

## Reporting Purpose

These records are important because they help Constructed Matter understand:

- Why opportunities are lost.
- Where the pipeline leaks.
- Whether pricing, timing, scope, feasibility, or competition are recurring issues.
- Which referral sources produce strong or weak opportunities.
- Which project types convert best.

---

# 10. Full Lifecycle Workflow

```text
Lead
│
└── Opportunity (Job Number Created)
      │
      └── Active Budget
            ├── Pre-Construction / Design
            │      │
            │      └── Active Project
            │              │
            │              └── Warranty
            │                      │
            │                      └── Closed
            │
            ├── Long Lead
            │
            └── Not Moving Forward
                    ├── Not Feasible
                    ├── Outside Budget
                    ├── Different Builder
                    └── Cancelled / On Hold
```

---

# 11. Recommended Stage Definitions for the WebApp

Use the following normalized stage values in the database and UI.

```yaml
pipeline_stages:
  lead:
    label: Lead
    description: Marketing, CRM, referral, or prospect contact who could potentially generate work.
    job_number_required: false

  opportunity:
    label: Opportunity
    description: Realistic potential project. Job number is created here.
    job_number_required: true

  active_budget:
    label: Active Budget
    description: Constructed Matter is actively investing estimating or pre-construction evaluation time.
    job_number_required: true

  pre_construction_design:
    label: Pre-Construction / Design
    description: Client is moving forward with Constructed Matter. Forecast as future work.
    job_number_required: true

  active_project:
    label: Active Project
    description: Construction agreement is executed or fully committed, and construction has started or has a defined start date.
    job_number_required: true

  warranty:
    label: Warranty
    description: Construction is complete and the project is in the warranty tracking period.
    job_number_required: true

  closed:
    label: Closed
    description: Warranty has expired and the project is archived but fully searchable.
    job_number_required: true

  long_lead:
    label: Long Lead
    description: Real project, but timing is not ready. Requires follow-up reminders.
    job_number_required: true

  not_moving_forward:
    label: Not Moving Forward
    description: Opportunity is no longer active. Reason should be recorded for reporting.
    job_number_required: true
```

---

# 12. Required Stage Transition Rules

## Allowed Transitions

```yaml
allowed_transitions:
  lead:
    - opportunity

  opportunity:
    - active_budget
    - long_lead
    - not_moving_forward

  active_budget:
    - pre_construction_design
    - long_lead
    - not_moving_forward

  pre_construction_design:
    - active_project
    - long_lead
    - not_moving_forward

  active_project:
    - warranty

  warranty:
    - closed

  long_lead:
    - active_budget
    - not_moving_forward

  not_moving_forward:
    - long_lead
    - active_budget

  closed:
    - warranty
```

## Transition Requirements

```yaml
transition_requirements:
  lead_to_opportunity:
    required:
      - opportunity_name
      - project_description_or_scope
      - assigned_owner
      - job_number

  opportunity_to_active_budget:
    recommended:
      - project_address
      - project_type
      - estimated_budget_range
      - next_action
      - budget_owner

  active_budget_to_pre_construction_design:
    recommended:
      - client_commitment_status
      - projected_construction_value
      - projected_start_date
      - design_team_or_scope_notes

  pre_construction_design_to_active_project:
    required:
      - construction_agreement_status
      - start_date_or_defined_start_window
      - project_manager

  active_project_to_warranty:
    required:
      - actual_completion_date
      - warranty_start_date
      - warranty_expiration_date

  warranty_to_closed:
    required:
      - warranty_expiration_date
      - closed_date
```

---

# 13. Reporting Requirements

The WebApp should provide reporting across the full lifecycle.

## Conversion Reporting

Track conversion rates for:

```text
Leads → Opportunities
Opportunities → Active Budgets
Active Budgets → Pre-Construction / Design
Pre-Construction / Design → Active Projects
Active Projects → Warranty
Warranty → Closed
```

## Pipeline Reporting

Reports should show:

- Total leads by source.
- Total opportunities by stage.
- Total estimated pipeline value.
- Active Budget count and value.
- Pre-Construction / Design forecast value.
- Active Project contract value.
- Long Lead count and follow-up dates.
- Not Moving Forward count by reason.
- Opportunity conversion by referral source.
- Project type conversion rates.
- Average time in each stage.
- Win/loss reasons.
- Forecasted future work.

## Example Report Fields

```yaml
reporting:
  pipeline_summary:
    total_leads: number
    total_opportunities: number
    active_budget_count: number
    pre_construction_count: number
    active_project_count: number
    warranty_count: number
    closed_project_count: number
    long_lead_count: number
    not_moving_forward_count: number
    estimated_pipeline_value: number
    forecasted_project_value: number
    active_contract_value: number

  conversion_rates:
    lead_to_opportunity_percent: number
    opportunity_to_active_budget_percent: number
    active_budget_to_pre_construction_percent: number
    pre_construction_to_active_project_percent: number

  loss_analysis:
    not_feasible_count: number
    outside_budget_count: number
    chose_another_builder_count: number
    cancelled_count: number
    on_hold_count: number
```

---

# 14. Dashboard UI Recommendations

## CRM / Sales Pipeline Dashboard

The staff dashboard should include views for:

- Leads
- Opportunities
- Active Budgets
- Pre-Construction / Design
- Active Projects
- Warranty
- Closed Projects
- Long Leads
- Not Moving Forward

## Recommended Views

Each module should support:

- Table view
- Kanban view
- Calendar/follow-up view
- Detail view
- Timeline/activity view
- Search and filters
- Export/report view

## Recommended Filters

- Stage
- Status
- Assigned owner
- Project type
- Referral source
- Lead source
- Zip code
- Neighborhood
- Budget range
- Estimated value
- Follow-up date
- Lost reason
- Created date
- Last activity date

---

# 15. Client Portal Recommendations

The client portal should eventually support the parts of the lifecycle that involve client interaction.

## Recommended Client-Facing Features

- Project overview
- Active project updates
- Schedule visibility
- Documents
- Photos
- Messages
- Change orders
- Selections
- Warranty request submission
- Warranty request status
- Contact information

## Warranty Request Form Fields

```yaml
warranty_request:
  id: string
  project_id: string
  job_number: string
  submitted_by: string
  request_title: string
  request_description: string
  location_in_home: string
  priority:
    - low
    - normal
    - urgent
  photos: file[]
  documents: file[]
  status:
    - submitted
    - under_review
    - scheduled
    - in_progress
    - resolved
    - closed
  assigned_to: string
  submitted_at: datetime
  updated_at: datetime
```

---

# 16. AI Agent Implications

The Constructed Matter AI Agent should understand the difference between Lead, Opportunity, Active Budget, Pre-Construction / Design, Active Project, Warranty, Long Lead, Not Moving Forward, and Closed.

## AI Agent Should Be Able To

- Explain the pipeline stages to staff.
- Help convert a lead into an opportunity.
- Prompt staff for required fields before creating a job number.
- Summarize opportunities by stage.
- Draft follow-up messages for Long Leads.
- Summarize why projects are Not Moving Forward.
- Create reminders for follow-up dates.
- Prepare meeting briefs for opportunities or active budgets.
- Help generate reports by source, stage, value, and conversion rate.
- Help staff identify stale opportunities with no recent activity.
- Help prepare pre-construction summaries before owner/client meetings.
- Help organize warranty requests and project history.

## AI Agent Guardrails

The AI Agent should not:

- Create or delete job numbers without permission if the workflow requires human confirmation.
- Mark an opportunity as Active Project unless required commitment fields are present.
- Invent project values, dates, or client commitments.
- Treat a general marketing contact as an opportunity unless a realistic project exists.
- Treat a project as closed unless warranty dates and closeout requirements are satisfied.

---

# 17. Claude Code Implementation Prompt

Use the following prompt inside Claude Code in VS Code.

```text
You are working inside the Constructed Matter, Inc. WebApp codebase.

Create or update the sales process, CRM pipeline, leads, opportunities, active budget, pre-construction/design, active project, warranty, closed project, long lead, and not moving forward workflow.

Use the following business definitions and rules as the source of truth:

1. Lead
A Lead is anyone who could potentially generate work for Constructed Matter, whether they currently have a project or not. Examples include architects, interior designers, engineers, realtors, past clients, new home buyers, homeowners in targeted neighborhoods or zip codes, homeowners who recently pulled permits, mass imported leads, referral partners, and anyone who fits the target demographic. Leads are for marketing, CRM, prospecting, nurturing, and referral tracking. Leads do not require a job number.

2. Opportunity
An Opportunity exists once there is a realistic potential project. This is when a job number should be created. Examples include a homeowner with a renovation or addition idea, plans being developed, a project connected to an architect/designer, a referral from a realtor/architect/designer, or an existing client discussing future work. Opportunities should track project address, project type, budget range, estimated value, assigned owner, source, referral source, contacts, companies, and notes.

3. Active Budget
Active Budget means Constructed Matter is actively investing time into the project through site visits, existing conditions documentation, Matterport scanning, budget development, preliminary pricing, scope refinement, value engineering, and budget revisions. This is active estimating/pre-construction effort before the client formally commits.

4. Pre-Construction / Design
Pre-Construction / Design means the client is moving forward with Constructed Matter. Activities include design coordination, engineering, ongoing budgeting, constructability reviews, permitting, procurement planning, and scheduling. These records should be forecastable as future work.

5. Active Project
Active Project means the construction agreement has been executed or the project is fully committed, and construction has either started or has a defined start date. This is active production.

6. Warranty
Warranty begins when construction is complete. Warranty should typically track a two-year period. Clients should be able to submit warranty requests through the client portal or website, and those requests should remain connected to the project.

7. Closed
Closed means warranty has expired. The project should be archived but fully searchable, including drawings, documents, budgets, photos, correspondence, and warranty history.

8. Long Lead
Long Lead means the project is real but not ready. Examples include waiting on financing, waiting on design, future purchase, planning for next year, or timing is not right. These should stay in the follow-up pipeline with reminders.

9. Not Moving Forward
Not Moving Forward means the opportunity is no longer active. Reasons/tags should include Not Feasible, Outside Budget, Chose Another Builder, Project Cancelled, On Hold Indefinitely, Client Unresponsive, Scope Not Aligned, Timeline Not Aligned, Not Ideal Project Type, Duplicate, and Other.

Implement the normalized pipeline stages:
- lead
- opportunity
- active_budget
- pre_construction_design
- active_project
- warranty
- closed
- long_lead
- not_moving_forward

Follow these transition rules:
- lead → opportunity
- opportunity → active_budget, long_lead, not_moving_forward
- active_budget → pre_construction_design, long_lead, not_moving_forward
- pre_construction_design → active_project, long_lead, not_moving_forward
- active_project → warranty
- warranty → closed
- long_lead → active_budget, not_moving_forward
- not_moving_forward → long_lead, active_budget
- closed → warranty only if an authorized admin reopens the record

Build the feature in a way that matches the existing Constructed Matter app architecture, styling, naming conventions, database patterns, Supabase usage, dashboard UI patterns, and existing project/contact/task systems.

Please perform the following tasks:

1. Audit the existing codebase for current lead, client, contact, project, opportunity, project management, CRM, dashboard, Supabase, and routing structures.
2. Identify the existing files, tables, types, components, hooks, routes, and API/server actions that should be extended instead of duplicated.
3. Create or update the data model/types for Leads, Opportunities, Pipeline Stages, Active Budget, Pre-Construction / Design, Active Project, Warranty, Closed Project, Long Lead, and Not Moving Forward.
4. Add job number creation rules so a job number is created at the Opportunity stage, not at the generic Lead stage.
5. Add stage transition validation so records can only move through approved stage paths.
6. Add required/recommended field checks for important transitions:
   - Lead to Opportunity requires opportunity name, project description/scope, assigned owner, and job number.
   - Pre-Construction / Design to Active Project requires construction agreement status, start date or defined start window, and project manager.
   - Active Project to Warranty requires actual completion date, warranty start date, and warranty expiration date.
   - Warranty to Closed requires warranty expiration date and closed date.
7. Add Long Lead follow-up fields and reminders.
8. Add Not Moving Forward reason tags and reporting support.
9. Add or update dashboard views for Leads, Opportunities, Active Budgets, Pre-Construction / Design, Active Projects, Warranty, Closed Projects, Long Leads, and Not Moving Forward.
10. Add table, kanban, detail, activity/timeline, and reporting-friendly views where consistent with the existing dashboard.
11. Add filters for stage, owner, project type, lead source, referral source, zip code, budget range, estimated value, follow-up date, lost reason, created date, and last activity date.
12. Add reporting data structures for conversion rates:
    - Leads to Opportunities
    - Opportunities to Active Budgets
    - Active Budgets to Pre-Construction / Design
    - Pre-Construction / Design to Active Projects
13. Add pipeline reporting for estimated pipeline value, forecasted future work, active project value, Long Leads, and Not Moving Forward reasons.
14. Add client portal support for warranty request submission if the app already has a client portal foundation. If not, create a clean scaffold and TODO notes for the warranty request feature.
15. Ensure all new UI follows the Constructed Matter visual style, dashboard patterns, spacing, typography, buttons, cards, form controls, and responsive behavior.
16. Do not remove existing working functionality.
17. Do not create duplicate systems if existing lead/client/project/contact structures already exist. Extend the existing system whenever possible.
18. Add comments or documentation where the terminology may be confusing.
19. Add seed/sample data only if the project already uses seed data patterns.
20. Update or create documentation explaining the sales process and lifecycle.

Before writing code, inspect the repository and provide a concise implementation plan listing:
- Existing files/tables/components found
- Proposed files to edit or create
- Proposed database/schema changes
- UI screens/components to update
- Any assumptions or risks

After implementation, provide:
- Summary of changes
- Files changed
- Database migrations created, if any
- Testing steps
- Any remaining TODOs
```

---

# 18. Suggested File Names

Recommended documentation file names:

```text
docs/sales/cmi-sales-process-leads-opportunities.md
docs/sales/cmi-pipeline-stages.md
docs/sales/cmi-opportunity-lifecycle.md
docs/agents/cmi-sales-pipeline-agent-notes.md
```

Recommended implementation prompt file name:

```text
prompts/claude/cmi-sales-process-pipeline-prompt.md
```

---

# 19. Summary

This structure creates a cleaner distinction between marketing/CRM contacts, actual project opportunities, active estimating efforts, committed pre-construction/design work, active construction projects, warranty obligations, and closed historical project records.

It also enables stronger forecasting and reporting because Constructed Matter can track:

- Lead sources
- Opportunity creation
- Active estimating effort
- Pre-construction conversion
- Active project value
- Warranty activity
- Closed project history
- Long Lead follow-ups
- Lost opportunity reasons
- Conversion rates across the full lifecycle

