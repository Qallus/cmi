# Constructed Matter, Inc. Lead Generation Profile Builder

## Claude Code Implementation Prompt

You are working inside the existing Constructed Matter, Inc. web app codebase.

Create a new lead generation feature called **Lead Generation Profile Builder**. This feature allows CMI staff/admin users to define what type of leads they want to capture, configure the form fields for that lead profile, save reusable lead capture profiles, and use those profiles to generate public or internal lead intake forms.

This feature should be implemented as a structured web app tool, not just a static form.

---

## Primary Goal

Build a **Lead Generation Profile Builder** that lets CMI define lead capture profiles for different project types, campaigns, landing pages, referral sources, and sales workflows.

A lead generation profile should define:

- The type of lead CMI wants to capture
- The form fields required for that lead type
- Which fields are public-facing
- Which fields are internal/admin-only
- Field labels, options, required status, placeholders, and helper text
- Lead scoring rules
- Routing rules
- Follow-up preferences
- Associated campaign, source, or landing page
- Whether the form should support file uploads
- Whether the lead should trigger notifications, tasks, or booking workflows

---

## Suggested File Location

If project documentation exists, add this spec or related implementation notes at:

`docs/features/lead_generation_profile.md`

If the project uses a different docs convention, follow the existing convention.

---

## Feature Name

Use the feature name:

**Lead Generation Profile Builder**

Suggested route names, depending on current routing conventions:

- `/dashboard/lead-generation`
- `/dashboard/leads/profiles`
- `/admin/lead-generation/profiles`
- `/staff/lead-generation/profiles`

Follow the existing CMI dashboard route conventions.

---

## User Roles and Access

This feature should be available to CMI staff/admin users only.

Use the existing CMI role and permission system.

Recommended access:

- Super Admin: full access
- Admin: full access
- Staff / Project Manager: view and manage leads if existing permissions allow
- Client / Customer: no access
- Public user: can only submit public lead forms, not manage profiles

Before adding new permission logic, inspect the codebase for existing:

- Role utilities
- Middleware
- Route guards
- Dashboard layout permissions
- Supabase RLS policies, if applicable
- Existing staff/admin route protection

---

## Core Concept

A **Lead Generation Profile** is a reusable configuration for a lead capture form.

Examples:

- ADU / Casita Lead Profile
- Kitchen Remodel Lead Profile
- Bathroom Remodel Lead Profile
- New Home Build Lead Profile
- Commercial Tenant Improvement Lead Profile
- Investor Project Lead Profile
- Realtor Referral Lead Profile
- Vendor / Subcontractor Lead Profile
- General Website Inquiry Profile

Each profile should allow CMI to define the fields they want to capture for that lead type.

---

## Lead Generation Profile Fields

Create a profile setup form with the following fields.

### Profile Name

Field type: Text  
Field key: `profile_name`  
Required: Yes

Examples:

- ADU / Casita Lead Form
- Kitchen Remodel Lead Form
- New Home Build Lead Form
- Realtor Referral Intake

---

### Profile Slug

Field type: Text / Auto-generated slug  
Field key: `profile_slug`  
Required: Yes

Example:

- `adu-casita-lead-form`
- `kitchen-remodel-lead-form`

The slug should be used for URLs, internal references, and form embeds where applicable.

---

### Lead Type

Field type: Select  
Field key: `lead_type`  
Required: Yes

Options:

- New Home Build
- Home Remodel
- Kitchen Remodel
- Bathroom Remodel
- Home Addition
- ADU / Casita
- Garage Conversion
- Outdoor Living / Backyard Remodel
- Commercial Build-Out
- Tenant Improvement
- Design-Build Inquiry
- Architecture / Planning Inquiry
- Permit / Pre-Construction Inquiry
- Project Consultation
- Real Estate Investor Project
- Realtor Referral
- Designer / Architect Referral
- Vendor / Subcontractor Lead
- Partner / Collaboration Lead
- General Inquiry
- Other

---

### Profile Purpose

Field type: Long Text  
Field key: `profile_purpose`  
Required: No

Use this to explain what this lead profile is meant to capture.

Example:

`Capture qualified ADU / Casita leads from the ADU landing page and collect enough project details for the CMI team to determine budget, timeline, property status, and consultation readiness.`

---

### Associated Campaign

Field type: Text or Select  
Field key: `associated_campaign`  
Required: No

