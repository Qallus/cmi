# Constructed Matter — Project Management Templates

## File Purpose

This document is the source-of-truth planning file for repeatable construction project management templates inside the Constructed Matter, Inc. web app / CRM.

These templates are intended to help staff quickly create a standardized project schedule, Gantt timeline, task list, punch list structure, milestone plan, and client-visible project timeline based on the selected project type.

Recommended location:

`/docs/project-management-templates.md`

## Core Goal

The project management system should allow CMI staff to select a project template when creating a new project. Once selected, the app should automatically add pre-established phases, tasks, milestones, schedule items, punch list categories, approvals, dependencies, and client-visible updates to the project Gantt timeline.

The system should be flexible enough for remodels, additions, casitas, garages, bedrooms, bathrooms, kitchens, landscaping, backyards, new homes, and custom construction projects.

## Template Behavior

When a staff user creates a new project and selects a template, the system should:

1. Create the parent project.
2. Associate all generated phases, tasks, milestones, punch items, and schedule updates with the selected `project_name` and `project_id`.
3. Add predefined phases to the Gantt timeline.
4. Add predefined task items under the correct project and phase.
5. Add milestone markers.
6. Add dependencies between tasks where applicable.
7. Add client-visible defaults.
8. Add internal-only defaults.
9. Add punch list categories/rooms where applicable.
10. Allow all generated items to be manually edited after creation.
11. Allow staff to drag schedule items left/right on the Gantt timeline.
12. Allow staff to adjust start/end times down to the minute where the existing timeline supports minute-level scheduling.
13. Show a tooltip while dragging that displays the updated date/time and minute adjustment.
14. Preserve the relationship between project name, tasks, punch list items, rooms/areas, milestones, files, notes, and client updates.

## Required Relationship Rules

Every generated item should be tied back to the selected project.

Required associations:

- Project Phase → project_id and project_name
- Project Task → project_id, project_name, phase_id, phase_name
- Project Milestone → project_id, project_name, phase_id if applicable
- Punch Item → project_id, project_name, phase_id if applicable, room_area_id if applicable
- Schedule Update → project_id, project_name, related_type, related_id
- Dependency → project_id, parent_task_id, dependent_task_id
- Client Update → project_id and visibility status

Project name must be visible and searchable throughout:

- Gantt timeline
- Task list
- Punch list
- Project overview
- Schedule updates
- Reports
- Client dashboard
- Notifications

## Timeline Dragging / Minute-Level Adjustment

The Gantt timeline should allow schedule items to be moved by dragging left or right.

Expected behavior:

- Click and drag a task/timeline bar to move it earlier or later.
- Dragging left moves the task earlier.
- Dragging right moves the task later.
- Duration should remain the same unless resizing handles are implemented.
- If resizing handles exist, dragging the left/right edge should adjust start or end time.
- Updates should support minute-level precision where feasible.
- Tooltip should appear while dragging.
- Tooltip should show:
  - Updated start date/time
  - Updated end date/time
  - Difference from original time
  - Minute adjustment, such as `+45 min`, `-30 min`, `+2 hr 15 min`
- On drop, save the updated schedule item.
- If item has dependencies, warn or auto-shift dependent items depending on the current implementation.
- Do not silently break dependencies.

Suggested tooltip text:

```text
Start: Jun 12, 2026 9:30 AM
End: Jun 12, 2026 12:30 PM
Moved: +45 min
```

## Common Project Phases

Most templates can use some combination of these phases:

1. Sales / Proposal
2. Contract / Deposit
3. Pre-Construction
4. Design / Planning
5. Selections / Specifications
6. Permitting
7. Procurement
8. Site Preparation
9. Demolition
10. Foundation / Concrete
11. Framing
12. Roofing / Exterior Shell
13. Mechanical / Electrical / Plumbing
14. Inspections
15. Insulation / Drywall
16. Interior Finishes
17. Flooring
18. Cabinetry / Millwork
19. Fixtures / Appliances
20. Paint / Touchups
21. Exterior / Landscape
22. Final Inspection
23. Client Walkthrough
24. Punch List
25. Closeout
26. Warranty

## Common Statuses

Recommended statuses:

- Not Started
- Scheduled
- In Progress
- Waiting on Client
- Waiting on Subcontractor
- Waiting on Materials
- Waiting on Inspection
- Needs Review
- Completed
- Approved
- Blocked
- Delayed
- Reopened
- Canceled

