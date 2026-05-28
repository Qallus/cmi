# Constructed Matter, Inc. — Product Selection Management

## File Purpose

This document is the source-of-truth planning file for adding a Product Selection Management feature to the Constructed Matter, Inc. dashboard / web app.

Recommended location:

`/docs/product-selection.md`

The goal is to create a Buildertrend-inspired selections system that allows CMI staff, designers, clients, vendors, and subcontractors to manage project selections, products, materials, finishes, approvals, budgets, quotes, SOW items, contracts, invoices, billing, tasks, and project schedules in one connected workflow.

This system should allow users to add products, organize selections by project and room/area, request client approvals, connect products to vendors and subcontractors, and track how selected items impact cost, scope, timeline, procurement, and billing.

---

# Feature Overview

The Product Selection Management feature should help Constructed Matter manage all project-related product selections and material decisions.

Examples include:

- Cabinets
- Countertops
- Tile
- Flooring
- Appliances
- Plumbing fixtures
- Lighting fixtures
- Paint colors
- Hardware
- Doors
- Windows
- Trim
- Bathroom fixtures
- Kitchen fixtures
- Exterior finishes
- Landscape materials
- Specialty materials
- Custom products
- Client-provided products
- Vendor-provided products
- Subcontractor-specified products

The experience should feel similar to a modern construction management platform like Buildertrend, but customized for Constructed Matter’s dashboard, project workflow, client communication style, and long-term construction management software goals.

---

# Primary Goals

The Product Selection feature should allow CMI to:

- Add products and selections to a project.
- Organize selections by project, room, area, phase, category, vendor, subcontractor, designer, and status.
- Connect product selections to clients, designers, vendors, subcontractors, tasks, quotes, SOWs, contracts, invoices, billing, and project schedules.
- Track client selection decisions and approvals.
- Track budgeted cost vs. actual cost.
- Track allowances and overages.
- Track vendor pricing and procurement status.
- Track product lead times and delivery dates.
- Track product installation requirements.
- Give clients a clean selection approval experience.
- Give staff an internal management view.
- Give vendors/subcontractors the relevant product details needed for procurement or installation.
- Create a scalable foundation for future Buildertrend-style selections, proposals, change orders, and client dashboard features.

---

# Recommended Dashboard Placement

Add this feature as a first-class project management module.

Suggested sidebar label:

`Selections`

Alternative labels:

- Product Selections
- Materials
- Products
- Specifications
- Selections / Specs

Preferred label:

`Selections`

Suggested dashboard navigation area:

```text
Dashboard
Projects
Project Management
Gantt Timeline
Tasks
Punch List
Selections
Bookings
Clients
Users
Reports
Settings
```

Within a single project, add a project-specific Selections tab:

```text
Project Overview
Timeline
Tasks
Punch List
Selections
Files
Schedule Updates
Client View
Billing
```

---

# Core Concept

A Selection is a project-specific product, material, finish, fixture, appliance, or decision item.

A Product is the reusable product record that may be selected, quoted, ordered, installed, billed, or connected to a vendor/subcontractor.

A Selection can reference a Product, but a Selection should also allow custom one-off entries when the product is not already in the catalog.

Example:

```text
Project: Scottsdale Kitchen Remodel
Room/Area: Kitchen
Category: Countertops
Selection: Quartz Countertop
Product: MSI Calacatta Laza Quartz
Vendor: Arizona Tile
Subcontractor: Countertop Installer
Client Approval: Approved
Budget Allowance: $5,000
Actual Cost: $6,250
Over/Under: +$1,250
Connected Task: Countertop Template / Countertop Installation
Connected Invoice: Progress Invoice #3
```

---

# User Roles

## Super Admin

Can view all selections, create/edit/delete selections, add products, manage the product catalog, assign vendors/subcontractors, approve internal selection records, override client approvals if needed, connect selections to quotes/SOWs/contracts/invoices/billing, and manage selection templates/categories.

## Admin

Can view and manage selections, add products, assign selections to projects, request client approvals, connect selections to vendors/subcontractors, and manage selection statuses.

## Project Manager

Can manage selections for assigned projects, assign selections to rooms/areas, link selections to tasks and schedule items, track procurement and delivery, request client approvals, update selection status, and add internal notes.

## Designer

Can add design-related selections, upload product images/spec sheets, recommend products, add design notes, request client approval, and mark selections as designer-approved.