Examples:

- ADU Landing Page
- Kitchen Remodel Campaign
- Google Ads - Remodel Leads
- Realtor Partner Referrals
- Website Contact Form

---

### Associated Page URL

Field type: URL  
Field key: `associated_page_url`  
Required: No

Use this to connect a lead profile to a landing page, service page, campaign page, or public intake form.

---

### Lead Source Category

Field type: Select  
Field key: `lead_source_category`  
Required: No

Options:

- Website
- Landing Page
- Google Search
- Google Ads
- Social Media
- Facebook
- Instagram
- LinkedIn
- Referral
- Realtor
- Designer / Architect
- Vendor / Subcontractor
- Email Campaign
- Event
- Existing Client
- Partner
- Manual Entry
- Other

---

### Profile Status

Field type: Select  
Field key: `profile_status`  
Required: Yes  
Default: Draft

Options:

- Draft
- Active
- Paused
- Archived

---

## Public Lead Form Fields

The Lead Generation Profile Builder should allow the admin to enable, disable, reorder, and configure the following public form fields.

Each configurable field should support:

- Field label
- Field key
- Field type
- Required status
- Placeholder
- Helper text
- Visibility
- Display order
- Default value, if applicable
- Options, if applicable

---

## Recommended Public Fields

### First Name

Field type: Text  
Field key: `first_name`  
Required: Yes

### Last Name

Field type: Text  
Field key: `last_name`  
Required: Yes

### Email Address

Field type: Email  
Field key: `email`  
Required: Yes

### Phone Number

Field type: Phone  
Field key: `phone`  
Required: Yes

### Preferred Contact Method

Field type: Select  
Field key: `preferred_contact_method`  
Required: No

Options:

- Phone
- Text Message
- Email
- Web App Message
- No Preference

### Best Time to Contact

Field type: Select  
Field key: `best_time_to_contact`  
Required: No

Options:

- Morning
- Afternoon
- Evening
- Anytime

### Project Type

Field type: Select  
Field key: `project_type`  
Required: Yes

Options:

- New Construction
- Remodel
- Addition
- ADU / Casita
- Interior Renovation
- Exterior Renovation
- Outdoor Living
- Commercial
- Other

### Project Address

Field type: Address  
Field key: `project_address`  
Required: No

Subfields:

- Street Address
- City
- State
- ZIP Code

### Property Use

Field type: Select  
Field key: `property_use`  
Required: No

Options:

- Primary Residence
- Second Home
- Investment Property
- Rental Property
- Commercial Property
- Not Sure Yet

### Current Property Status

Field type: Select  
Field key: `property_status`  
Required: No

Options:

- I Own the Property
- I Am Under Contract
- I Am Looking for a Property
- I Represent the Property Owner
- I Am a Realtor / Investor
- Other

### Project Description

Field type: Long Text  
Field key: `project_description`  
Required: Yes

Placeholder:

`Tell us what you are looking to build, remodel, add, or improve.`

### Estimated Budget

Field type: Select  
Field key: `estimated_budget`  
Required: Yes

Options:

- Under $25,000
- $25,000 - $50,000
- $50,000 - $100,000
- $100,000 - $250,000
- $250,000 - $500,000
- $500,000 - $1,000,000
- $1,000,000+
- Not Sure Yet

### Desired Start Timeline

Field type: Select  
Field key: `desired_start_timeline`  
Required: Yes

Options:

- Immediately
- Within 30 Days
- 1-3 Months
- 3-6 Months
- 6-12 Months
- 12+ Months
- Just Researching

### Project Urgency

Field type: Select  
Field key: `project_urgency`  
Required: No

Options:

- Low
- Medium
- High
- Urgent

### Project Stage

Field type: Select  
Field key: `project_stage`  
Required: Yes

Options:

- Just Exploring Ideas
- Gathering Quotes
- Have Plans / Drawings
- Need Design Help
- Need Permits
- Ready to Start
- Already Started
- Need Contractor Support
- Other

### Has Plans or Drawings

Field type: Select  
Field key: `has_plans`  
Required: No

Options:

- Yes
- No
- In Progress
- Need Help Creating Plans

### Needs Design Services

Field type: Select  
Field key: `needs_design_services`  
Required: No

Options:

- Yes
- No
- Maybe
- Already Have a Designer / Architect

### Needs Permit Help

