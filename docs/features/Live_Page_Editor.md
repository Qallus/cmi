# Live Page Editor Implementation Prompt

You are working inside the existing web app codebase.

We need to implement a **Live Page Editor** inside the Super Admin Dashboard. This feature should connect to the existing CMS / Site Content area and allow Super Admin users to visually review frontend pages, click page elements, add notes, export the notes, and make those notes available to Bolt AI.

The main planning/spec file should be located at:

`docs/cms/live_page_editor.md`

If the existing file is currently named:

`docs/cms/live_page_cms.md`

then review that file first, preserve its useful content, and create or update the new file:

`docs/cms/live_page_editor.md`

Use this document as the primary implementation guide.

---

## Primary Goal

Create the first stable version of the **Live Page Editor** as a Super Admin-only visual page review workflow.

The immediate UI task is:

Add a **Live Page Editor** button or tab inside the **Site Content** area, placed between the existing **Bolt AI** button and the **+ New Page** or **+ New Block** button.

Do not remove, rename, or break the existing Bolt AI workflow, New Page workflow, CMS routes, draft/publish workflow, or Super Admin access protection.

---

## Existing Dashboard Context

The Super Admin Dashboard already has a **Site Content** area with existing CMS actions.

The new CMS editing options should be clearer and should include:

1. Bolt AI
2. Live Page Editor
3. New Page / New Block

The **Live Page Editor** button should match the current dashboard design system and use the same button component system already used in the CMS header/action area.

Suggested button label:

`Live Page Editor`

Suggested icon options:

- Eye
- Monitor
- Layout
- Cursor click
- Panels
- External preview style icon

Use whichever matching icon already exists in the project’s icon library.

---

## Feature Purpose

The **Live Page Editor** is a visual page review and note-taking tool.

It should allow a Super Admin to:

- Select a frontend page
- View the current frontend page visually inside an iframe or safe preview panel
- Toggle desktop, tablet, and mobile preview widths
- Click visible page elements
- Add notes to a section, container, row, column, card, component, or heading
- Save a page review session
- Save notes as an overlay attached to the page and selected elements
- Export notes into a structured PDF or AI-readable document
- Make review notes available to Bolt AI
- Allow Bolt AI to suggest or draft changes based on the notes

This feature is for visual review first.

It must not automatically publish frontend changes.

Bolt AI must not auto-publish changes or make destructive edits. Any AI-generated updates must be saved as drafts for Super Admin review.

---

## Access Control Requirements

This feature must be **Super Admin-only**.

Implement access control using the existing CMI role/permission system.

Requirements:

- Hide the Live Page Editor button from non-Super Admin users.
- Protect the Live Page Editor route.
- Protect all related API routes, server actions, review sessions, notes, exports, and AI-readable documents.
- Do not expose notes, screenshots, exports, or page review data to normal users.
- Reuse existing permission utilities and route guards wherever possible.

Before creating new auth utilities, search the codebase for existing role checks, Super Admin checks, middleware, server actions, layout guards, and CMS permission helpers.

---

## Required Live Page Editor Layout

Create a separate Super Admin-only route for the Live Page Editor.

Follow existing routing conventions.

The layout should include the following areas.

---

### Top Bar

The top bar should include:

- Back to Site Content button
- Page selector
- Current selected page URL
- Device toggle:
  - Desktop
  - Tablet
  - Mobile
- Selection mode dropdown
- Refresh preview button
- Export notes button
- Send to Bolt AI button, if Bolt AI integration exists or can be safely stubbed

---

### Main Area

Use a two-panel or three-panel layout.

#### 1. Live Page Preview Panel

This is the left or center panel.

It should:

- Show the selected frontend page inside an iframe or safe preview panel
- Display clickable overlays on detected elements where technically possible
- Support desktop, tablet, and mobile preview widths
- Allow refreshing the preview

#### 2. Notes / Element Inspector Panel

This is the right panel.

It should:

- Show selected element details
- Allow adding a note to the selected element
- Show existing notes for the selected element
- Allow setting note priority
- Allow setting note status
- Allow setting change type