## Common Priorities

Recommended priorities:

- Low
- Normal
- High
- Critical
- Blocking Schedule
- Blocking Closeout

## Common User Roles

Templates should support assigning generated tasks by role, even if the specific user is selected later.

Recommended owner roles:

- Super Admin
- Project Manager
- Staff
- Designer
- Estimator
- Superintendent
- Subcontractor
- Vendor
- Client
- Inspector
- Admin / Office
- System

## Client Visibility Defaults

Client-visible items may include:

- Project start date
- Major project phases
- Key milestones
- Approved schedule changes
- Client decision deadlines
- Selections deadlines
- Inspection dates
- Final walkthrough
- Punch list items requiring approval
- Completion / closeout updates

Internal-only items may include:

- Internal notes
- Staff assignments
- Subcontractor coordination
- Vendor cost issues
- Private blockers
- Management notes
- Budget-sensitive information
- Internal delay notes

Every phase, task, milestone, punch item, and update should include a `client_visible` setting.

---

# Template 1 — Kitchen Remodel

## Best For

Kitchen renovations, cabinet replacement, countertop replacement, appliance updates, flooring, lighting, plumbing, and full kitchen remodels.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Initial Client Consultation
3. Site Visit Scheduled
4. Existing Kitchen Photos Uploaded
5. Measurements Taken
6. Scope of Work Drafted
7. Estimate Created
8. Proposal Sent
9. Proposal Approved

### Contract / Deposit

1. Contract Sent
2. Contract Signed
3. Deposit Invoice Sent
4. Deposit Paid
5. Project Kickoff Scheduled

### Design / Planning

1. Kitchen Layout Review
2. Cabinet Layout Created
3. Countertop Material Selected
4. Backsplash Selected
5. Flooring Selected
6. Appliance Selection Confirmed
7. Lighting Plan Confirmed
8. Plumbing Fixture Selection Confirmed
9. Client Design Approval

### Permitting

1. Permit Requirements Reviewed
2. Permit Drawings Prepared if Needed
3. Permit Submitted
4. Permit Approved

### Procurement

1. Cabinets Ordered
2. Countertops Ordered
3. Fixtures Ordered
4. Appliances Ordered
5. Flooring Ordered
6. Tile / Backsplash Ordered
7. Materials Delivery Scheduled

### Site Preparation / Demolition

1. Pre-Construction Walkthrough
2. Site Protection Installed
3. Temporary Kitchen / Access Plan Confirmed
4. Demolition Started
5. Cabinets Removed
6. Countertops Removed
7. Flooring Removed if Needed
8. Demolition Completed
9. Demo Debris Removed

### Rough-In / MEP

1. Plumbing Rough-In
2. Electrical Rough-In
3. Lighting Rough-In
4. HVAC / Venting Adjustments if Needed
5. Rough Inspection

### Installation / Finishes

1. Drywall Repair
2. Cabinet Installation
3. Countertop Template
4. Countertop Fabrication
5. Countertop Installation
6. Backsplash Installation
7. Flooring Installation
8. Appliance Installation
9. Plumbing Fixture Installation
10. Electrical Fixture Installation
11. Paint / Touchups

### Final / Closeout

1. Final Inspection
2. Internal Quality Control
3. Client Walkthrough
4. Punch List Created
5. Punch Items Completed
6. Final Client Approval
7. Final Payment Due
8. Warranty / Care Info Sent
9. Project Closed

## Common Punch Areas

- Cabinets
- Countertops
- Backsplash
- Flooring
- Appliances
- Plumbing Fixtures
- Electrical Fixtures
- Paint / Touchups
- Trim / Baseboards
- Cleanup

---

# Template 2 — Bathroom Remodel

## Best For

Primary bathrooms, guest bathrooms, powder rooms, showers, tubs, tile, plumbing, vanities, lighting, and full bathroom remodels.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Initial Consultation
3. Bathroom Photos Uploaded
4. Site Visit Scheduled
5. Measurements Taken
6. Scope of Work Drafted
7. Estimate Created
8. Proposal Approved

### Contract / Deposit

1. Contract Sent
2. Contract Signed
3. Deposit Invoice Sent
4. Deposit Paid
5. Project Kickoff Scheduled

### Design / Selections