Field type: Select  
Field key: `needs_permit_help`  
Required: No

Options:

- Yes
- No
- Not Sure
- Permits Already Submitted
- Permits Already Approved

### Decision Maker Status

Field type: Select  
Field key: `decision_maker_status`  
Required: No

Options:

- I Am the Decision Maker
- I Am One of the Decision Makers
- I Am Gathering Information for Someone Else
- I Am a Realtor / Representative
- Other

### Lead Source

Field type: Select  
Field key: `lead_source`  
Required: Yes

Options:

- Google Search
- Google Ads
- Social Media
- Facebook
- Instagram
- LinkedIn
- Referral
- Realtor
- Designer / Architect
- Vendor / Subcontractor
- Email
- Event
- Existing Client
- Website
- Other

### Referral Name

Field type: Text  
Field key: `referral_name`  
Required: Conditional

Show this field when `lead_source` equals:

- Referral
- Realtor
- Designer / Architect
- Vendor / Subcontractor
- Existing Client
- Other

### Upload Photos, Plans, or Inspiration Images

Field type: File Upload  
Field key: `project_files`  
Required: No

Allowed file types:

- JPG
- JPEG
- PNG
- PDF
- DOC
- DOCX
- HEIC
- WEBP

Recommended max uploads:

- 10 files

### Uploaded File Types

Field type: Checkbox Group  
Field key: `uploaded_file_types`  
Required: No

Options:

- Property Photos
- Existing Condition Photos
- Floor Plans
- Architectural Drawings
- Inspiration Images
- Permit Documents
- Scope of Work
- Other

### Wants Consultation

Field type: Select  
Field key: `wants_consultation`  
Required: No

Options:

- Yes
- No
- Maybe Later

### Preferred Consultation Type

Field type: Select  
Field key: `consultation_type`  
Required: Conditional

Options:

- Phone Call
- Video Call
- In-Person Meeting
- On-Site Visit
- Not Sure

### Preferred Meeting Location

Field type: Select  
Field key: `meeting_location_preference`  
Required: Conditional

Options:

- At the Property
- At the CMI Office
- Video Meeting
- Phone Call
- No Preference

---

## Internal Lead Management Fields

These fields should not be shown on the public form. They should be visible only to authorized CMI staff/admin users.

### Lead Status

Field type: Select  
Field key: `lead_status`  
Default: New

Options:

- New
- Contacted
- Qualified
- Needs Follow-Up
- Consultation Scheduled
- Estimate Requested
- Proposal Sent
- Won
- Lost
- Archived

### Lead Priority

Field type: Select  
Field key: `lead_priority`

Options:

- Low
- Medium
- High
- Urgent

### Assigned Team Member

Field type: User Select  
Field key: `assigned_to`

### Lead Score

Field type: Number  
Field key: `lead_score`

### Internal Notes

Field type: Long Text  
Field key: `internal_notes`

### Next Follow-Up Date

Field type: Date  
Field key: `next_follow_up_date`

### Follow-Up Task Created

Field type: Boolean  
Field key: `follow_up_task_created`

---

## Lead Scoring Rules

Create a basic lead scoring system that can be adjusted later.

Suggested default scoring:

- Budget over $100,000: +20
- Ready within 3 months: +20
- Owns the property: +15
- Has plans or drawings: +15
- Wants consultation: +10
- Referred by client, partner, realtor, designer, or architect: +10
- Uploaded files: +10
- Decision maker confirmed: +10
- Needs design-build services: +10
- Timeline is 12+ months or just researching: -10
- Budget is under $25,000: -10

Lead score categories:

- 0-25: Low Fit
- 26-50: Warm Lead
- 51-75: Qualified Lead
- 76-100+: High Priority Lead

---

## Routing and Notifications

Add a structure for routing leads based on profile, lead type, source, or score.

Routing fields:

- Assigned team member
- Notification recipients
- Notification method
- Create follow-up task
- Create consultation booking link
- Send autoresponder email
- Send internal Slack/message notification, if available

Notification methods:

- Email
- SMS
- In-app notification
- Slack or team message, if already supported

Do not add a new third-party integration unless the project already supports it. Create a clean placeholder/adapter if needed.

---

## Data Model Recommendations

Follow the existing CMI database, ORM, and Supabase conventions if present.

If new tables are needed, recommend or create the following.

### lead_generation_profiles