#### 3. Optional Page Element Tree

This can be a bottom or side panel.

It should show the detected page hierarchy where available:

- Page
- Section
- Container
- Row
- Column
- Card
- Component
- Heading

---

## Selection Modes

Add a selection mode control with the following options:

- Auto Detect
- Sections
- Containers
- Rows
- Columns
- Cards
- Components
- Headings Only

In **Auto Detect** mode, if multiple elements overlap, show a small picker menu so the Super Admin can choose the exact element level.

Example picker options:

- Section: Hero
- Container: Hero Inner
- Heading: Lead your life and legacy with intention
- Button Group: Hero CTAs

---

## Element Detection Requirements

The Live Page Editor should detect and support notes on:

- Sections
- Containers
- Rows
- Columns
- Cards
- Components
- H1
- H2
- H3
- H4
- H5
- H6

The first stable version should prioritize:

1. Detecting headings
2. Detecting nearby parent sections
3. Creating stable references for each detected element
4. Allowing notes to be attached to those references

For hardcoded frontend pages, generate stable element references using available data such as:

- Page slug
- Element type
- Heading text
- Section order
- DOM path
- CSS class
- Parent section label

If iframe DOM inspection is not possible because of security, routing, rendering, or cross-origin limitations, do not use unsafe workarounds. Instead, implement the safest available alternative, such as:

1. Same-app iframe preview route
2. Authorized dashboard preview route
3. CMS-rendered preview from page/block data
4. Safe review overlay script loaded only in authenticated dashboard preview sessions
5. Server-generated section map from CMS blocks

Document the chosen approach in the implementation notes.

---

## Notes Requirements

When a Super Admin clicks an element, allow notes to be added to that exact element.

Each note should support the following data:

- Page title
- Page URL
- Page slug
- Element type
- Element label
- Heading text, if available
- Heading level, if available
- Parent section
- Parent container
- Parent row
- Parent column
- DOM selector/reference
- Note content
- Priority
- Status
- Change type

Priority options:

- Low
- Medium
- High
- Urgent

Status options:

- Draft
- Open
- In Progress
- Resolved
- Archived

Change type options:

- Copy update
- Section layout update
- Container spacing update
- Column layout update
- Card update
- Component update
- Button / CTA update
- Image update
- Form update
- Styling update
- Responsive / mobile issue
- Accessibility issue
- SEO update
- AI rewrite request
- Other

---

## PDF / AI-Readable Export Requirements

The Live Page Editor should export notes into a structured PDF or AI-readable document that Bolt AI can read.

The export should include:

- Page name
- Page URL
- Date created
- Created by
- Total elements reviewed
- Total notes
- Notes grouped by section
- Notes grouped by selected element
- Priority
- Status
- Change type
- AI-friendly instruction

Example export format:

```text
Page: Homepage
Section: Hero
Element Type: H1 Heading
Element Text: Lead your life and legacy with intention
Requested Change: Make the headline shorter and improve mobile spacing.
Priority: High
AI Instruction: Update only the H1 heading and responsive typography. Do not change the CTA buttons or background image.
```

If PDF generation already exists in the project, reuse the existing utility. If not, create export-ready structured data first and add a clean abstraction for future PDF generation.

---

## Bolt AI Integration Requirements

The Live Page Editor should connect to Bolt AI or prepare a clean integration point.

Bolt AI should be able to:

- Read exported note documents
- Understand the page being reviewed
- Understand selected element hierarchy
- Understand whether the target is a section, container, row, column, card, component, or heading
- Suggest updates
- Draft changes to CMS blocks where possible
- Mark hardcoded sections as manual implementation required
- Save all AI-generated updates as drafts

Important rules:

- Bolt AI must not auto-publish changes.
- Bolt AI must not make destructive edits.
- Super Admin must review and publish changes.
- Do not break the current Bolt AI button or workflow.
- Do not replace the existing Bolt AI system unless the current architecture requires a small connection adapter.

---

## Data Model