1. Layout Confirmed
2. Shower / Tub Design Confirmed
3. Tile Selected
4. Vanity Selected
5. Countertop Selected
6. Plumbing Fixtures Selected
7. Lighting Selected
8. Mirror / Accessories Selected
9. Client Design Approval

### Permitting

1. Permit Need Reviewed
2. Permit Submitted if Needed
3. Permit Approved

### Procurement

1. Tile Ordered
2. Vanity Ordered
3. Fixtures Ordered
4. Glass / Shower Door Ordered
5. Lighting Ordered
6. Materials Delivery Scheduled

### Demolition

1. Site Protection Installed
2. Demolition Started
3. Existing Fixtures Removed
4. Shower / Tub Removed
5. Flooring Removed
6. Demo Completed
7. Debris Removed

### Rough-In

1. Plumbing Rough-In
2. Electrical Rough-In
3. Framing Adjustments
4. Waterproofing Prep
5. Rough Inspection

### Installation / Finishes

1. Waterproofing Installed
2. Shower Pan / Tub Installed
3. Tile Installation
4. Grout / Sealing
5. Vanity Installation
6. Countertop Installation
7. Plumbing Fixture Installation
8. Lighting Installation
9. Mirror / Accessories Installation
10. Paint / Touchups

### Final / Closeout

1. Final Inspection
2. Internal Quality Control
3. Client Walkthrough
4. Punch List Created
5. Punch Items Completed
6. Final Approval
7. Final Payment Due
8. Warranty / Care Info Sent
9. Project Closed

## Common Punch Areas

- Shower
- Tub
- Tile
- Grout
- Vanity
- Countertop
- Plumbing Fixtures
- Lighting
- Mirrors
- Paint
- Cleanup

---

# Template 3 — Bedroom Remodel

## Best For

Bedroom remodels, closet upgrades, flooring, paint, lighting, trim, built-ins, windows, and finishes.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Initial Consultation
3. Site Visit
4. Measurements Taken
5. Scope Created
6. Estimate Sent
7. Proposal Approved

### Contract / Deposit

1. Contract Signed
2. Deposit Paid
3. Start Date Confirmed

### Design / Selections

1. Finish Direction Confirmed
2. Flooring Selected
3. Paint Colors Selected
4. Lighting Selected
5. Closet / Built-In Design Confirmed
6. Client Approval

### Procurement

1. Flooring Ordered
2. Lighting Ordered
3. Trim / Doors Ordered
4. Built-In Materials Ordered

### Construction

1. Site Protection
2. Demo / Removal
3. Framing Adjustments if Needed
4. Electrical Adjustments
5. Drywall Repair
6. Flooring Installation
7. Trim / Door Installation
8. Built-In Installation
9. Lighting Installation
10. Paint
11. Final Touchups

### Closeout

1. Internal Quality Control
2. Client Walkthrough
3. Punch List
4. Punch Completion
5. Final Payment
6. Project Closed

## Common Punch Areas

- Walls
- Paint
- Flooring
- Lighting
- Closet
- Doors
- Trim
- Windows
- Cleanup

---

# Template 4 — Garage Remodel / Conversion

## Best For

Garage upgrades, garage conversions, storage systems, epoxy floors, insulation, drywall, electrical, HVAC, and living space conversions.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Site Visit
3. Garage Measurements
4. Conversion Feasibility Reviewed
5. Scope of Work Drafted
6. Estimate Sent
7. Proposal Approved

### Contract / Deposit

1. Contract Signed
2. Deposit Paid
3. Kickoff Scheduled

### Design / Planning

1. Use Case Confirmed
2. Layout Confirmed
3. Storage / Cabinet Plan
4. Electrical Plan
5. HVAC / Insulation Plan
6. Flooring Selection
7. Client Approval

### Permitting

1. Permit Requirements Reviewed
2. Drawings Prepared if Needed
3. Permit Submitted
4. Permit Approved

### Procurement

1. Materials Ordered
2. Flooring Ordered
3. Cabinets / Storage Ordered
4. Fixtures Ordered

### Construction

1. Site Prep
2. Demo / Clearing
3. Framing if Needed
4. Insulation
5. Electrical Rough-In
6. HVAC Adjustments if Needed
7. Drywall
8. Flooring / Epoxy
9. Cabinets / Storage Installation
10. Lighting Installation
11. Paint / Finish