## Client

Can view client-visible selections, review product options, approve or reject selections, add comments, upload inspiration images if allowed, and view allowance/overage information if enabled.

## Vendor

Can view assigned product/procurement items, add pricing if allowed, confirm availability, confirm lead times, upload product documents, and add delivery status updates.

## Subcontractor

Can view assigned install-related selections, view specifications needed for installation, upload completion photos, add install notes, and confirm install readiness.

---

# Product Selection Pages

## 1. Selections Overview

A high-level page showing all selections across active projects.

Overview cards:

- Total Selections
- Pending Client Approval
- Approved Selections
- Rejected / Needs Revision
- Over Budget
- Ordered Products
- Delivered Products
- Installed Products

Filters:

- Project
- Client
- Category
- Room/Area
- Status
- Vendor
- Subcontractor
- Designer
- Approval Status
- Procurement Status
- Budget Status

## 2. Project Selections Page

A project-specific selections page.

Should include:

- Project name
- Client name
- Selection categories
- Room/area grouping
- Product cards/table
- Approval status
- Budget allowance
- Actual cost
- Vendor
- Subcontractor
- Lead time
- Delivery status
- Install status

Suggested view modes:

- Card View
- Table View
- Room/Area View
- Category View
- Client Approval View
- Budget View

## 3. Product Catalog

A reusable product catalog that can be used across projects.

Catalog fields:

- Product name
- Product category
- Product type
- Brand/manufacturer
- SKU/model number
- Vendor
- Description
- Product image
- Spec sheet
- Website URL
- Unit cost
- Retail price
- Markup
- Lead time
- Availability status
- Installation notes
- Warranty information
- Internal notes

## 4. Add Product / Add Selection

The system should allow staff to either:

1. Add a new product to the catalog.
2. Add an existing product as a selection to a project.
3. Add a one-off custom selection without creating a catalog product.

Required selection fields:

- Project
- Project Name
- Client
- Room / Area
- Category
- Selection Name
- Product Name
- Product Description
- Product Image
- Vendor
- Subcontractor
- Designer
- Selection Status
- Approval Status
- Budget Allowance
- Estimated Cost
- Actual Cost
- Quantity
- Unit
- Lead Time
- Target Decision Date
- Target Order Date
- Target Delivery Date
- Target Install Date
- Client Visible Toggle
- Internal Notes

## 5. Selection Detail Drawer / Page

Each selection should have a detailed view.

Sections:

- Selection Overview
- Product Details
- Images / Documents
- Budget / Allowance
- Approval Status
- Vendor / Subcontractor
- Procurement
- Installation
- Related Tasks
- Related Quote / SOW / Contract
- Related Invoice / Billing
- Comments / Notes
- Activity History

Actions:

- Edit Selection
- Request Client Approval
- Approve Internally
- Mark Client Approved
- Mark Rejected / Needs Revision
- Add Product Document
- Link Vendor
- Link Subcontractor
- Link Task
- Link Quote
- Link SOW
- Link Contract
- Link Invoice
- Mark Ordered
- Mark Delivered
- Mark Installed
- Create Change Order if Over Budget

---

# Selection Statuses

Recommended statuses:

- Draft
- Needs Review
- Pending Client Approval
- Client Approved
- Rejected / Needs Revision
- Approved Internally
- Ordered
- Backordered
- Delivered
- Installed
- Canceled
- Replaced
- Completed

# Approval Statuses

Recommended approval statuses:

- Not Required
- Pending
- Approved
- Rejected
- Revision Requested
- Approved with Changes

# Procurement Statuses

Recommended procurement statuses:

- Not Ordered
- Quote Requested
- Quote Received
- Ready to Order
- Ordered
- Backordered
- Partially Delivered
- Delivered
- Canceled

# Install Statuses

Recommended install statuses:

- Not Ready
- Ready for Install
- Scheduled
- In Progress
- Installed
- Needs Correction
- Completed

---

# Product Categories

Suggested categories:

- Cabinets
- Countertops
- Tile
- Flooring
- Appliances
- Plumbing Fixtures
- Lighting Fixtures
- Hardware
- Paint
- Doors
- Windows
- Trim / Millwork
- Roofing
- Exterior Finish
- Landscape
- Outdoor Living
- Bathroom Fixtures
- Kitchen Fixtures
- Specialty Materials
- Custom Fabrication
- Client-Provided Product
- Vendor-Provided Product
- Other