Fields:

- id
- profile_name
- profile_slug
- lead_type
- profile_purpose
- associated_campaign
- associated_page_url
- lead_source_category
- profile_status
- created_by
- created_at
- updated_at

### lead_generation_profile_fields

Fields:

- id
- profile_id
- field_key
- field_label
- field_type
- required
- visible_publicly
- internal_only
- placeholder
- helper_text
- default_value
- options_json
- conditional_logic_json
- display_order
- created_at
- updated_at

### lead_generation_submissions

Fields:

- id
- profile_id
- lead_type
- first_name
- last_name
- email
- phone
- project_type
- project_address_json
- project_description
- estimated_budget
- desired_start_timeline
- project_stage
- lead_source
- lead_score
- lead_status
- lead_priority
- assigned_to
- submitted_data_json
- created_at
- updated_at

### lead_generation_files

Fields:

- id
- submission_id
- profile_id
- file_url
- file_name
- file_type
- file_size
- uploaded_by
- created_at

### lead_generation_routing_rules

Fields:

- id
- profile_id
- rule_name
- lead_type
- lead_source
- min_score
- max_score
- assigned_to
- notification_recipients_json
- create_task
- send_autoresponder
- booking_link
- active
- created_at
- updated_at

---

## First Version Requirements

For the first stable version, implement:

1. Lead Generation Profile list view
2. Create Lead Generation Profile screen
3. Edit Lead Generation Profile screen
4. Configurable public form fields
5. Internal-only lead management fields
6. Basic lead submission storage
7. Basic lead score calculation
8. Public or shareable form route for active profiles
9. Staff/admin lead submission detail view
10. Basic file upload support if storage is already available
11. Route protection for all admin/staff screens
12. Clean empty, loading, and error states

---

## Recommended First Build Core Fields

The default profile template should include these fields:

- Lead Type
- First Name
- Last Name
- Email Address
- Phone Number
- Preferred Contact Method
- Project Type
- Project Address
- Project Description
- Estimated Budget
- Desired Start Timeline
- Project Stage
- Has Plans or Drawings
- Lead Source
- Upload Files
- Wants Consultation

Internal fields:

- Lead Status
- Lead Priority
- Assigned Team Member
- Lead Score
- Internal Notes
- Next Follow-Up Date

---

## UI Requirements

Use the existing CMI dashboard style and component system.

The UI should feel like a dashboard tool, not a plain contact form.

Recommended screens:

### Lead Generation Profiles Index

Show:

- Profile name
- Lead type
- Status
- Associated campaign
- Associated page URL
- Total submissions
- Last submission date
- Actions: View, Edit, Duplicate, Archive

### Create / Edit Profile Screen

Use sections or tabs:

- Profile Details
- Public Form Fields
- Internal Fields
- Lead Scoring
- Routing & Notifications
- Preview

### Form Builder Area

Allow staff/admin users to:

- Enable or disable fields
- Mark fields required
- Reorder fields
- Edit labels
- Edit placeholders
- Edit helper text
- Configure select/checkbox options
- Mark fields as internal-only

### Preview Area

Show a live preview of the lead form based on the selected fields.

---

## Do Not Break

Do not break:

- Existing CMI dashboard routes
- Existing user/client dashboard routes
- Existing project management tools
- Existing booking workflows
- Existing messaging/notification workflows
- Existing staff/admin role protection
- Existing Supabase/Auth setup
- Existing file storage setup

---

## Acceptance Criteria

The feature is complete when:

- Authorized staff/admin users can create a lead generation profile
- A lead profile can define lead type, campaign, source, and public form fields
- Public form fields can be enabled, disabled, reordered, and marked required
- A profile can be saved as Draft, Active, Paused, or Archived
- Active profiles can generate a public/shareable intake form
- Public users can submit the active form
- Submissions are saved with the selected profile
- Internal users can view submissions
- Basic lead scoring is calculated
- Internal-only fields are never shown on the public form
- Admin routes are protected
- Public submission routes do not expose private/admin data

---

## Initial Claude Code Task

Start by reviewing the current CMI dashboard structure, routing conventions, auth/role utilities, Supabase/database patterns, and existing form or booking components.

Then implement the first stable version of the **Lead Generation Profile Builder** using the existing design system and code patterns.

Prioritize the profile builder, public form generation, submission storage, lead scoring, and admin submission view.