### Final / Closeout

1. Inspection
2. Internal Quality Control
3. Client Walkthrough
4. Punch List
5. Punch Completion
6. Final Payment
7. Project Closed

---

# Template 5 — Casita / Guest House

## Best For

Detached casitas, guest houses, backyard living spaces, ADUs, and small standalone structures.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Initial Consultation
3. Site Visit
4. Feasibility Review
5. Rough Budget Created
6. Proposal Sent
7. Proposal Approved

### Contract / Deposit

1. Contract Sent
2. Contract Signed
3. Deposit Paid
4. Project Kickoff

### Design / Planning

1. Site Plan Created
2. Floor Plan Created
3. Exterior Design Confirmed
4. Interior Layout Confirmed
5. Utility Requirements Reviewed
6. Client Design Approval

### Permitting

1. Permit Drawings Prepared
2. Engineering Review if Needed
3. Permit Submitted
4. Permit Corrections if Needed
5. Permit Approved

### Procurement

1. Long Lead Items Identified
2. Windows / Doors Ordered
3. Fixtures Ordered
4. Framing Materials Ordered
5. Finish Materials Ordered

### Site Preparation

1. Site Access Confirmed
2. Utility Locations Marked
3. Site Clearing
4. Excavation
5. Foundation Prep

### Foundation / Structure

1. Footings
2. Foundation / Slab
3. Foundation Inspection
4. Framing
5. Roof Framing
6. Windows / Exterior Doors
7. Weatherproofing

### MEP

1. Plumbing Rough-In
2. Electrical Rough-In
3. HVAC Rough-In
4. Rough Inspections

### Interior / Exterior Finishes

1. Insulation
2. Drywall
3. Exterior Finish
4. Flooring
5. Cabinetry
6. Countertops
7. Fixtures
8. Paint
9. Trim

### Final / Closeout

1. Final Inspections
2. Site Cleanup
3. Client Walkthrough
4. Punch List
5. Punch Completion
6. Final Approval
7. Final Payment
8. Warranty Info Sent
9. Project Closed

---

# Template 6 — Home Addition / Extension

## Best For

Room additions, square footage expansions, bedroom additions, living room extensions, kitchen expansions, and attached structures.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Site Visit
3. Existing Conditions Reviewed
4. Budget Range Discussed
5. Scope Drafted
6. Proposal Approved

### Contract / Deposit

1. Contract Signed
2. Deposit Paid
3. Kickoff Meeting

### Design / Engineering

1. Concept Design
2. Floor Plan
3. Structural Review
4. Engineering
5. Client Design Approval

### Permitting

1. Permit Drawings Prepared
2. Permit Submitted
3. Corrections Addressed
4. Permit Approved

### Procurement

1. Long Lead Items Ordered
2. Windows / Doors Ordered
3. Structural Materials Ordered
4. Fixtures / Finishes Ordered

### Site Preparation / Foundation

1. Site Protection
2. Demolition / Opening Prep
3. Excavation
4. Footings
5. Foundation / Slab
6. Foundation Inspection

### Framing / Shell

1. Framing
2. Roof Tie-In
3. Exterior Sheathing
4. Windows / Doors
5. Weatherproofing
6. Roofing

### MEP / Inspections

1. Plumbing Rough-In
2. Electrical Rough-In
3. HVAC Rough-In
4. Rough Inspections

### Interior / Exterior Finish

1. Insulation
2. Drywall
3. Exterior Finish
4. Flooring
5. Trim
6. Paint
7. Fixtures
8. Final Touchups

### Closeout

1. Final Inspection
2. Client Walkthrough
3. Punch List
4. Punch Completion
5. Final Payment
6. Warranty Info
7. Project Closed

---

# Template 7 — New Home Build

## Best For

Full custom homes, ground-up construction, new residential builds, and large-scale residential projects.

## Suggested Phases and Tasks

### Sales / Pre-Construction

1. Lead / Project Created
2. Initial Consultation
3. Site Visit
4. Budget / Scope Review
5. Proposal Approved
6. Contract Signed
7. Deposit Paid

### Design / Engineering

1. Design Kickoff
2. Concept Plans
3. Client Design Review
4. Construction Drawings
5. Engineering
6. Final Plan Approval

### Permitting