If the project already has a database or ORM pattern, follow the existing structure.

If needed, add or recommend the following models/tables.

---

### page_review_sessions

Fields:

- id
- page_id
- page_url
- page_title
- page_slug
- created_by
- status
- created_at
- updated_at

---

### page_review_elements

Fields:

- id
- review_session_id
- page_id
- page_url
- page_slug
- element_type
- element_label
- heading_text
- heading_level
- section_order
- parent_section_id
- parent_container_id
- parent_row_id
- parent_column_id
- dom_selector
- dom_path
- css_classes
- component_name
- cms_block_id
- bounding_box_json
- screenshot_url
- content_summary
- created_at
- updated_at

---

### page_review_notes

Fields:

- id
- review_session_id
- element_id
- note
- priority
- status
- change_type
- created_by
- created_at
- updated_at
- resolved_at

---

### page_review_exports

Fields:

- id
- review_session_id
- file_url
- file_type
- created_by
- created_at
- ai_visible
- ai_processed_at

---

## Implementation Instructions

Before coding, inspect the current codebase and identify:

1. Existing CMS / Site Content routes and components
2. Existing button/action layout in the CMS header
3. Existing Bolt AI button/workflow
4. Existing New Page or New Block button/workflow
5. Existing Super Admin permission utilities
6. Existing page preview or iframe rendering options
7. Existing CMS page/block data structure
8. Existing database/ORM/server action/API route conventions
9. Existing export/PDF/document utilities, if any

Then provide a brief implementation plan before making changes.

---

## Implementation Steps

After reviewing the codebase, implement the first stable version:

1. Add the **Live Page Editor** button/tab in the Site Content action area.
2. Place it between **Bolt AI** and **New Page / New Block**.
3. Hide it from non-Super Admin users.
4. Add a protected Live Page Editor route.
5. Add the top bar:
   - Back to Site Content
   - Page selector
   - Current selected page URL
   - Device toggle
   - Selection mode dropdown
   - Refresh preview
   - Export notes
   - Send to Bolt AI, if available
6. Add the preview panel using the safest available iframe or preview strategy.
7. Add the notes / element inspector panel.
8. Add first-pass heading detection.
9. Add first-pass parent section detection.
10. Add selected element state.
11. Add note creation and storage.
12. Add structured export-ready data.
13. Connect or prepare a clean adapter for Bolt AI.
14. Ensure all AI-generated changes are stored as drafts.
15. Add basic loading, empty, and error states.
16. Add helpful UI text so Super Admin users understand that this is a review workflow, not a direct publishing workflow.

---

## Do Not Break

Do not break:

- Existing Bolt AI button/workflow
- Existing New Page button
- Existing New Block button
- Existing CMS page routes
- Existing draft/publish workflow
- Existing Super Admin access protection
- Existing normal user dashboard permissions
- Existing frontend pages

---

## Acceptance Criteria

The implementation is complete when:

- A Super Admin can see the **Live Page Editor** button in Site Content.
- The button appears between **Bolt AI** and **New Page / New Block**.
- Non-Super Admin users cannot see or access the Live Page Editor.
- The Live Page Editor opens as a separate protected workflow.
- A Super Admin can select a page.
- The selected page appears in a safe preview area.
- A Super Admin can toggle desktop/tablet/mobile preview.
- A Super Admin can select or inspect at least headings and nearby parent sections.
- A Super Admin can add notes to a selected element.
- Notes include priority, status, and change type.
- Notes are saved using the project’s existing data/storage patterns.
- Export-ready structured data can be generated.
- Bolt AI integration is either connected or prepared through a clean adapter.
- No frontend changes are automatically published.
- Existing CMS and Bolt AI workflows still work.

---

## Final Instruction

Start by reviewing the current **Site Content** implementation in the dashboard.

The first visible UI change should be adding the **Live Page Editor** button/tab between **Bolt AI** and **New Page / New Block**.

Then implement the first stable version of the Live Page Editor as a separate Super Admin-only workflow connected to Site Content and Bolt AI.