---

# Room / Area Grouping

Selections should be groupable by room/area.

Suggested areas:

- Kitchen
- Primary Bathroom
- Guest Bathroom
- Powder Room
- Bedroom
- Living Room
- Dining Room
- Office
- Laundry Room
- Garage
- Casita
- Exterior
- Patio
- Backyard
- Front Yard
- Entry
- Mechanical Room
- Whole Home

---

# Connections to Other Modules

## Projects

Every selection should be connected to a project.

Required project fields:

- project_id
- project_name
- client_id
- project_manager_id

## Tasks

Selections should be connectable to project tasks.

Examples:

- Cabinet Installation
- Countertop Template
- Countertop Installation
- Tile Installation
- Appliance Installation
- Plumbing Fixture Installation
- Lighting Installation
- Paint Touchups

If a selected product is delayed, the related task should be visible as potentially impacted.

## Gantt Timeline

Selections should be able to appear on the Gantt timeline when relevant.

Examples:

- Client Selection Deadline
- Product Order Deadline
- Product Delivery Date
- Product Install Date
- Backorder Delay
- Substitution Approval

## Vendors

Selections should connect to vendors.

Vendor fields:

- vendor_id
- vendor_name
- vendor_contact_name
- vendor_email
- vendor_phone
- vendor_quote_number
- vendor_lead_time
- vendor_order_status

## Subcontractors

Selections should connect to subcontractors when they are responsible for installation or review.

Subcontractor fields:

- subcontractor_id
- subcontractor_name
- subcontractor_contact_name
- install_notes
- install_status
- scheduled_install_date

## Designers

Selections should connect to designers when they are responsible for recommendations, product selection, or client approval workflows.

Designer fields:

- designer_user_id
- designer_notes
- designer_approval_status

## Clients

Selections should connect to clients for approval and review.

Client fields:

- client_id
- client_visible
- client_approval_required
- client_approval_status
- client_approved_at
- client_rejected_at
- client_comments

## Quotes

Selections should connect to quotes when pricing is estimated or proposed.

Quote fields:

- quote_id
- quote_line_item_id
- quoted_price
- quoted_quantity
- quote_status

## SOW

Selections should connect to the Statement of Work when the selection is included in scope.

SOW fields:

- sow_id
- sow_section_id
- included_in_scope
- scope_notes

## Contracts

Selections should connect to contracts when they are part of signed terms or allowances.

Contract fields:

- contract_id
- contract_allowance_id
- included_in_contract
- contract_notes

## Invoices / Billing

Selections should connect to invoices and billing.

Invoice/billing fields:

- invoice_id
- invoice_line_item_id
- billable
- billing_status
- allowance_amount
- estimated_cost
- actual_cost
- client_price
- over_under_amount
- markup_amount
- tax_amount
- total_amount

If actual cost exceeds allowance, the system should support future change order creation.

---

# Buildertrend-Inspired Client Selection Workflow

A typical selection workflow should look like:

1. Staff/designer adds product selection to project.
2. Selection is assigned to room/area and category.
3. Selection is marked client-visible.
4. Client receives notification to review selection.
5. Client opens client-facing selection page.
6. Client reviews product details, images, specs, cost/allowance info if enabled.
7. Client approves, rejects, or requests revision.
8. Staff receives notification.
9. If approved, selection moves to Ready to Order.
10. Vendor quote/order is created or linked.
11. Product is ordered.
12. Delivery status is tracked.
13. Install task is scheduled.
14. Product is installed.
15. Selection is marked complete.
16. Any budget overage can be connected to change order, invoice, or billing.

---

# Notifications

Selection notification triggers:

- Selection created
- Selection assigned to designer
- Selection assigned to vendor
- Selection assigned to subcontractor
- Client approval requested
- Client approved selection
- Client rejected selection
- Revision requested
- Vendor quote requested
- Vendor quote received
- Product ordered
- Product backordered
- Product delivered
- Product install scheduled
- Product installed
- Product over budget
- Product linked to invoice
- Change order needed

Notification channels:

- In-app notification
- Email
- SMS in future phase
- Dashboard alert

---

# Suggested Data Model

Codex should adapt these to the existing app architecture and database conventions.

## products

Purpose:

Reusable product catalog.

Fields:

- id
- product_name
- product_slug
- category
- product_type
- brand
- manufacturer
- sku
- model_number
- vendor_id
- description
- image_url
- spec_sheet_url
- product_url
- unit_cost
- retail_price
- markup_percent
- lead_time_days
- availability_status
- warranty_info
- install_notes
- internal_notes
- created_at
- updated_at

## project_selections

Purpose:

Project-specific selection records.

Fields:

- id
- project_id
- project_name
- client_id
- room_area_id
- room_area_name
- category
- selection_name
- product_id
- custom_product_name
- description
- image_url
- spec_sheet_url
- vendor_id
- subcontractor_id
- designer_user_id
- related_task_id
- quote_id
- quote_line_item_id
- sow_id
- sow_section_id
- contract_id
- contract_allowance_id
- invoice_id
- invoice_line_item_id
- selection_status
- approval_status
- procurement_status
- install_status
- client_visible
- client_approval_required
- client_approved_at
- client_rejected_at
- client_comments
- quantity
- unit
- allowance_amount
- estimated_cost
- actual_cost
- client_price
- over_under_amount
- markup_amount
- tax_amount
- total_amount
- lead_time_days
- target_decision_date
- target_order_date
- target_delivery_date
- target_install_date
- ordered_at
- delivered_at
- installed_at
- internal_notes
- created_by
- created_at
- updated_at

## selection_comments

Purpose:

Stores comments and communication on selections.

Fields:

- id
- selection_id
- user_id
- comment_type
- comment_body
- client_visible
- created_at
- updated_at

## selection_documents

Purpose:

Stores uploaded images, spec sheets, PDFs, quotes, and product documents.

Fields:

- id
- selection_id
- uploaded_by_user_id
- file_name
- file_url
- file_type
- document_type
- client_visible
- created_at

## selection_activity

Purpose:

Tracks selection history.

Fields:

- id
- selection_id
- user_id
- action
- description
- metadata
- created_at

---

# API Routes / Server Actions

Follow the existing app conventions.

Suggested routes:

- GET /api/admin/selections
- GET /api/admin/selections/:id
- POST /api/admin/selections
- PATCH /api/admin/selections/:id
- DELETE /api/admin/selections/:id
- POST /api/admin/selections/:id/request-approval
- POST /api/admin/selections/:id/approve
- POST /api/admin/selections/:id/reject
- POST /api/admin/selections/:id/order
- POST /api/admin/selections/:id/mark-delivered
- POST /api/admin/selections/:id/mark-installed
- POST /api/admin/selections/:id/link-task
- POST /api/admin/selections/:id/link-invoice
- GET /api/admin/products
- POST /api/admin/products
- PATCH /api/admin/products/:id
- DELETE /api/admin/products/:id

Client-facing routes if applicable:

- GET /api/client/selections
- GET /api/client/selections/:id
- POST /api/client/selections/:id/approve
- POST /api/client/selections/:id/reject
- POST /api/client/selections/:id/comment

---

# UI Components

Suggested components:

- SelectionsPage
- ProjectSelectionsPage
- SelectionOverviewCards
- SelectionTable
- SelectionCardGrid
- SelectionFilters
- SelectionStatusBadge
- SelectionApprovalBadge
- SelectionProcurementBadge
- SelectionInstallStatusBadge
- SelectionDrawer
- SelectionForm
- ProductForm
- ProductCatalogPage
- ProductPicker
- RoomAreaSelector
- VendorSelector
- SubcontractorSelector
- DesignerSelector
- ClientApprovalPanel
- SelectionBudgetPanel
- SelectionDocumentsPanel
- SelectionActivityTimeline
- SelectionComments
- RequestApprovalButton
- MarkOrderedButton
- MarkDeliveredButton
- MarkInstalledButton

---

# Phase 1 Scope

Phase 1 should build the foundation.

Include:

- Dashboard navigation entry labeled Selections.
- Project-level Selections tab/page.
- Selection list/table.
- Selection card/grid view if feasible.
- Add/edit selection form.
- Add product option.
- Basic product catalog table/model.
- Project selection table/model.
- Room/area/category fields.
- Vendor/subcontractor/designer/client fields if existing models support them.
- Client visibility toggle.
- Approval status.
- Selection status.
- Procurement status.
- Install status.
- Budget allowance and estimated/actual cost fields.
- Basic document/image URL fields if file handling is not ready.
- Ability to link a selection to a project task if existing task model supports it.
- Loading, empty, success, and error states.