1. Permit Package Prepared
2. Permit Submitted
3. Permit Corrections
4. Permit Approved

### Procurement / Scheduling

1. Long Lead Items Identified
2. Project Schedule Created
3. Subcontractors Assigned
4. Materials Ordered

### Site Preparation

1. Site Clearing
2. Survey / Layout
3. Temporary Utilities
4. Excavation

### Foundation

1. Footings
2. Underground Plumbing
3. Slab / Foundation
4. Foundation Inspection

### Framing / Shell

1. Framing
2. Roof Framing
3. Sheathing
4. Windows / Doors
5. Roofing
6. Exterior Weatherproofing

### MEP

1. Plumbing Rough-In
2. Electrical Rough-In
3. HVAC Rough-In
4. Low Voltage Rough-In
5. Rough Inspections

### Interior Buildout

1. Insulation
2. Drywall
3. Interior Paint
4. Flooring
5. Cabinets
6. Countertops
7. Tile
8. Trim / Doors
9. Fixtures / Appliances

### Exterior / Landscape

1. Stucco / Siding / Exterior Finish
2. Driveway / Flatwork
3. Landscape
4. Irrigation
5. Exterior Cleanup

### Final / Closeout

1. Final Inspections
2. Certificate / Approval if Applicable
3. Internal Quality Control
4. Client Walkthrough
5. Punch List
6. Punch Completion
7. Final Payment
8. Warranty Package
9. Project Closed

---

# Template 8 — Landscape / Backyard Project

## Best For

Backyards, patios, outdoor kitchens, turf, pavers, irrigation, landscape lighting, pergolas, fire pits, and pool-adjacent work.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Site Visit
3. Yard Measurements
4. Design Goals Confirmed
5. Estimate Created
6. Proposal Approved

### Contract / Deposit

1. Contract Signed
2. Deposit Paid
3. Start Date Confirmed

### Design / Planning

1. Backyard Layout
2. Material Selections
3. Plant / Turf Selection
4. Lighting Plan
5. Irrigation Plan
6. Client Approval

### Procurement

1. Materials Ordered
2. Pavers / Stone Ordered
3. Plants / Turf Ordered
4. Lighting / Fixtures Ordered

### Site Preparation

1. Site Clearing
2. Demo / Removal
3. Grading
4. Utility / Irrigation Layout

### Installation

1. Hardscape Prep
2. Paver / Concrete Installation
3. Patio / Pergola Installation
4. Outdoor Kitchen / Fire Feature if Applicable
5. Irrigation Installation
6. Turf / Plant Installation
7. Landscape Lighting
8. Final Grading

### Closeout

1. Site Cleanup
2. System Testing
3. Client Walkthrough
4. Punch List
5. Punch Completion
6. Care Instructions Sent
7. Final Payment
8. Project Closed

---

# Template 9 — Exterior / Facade Remodel

## Best For

Exterior remodels, siding, stucco, paint, entry updates, windows, doors, exterior trim, and curb appeal upgrades.

## Suggested Phases and Tasks

### Sales / Proposal

1. Lead / Project Created
2. Site Visit
3. Exterior Photos / Measurements
4. Scope Drafted
5. Estimate Sent
6. Proposal Approved

### Contract / Deposit

1. Contract Signed
2. Deposit Paid
3. Start Date Confirmed

### Design / Selections

1. Exterior Style Direction
2. Paint / Finish Colors
3. Window / Door Selections
4. Lighting / Hardware Selections
5. Client Approval

### Procurement

1. Exterior Materials Ordered
2. Windows / Doors Ordered
3. Fixtures Ordered

### Construction

1. Site Protection
2. Demo / Removal
3. Framing / Repair if Needed
4. Window / Door Installation
5. Siding / Stucco / Exterior Finish
6. Trim / Detail Work
7. Exterior Paint
8. Lighting / Hardware Installation

### Closeout

1. Final Inspection
2. Internal Quality Control
3. Client Walkthrough
4. Punch List
5. Punch Completion
6. Final Payment
7. Project Closed

---

# Template 10 — Small Handyman / Service Project

## Best For

Small repairs, short projects, maintenance, punch work, small installs, and one-day service jobs.

## Suggested Phases and Tasks

### Intake

1. Service Request Created
2. Photos / Details Received
3. Scope Confirmed
4. Estimate Sent
5. Estimate Approved

### Scheduling