Do not include in Phase 1 unless already simple:

- Full client portal approval UI.
- Full invoice/billing automation.
- Full quote/SOW/contract automation.
- Full change order generation.
- Advanced procurement automation.
- Vendor portal.
- Subcontractor portal.
- Complex reporting.

---

# Phase 2 Ideas

- Client-facing selection approval page.
- Vendor quote request workflow.
- Product procurement workflow.
- Change order creation from over-budget selections.
- Invoice line item generation.
- SOW/contract allowance linking.
- Selection templates by project type.
- Selection deadline integration with Gantt.
- Product delivery date notifications.
- Install schedule integration.
- Vendor/subcontractor dashboard views.
- File uploads for images/spec sheets.
- Product import/export.
- Selection comparison options.
- Client favorites / alternatives.
- Approval signatures.
- Budget overage alerts.
- Reporting and exports.

---

# Codex Instructions

When implementing:

1. Review this file first.
2. Inspect the existing codebase before editing.
3. Reuse existing project, user, client, vendor, subcontractor, task, quote, contract, SOW, invoice, and billing models if they exist.
4. Do not duplicate existing models.
5. Add database migrations instead of editing schema directly.
6. Preserve project relationships.
7. Every selection must be connected to `project_id` and `project_name`.
8. Use existing dashboard UI patterns.
9. Add loading, empty, success, and error states.
10. Protect client/internal visibility.
11. Keep Phase 1 practical and shippable.
12. Run available checks after implementation.

---

# Codex Starter Prompt

Use this prompt after adding this file to the repo:

```text
I added a new planning document for Constructed Matter, Inc.:

- docs/product-selection.md

Please review this document before making any code changes.

The goal is to add a Buildertrend-inspired Product Selection Management feature to the existing CMI dashboard. This should allow staff to add products and selections, connect selections to projects, tasks, clients, designers, vendors, subcontractors, quotes, SOWs, contracts, invoices, and billing.

Before editing, inspect the existing repo structure, dashboard architecture, auth model, user roles, project models, task models, vendor/subcontractor/client models, quote/SOW/contract/invoice/billing models if present, database migrations, API routes/server actions, notification patterns, dashboard UI, and frontend routing.

Do not create a disconnected product system. Extend the existing CMI app and reuse current architecture, database patterns, auth checks, components, and styling wherever possible.

Start by producing a short implementation plan listing:

- files to change
- existing models/tables that can be reused
- new migrations needed
- API routes or server actions needed
- dashboard UI components needed
- project selection page needed
- product catalog approach
- client approval approach
- quote/SOW/contract/invoice/billing connection approach
- risks or incompatibilities
- assumptions about the current repo structure

After the plan, implement Phase 1 only.

Phase 1 should include:

- dashboard navigation entry labeled Selections
- project-level Selections page/tab
- selection list/table
- add/edit selection form
- add product option
- basic product catalog table/model
- project selection table/model
- room/area/category fields
- vendor/subcontractor/designer/client fields if supported
- client visibility toggle
- approval status
- selection status
- procurement status
- install status
- budget allowance and estimated/actual cost fields
- basic document/image URL fields if file handling is not ready
- ability to link a selection to a project task if the existing task model supports it
- loading, empty, success, and error states

Do not implement full client portal approval UI, invoice/billing automation, quote/SOW/contract automation, change order generation, vendor portal, subcontractor portal, or complex reporting in Phase 1 unless the existing repo already makes this simple.

When complete, summarize:

- what was added
- files changed
- migrations created
- routes/actions added
- how to test adding a product
- how to test adding a project selection
- how selections connect to projects/tasks/vendors/subcontractors
- what should be handled in Phase 2
```

---

# Success Criteria

This feature is successful when:

- Staff/admin can access a Selections dashboard page.
- Staff/admin can add products.
- Staff/admin can add selections to a project.
- Every selection is connected to a project name and project ID.
- Selections can be categorized by room/area and product category.
- Selections can track approval, procurement, install, and budget status.
- Selections can connect to vendors, subcontractors, designers, clients, and tasks where supported.
- The system is ready for future quote, SOW, contract, invoice, billing, and client approval workflows.