1. Payment / Deposit Confirmed if Needed
2. Technician Assigned
3. Service Date Scheduled
4. Customer Reminder Sent

### Work

1. Technician En Route
2. Site Arrival
3. Work Started
4. Work Completed
5. Photos Uploaded

### Closeout

1. Customer Review / Approval
2. Final Payment
3. Service Closed

---

# Universal Construction Milestones

These milestones can be added to any template when applicable:

- Lead Created
- Site Visit Complete
- Proposal Sent
- Proposal Approved
- Contract Signed
- Deposit Paid
- Design Approved
- Permit Submitted
- Permit Approved
- Materials Ordered
- Construction Start
- Rough Inspection Passed
- Final Inspection Passed
- Client Walkthrough Complete
- Punch List Complete
- Final Payment Received
- Warranty Info Sent
- Project Closed

---

# Universal Punch List Categories

These punch list categories can be used across templates:

- Kitchen
- Bathroom
- Bedroom
- Living Room
- Garage
- Casita
- Exterior
- Landscape
- Entry
- Office
- Mechanical Room
- Flooring
- Cabinets
- Countertops
- Tile
- Paint
- Trim
- Doors
- Windows
- Lighting
- Plumbing
- Electrical
- HVAC
- Appliances
- Cleanup
- Final Touchups

## Punch Item Fields

Each punch item should include:

- project_id
- project_name
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

# Notifications

Templates should support notification triggers.

Suggested triggers:

- Project created
- Task assigned
- Task due soon
- Task overdue
- Task completed
- Task blocked
- Schedule changed
- Client decision needed
- Selection needed
- Permit submitted
- Permit approved
- Inspection scheduled
- Inspection passed
- Punch item added
- Punch item completed
- Client approval requested
- Client approved punch item
- Client reopened punch item
- Final payment due
- Warranty info sent

Notification channels:

- In-app notification
- Email
- SMS in a future phase
- Dashboard alert

---

# Reports / Exports

Future reporting options:

- Project schedule report
- Open task report
- Overdue task report
- Punch list report
- Client-visible timeline export
- Subcontractor task report
- Project closeout report
- Schedule delay report
- Payment milestone report
- Materials procurement report

---

# Codex Implementation Notes

Codex should use this file as planning guidance.

Implementation rules:

1. Inspect the current CMI / project management codebase before editing.
2. Do not duplicate existing project, phase, task, milestone, punch list, user, client, vendor, or subcontractor models if they already exist.
3. Extend the existing architecture where appropriate.
4. Keep project name and project ID associated with every generated task and punch item.
5. Use templates as reusable seed data or database-backed templates.
6. Do not hardcode everything directly into the UI.
7. Allow templates to be edited by Super Admin in a future phase.
8. Generated tasks should remain editable after template application.
9. Generated punch items should remain editable after template application.
10. Customer visibility should be set per generated item.
11. Dragging Gantt items should update dates/times.
12. Minute-level dragging should show a tooltip if the current Gantt implementation supports it.
13. Add loading, empty, success, and error states.
14. Preserve current design system and dashboard patterns.
15. Run available checks after implementation.

---

# Suggested Future Template Data Model

## project_templates

Suggested fields:

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

## project_template_items

Suggested fields:

- id
- project_template_id
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
- blocks_schedule
- requires_client_approval
- requires_payment
- dependency_key
- dependency_type
- display_order
- created_at
- updated_at

## project_template_punch_areas

Suggested fields:

- id
- project_template_id
- room_area_name
- display_order
- created_at
- updated_at

## project_template_punch_items

Suggested fields:

- id
- project_template_id
- room_area_name
- punch_title
- punch_description
- default_priority
- client_visible
- client_approval_required
- display_order
- created_at
- updated_at

---

# Success Criteria

This template system is successful when:

- Staff can select a construction project template when creating a project.
- The system generates phases, tasks, milestones, and punch list areas.
- Every generated task is associated with the correct project name and project ID.
- Every punch item is associated with the correct project name and project ID.
- Tasks appear on the Gantt timeline in the correct order.
- Staff can drag timeline items left/right and save schedule changes.
- Staff can see tooltip time/minute adjustments while dragging where supported.
- Client visibility defaults are respected.
- Notifications can be triggered from generated tasks and milestones.
- Templates can later become editable by Super Admin.
