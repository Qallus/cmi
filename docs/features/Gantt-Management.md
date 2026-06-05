# Constructed Matter — Gantt Project Management

## Document Purpose

Source-of-truth reference for the **Gantt Project Management** feature inside the CMI Staff Dashboard.

Covers: current implementation, data architecture, UI patterns, FAB dock system, view tabs, project templates, and planned extensions.

File location: `docs/features/Gantt-Management.md`

---

## Implementation Status

The feature is **live** inside `staff-dashboard.html` under the `Projects` section (nav label: `Project Management`).

All project data is served from **Supabase** via the `GANTT_ITEMS` table. FluentBoards, WordPress, and other WordPress integrations are optional sync targets — not dependencies. Any project or task can be created independently from within the dashboard.

---

## Supabase-First Architecture

### Source of Truth

`GANTT_ITEMS` loaded via `/api/project-schedule-items` is the single source of truth for every view in the Projects section.

```
Supabase GANTT_ITEMS
  → Gantt timeline
  → List view
  → Table view
  → Kanban view
  → Calendar view
  → Stats bar
```

FluentBoards (`FB_TASKS`) is used only for the **My Tasks** tab as a supplemental integration. No core view depends on it. If FluentBoards is disconnected, all other views still load normally.

### Data Loading

```javascript
// Load from Supabase
await loadGanttItems(forceLoad);

// Read cached items
GANTT_ITEMS  // global array

// Filter for active view
ganttFilteredItems()

// Compute stats
ganttScheduleStats()
```

### Offline/Fallback Behavior

If `GANTT_ITEMS` is empty and the API call fails, each view renders an empty state with a "No items found" message rather than crashing or showing stale data from a third-party.

---

## Page Layout

```
┌─────────────────────────────────────────────────────┐
│  Section Header  (Project Management)               │
├─────────────────────────────────────────────────────┤
│  #fb-stats-wrap  — Stats bar (always visible)       │
│  Active projects · Open tasks · Overdue · Health    │
├─────────────────────────────────────────────────────┤
│  View Tabs                                          │
│  [Gantt] [List] [Table] [Kanban] [Calendar]         │
│  [Project Templates] [My Tasks]                     │
├─────────────────────────────────────────────────────┤
│  #fb-content-wrap — Active view content             │
│                                                     │
│  (Gantt timeline / list / table / kanban /          │
│   calendar / template gallery / my tasks)           │
├─────────────────────────────────────────────────────┤
│  Scheduled Items Accordion (collapsible)            │
│  Grouped project rows → expandable task list        │
└─────────────────────────────────────────────────────┘
```

### Stats Bar (`#fb-stats-wrap`)

Populated by `updateFBStatsWrap()` using `ganttScheduleStats()`.

Always visible above the view tabs — not embedded inside any individual view. Switching tabs does not move or hide the stats.

Stats shown:
- Active projects count
- Open tasks count
- Overdue tasks count
- Schedule health indicator
- Percent complete (weighted average)

`updateFBStatsWrap()` is called from every view render function so stats stay current regardless of which tab is active.

---

## View Tabs

Default active view is **Gantt**.

| Tab | ID | Data Source | Description |
|---|---|---|---|
| Gantt | `fb-tab-gantt` | `GANTT_ITEMS` | Visual timeline with draggable bars |
| List | `fb-tab-list` | `GANTT_ITEMS` | Project groups with expandable task rows |
| Table | `fb-tab-table` | `GANTT_ITEMS` | Dense 11-column data table |
| Kanban | `fb-tab-kanban` | `GANTT_ITEMS` | Status-column swim lanes |
| Calendar | `fb-tab-calendar` | `GANTT_ITEMS` | Month grid by end date |
| Project Templates | `fb-tab-templates` | `CMI_PROJECT_TEMPLATES` | Template tile gallery |
| My Tasks | `fb-tab-mytasks` | `FB_TASKS` (FluentBoards) | Staff-assigned tasks only |

Tab switching calls `switchFBView(view)` which:
1. Sets `FB_VIEW = view`
2. Calls `hideGanttFAB()` to dismiss any open FAB dock
3. Toggles `active` class on all tab buttons
4. Calls `renderFBView()` to render the selected view

---

## Project Hierarchy

Projects are the **parent**. Tasks belong to projects.

In `GANTT_ITEMS` the relationship is expressed via:
- `item.project` — project key/name string used for grouping
- `item.schedule_group_key` — alternate grouping key
- `item.parent_item_id` — for task-to-task nesting (subtasks)
- `item.item_type` — `'project'` or `'task'` or `'milestone'`

`buildScheduledProjectGroups()` groups `GANTT_ITEMS` by project key and returns an ordered map of `{ projectKey → [items] }`.

### Hierarchy Display

```
Project A  (parent row / section header)
  ├── Phase: Pre-Construction
  │     ├── Task: Design Review
  │     └── Task: Permit Submission
  ├── Phase: Framing
  │     ├── Task: Frame Walls
  │     └── Task: Roof Decking
  └── Milestone: Construction Start
```

In Gantt view, projects render as bold header rows with a wider bar. Tasks render as indented child rows.

---

## Gantt View

### Rendering

`renderFBGantt(forceLoad?)` — async function.

Loads `GANTT_ITEMS`, computes stats, renders stats wrap, then builds the timeline SVG/canvas from `ganttFilteredItems()`.

Items with `visible_on_gantt === false` are excluded from the timeline but remain in other views.

### Bar Interaction

Gantt bars support:
- **Drag to reschedule** — changes `start` and `end` dates, saves to Supabase
- **Click center → FAB dock** — shows the context action menu (see FAB section below)

Drag and click are distinguished by the `GANTT_SUPPRESS_FAB` flag (see Suppress Pattern below).

### Zoom

Timeline zoom levels: Week / Month / Quarter

---

## FAB Dock System

The FAB dock is a floating context menu that appears when a user **clicks the center** of a Gantt bar. It provides quick actions for the selected item without navigating away from the timeline.

Design reference: ctrl-p.io Gantt implementation (`suppressNextSelectRef` pattern).

### Triggering the FAB

1. User clicks a Gantt bar (no drag movement detected)
2. `pointerup` handler checks `GANTT_SUPPRESS_FAB` is `false`
3. Calls `showGanttFAB(item, clientX, clientY)`

### FAB Position

The dock is positioned at `position:fixed` clamped to viewport bounds so it never overflows the screen edge.

```javascript
const x = Math.min(clientX, window.innerWidth - 360);
const y = Math.min(clientY, window.innerHeight - 420);
```

### FAB DOM Structure

```html
<div class="gantt-fab-dock" data-gantt-action-dock style="left:Xpx;top:Ypx;">
  <div class="gantt-fab-header">
    <div>
      <div class="gantt-fab-title">Item Name</div>
      <div class="gantt-fab-sub">Project · Phase · Status</div>
    </div>
    <button class="gantt-fab-close">×</button>
  </div>
  <div class="gantt-fab-grid">
    <!-- 3-column grid of action buttons -->
  </div>
</div>
```

The `data-gantt-action-dock` attribute is used by the outside-click listener to identify the dock element.

### FAB Actions (17 total)

| Action | Label | Icon | Behavior |
|---|---|---|---|
| `edit` | Edit Item | pencil | Opens `openGanttItemModal(item)` |
| `complete` | Mark Complete | check-circle | Sets `status = 'complete'`, saves |
| `cancel` | Cancel Item | x-circle | Sets `status = 'cancelled'`, saves |
| `status` | Change Status | toggle | Opens status select dropdown |
| `addtask` | Add Task | plus-circle | Opens `openGanttItemModal('task')` pre-linked to this item's project |
| `duplicate` | Duplicate | copy | Calls `duplicateGanttItem(item)` |
| `note` | Add Note | chat | Opens note input for this item |
| `photo` | Add Photo | camera | Opens file picker filtered to images |
| `video` | Add Video | video | Opens video URL or file input |
| `file` | Add File | paperclip | Opens file picker |
| `product` | Add Product | package | Opens product/material selector |
| `selection` | Add Selection | swatches | Opens material selection input |
| `contact` | Add Contact | user-plus | Links a contact/client to this item |
| `adduser` | Add Assignee | users | Opens user assignment picker |
| `connect` | Connect / Link | link | Opens dependency/link selector |
| `hide` | Hide from Gantt | eye-off | Sets `visible_on_gantt = false`, saves |
| `delete` | Delete Item | trash | Confirms then deletes (danger style) |

Delete uses `.gantt-dock-action.danger` styling (red color scheme).

### FAB Dismissal

The FAB dock closes on:
- Clicking the `×` close button
- Clicking anywhere outside the dock (`pointerdown` on `document`)
- Pressing `Escape` key
- Switching view tabs (`switchFBView` calls `hideGanttFAB()`)

Listeners are attached when the dock opens and removed when it closes.

```javascript
function hideGanttFAB() {
  const dock = document.querySelector('[data-gantt-action-dock]');
  if (dock) dock.remove();
  document.removeEventListener('pointerdown', _fabOutsideHandler);
  document.removeEventListener('keydown', _fabEscHandler);
  GANTT_FAB_ITEM = null;
}
```

### Suppress Pattern

`GANTT_SUPPRESS_FAB` is a global boolean that prevents the FAB from opening when the user releases a drag operation.

```javascript
// In pointerup handler (bindGanttDrag):
if (moved && item) {
  GANTT_SUPPRESS_FAB = true;
  // save new dates + re-render
  window.setTimeout(() => { GANTT_SUPPRESS_FAB = false; }, 120);
  return;
}
// Clean click — show FAB
if (!GANTT_SUPPRESS_FAB && item) {
  showGanttFAB(item, e.clientX, e.clientY);
}
GANTT_SUPPRESS_FAB = false;
```

The 120ms timeout gives the browser time to fire any residual pointer events before the flag resets.

---

## List View

`renderFBList()` — async.

Renders `GANTT_ITEMS` grouped by project using `buildScheduledProjectGroups()`.

### Columns

| Column | Field |
|---|---|
| Task | `item.title` |
| Phase | `item.phase` |
| Status | `item.status` (badge) |
| Assignee | `item.assignee` |
| Due | `item.end` |
| Progress | `item.progress` % bar |
| Visibility | `item.client_visible` toggle |

### Structure

Each project group renders as a collapsible section:
- Section header: project name, task count, health indicator
- Expandable task rows below

Clicking a task row opens `openGanttItemModal(item)`.

---

## Table View

`renderFBTable()` — async.

Dense tabular view of all `GANTT_ITEMS`.

### Columns (11)

Task · Project · Phase · Status · Priority · Assignee · Start · Due · Progress · Visibility · Type

Priority color-coding via `ganttPriorityColor(priority)`:
- Critical → red
- High → orange
- Normal → gold
- Low → muted

---

## Kanban View

`renderFBKanban()` — async.

Groups `GANTT_ITEMS` into status swim lanes displayed as horizontal columns.

### Columns (7)

| Column | Status Value |
|---|---|
| Not Started | `not_started` / empty |
| In Progress | `in_progress` |
| Waiting | `waiting` |
| Delayed | `delayed` |
| Needs Review | `needs_review` |
| Blocked | `blocked` |
| Complete | `complete` / `done` |

Each card shows: title, project, phase, assignee avatar/name, due date, progress bar. Clicking a card opens `openGanttItemModal(item)`.

---

## Calendar View

`renderFBCalendar()` — async.

Month grid populated by `GANTT_ITEMS` using `item.end` (due date) as the primary date and `item.start` as fallback.

Clicking an item opens `openGanttItemModal(item)` — not the FluentBoards task modal.

---

## Project Templates View

`renderFBTemplates()` — synchronous (reads `window.CMI_PROJECT_TEMPLATES`).

Source file: `assets/cmi-project-templates.js`

### Template Data Shape

```javascript
window.CMI_PROJECT_TEMPLATES = [
  {
    name: "Kitchen Remodel",
    slug: "kitchen-remodel",
    category: "Residential Remodel",
    description: "Full kitchen renovation...",
    suggested_duration_days: 45,
    tasks: [
      { name: "Demo existing kitchen", phase: "Demo", duration_days: 2 },
      // ...
    ]
  },
  // ...
]
```

### Available Templates (11)

Categories and templates:

| Category | Templates |
|---|---|
| Residential Remodel | Kitchen Remodel, Bathroom Remodel, Basement Finish |
| Residential New Build | Custom Home Build |
| Residential Addition | Home Addition |
| Commercial | Commercial Build-Out, Office Renovation |
| Landscape / Outdoor Living | Outdoor Living Space, Pool & Landscape |
| Exterior | Exterior Renovation, Roofing Project |

### Template Gallery UI

Templates render as a tile grid (`gantt-template-gallery`).

Each tile shows:
- Category badge (gold, uppercase)
- Template name
- Short description
- Duration and task count

Clicking a tile calls `openGanttTemplateModal(slug)` to start a new project from that template.

### Adding Templates

Add new entries to `assets/cmi-project-templates.js` in the `window.CMI_PROJECT_TEMPLATES` array. No other file changes needed.

---

## My Tasks View

`renderFBMyTasks()` — uses `FB_TASKS` from FluentBoards (the only view with a WordPress dependency).

Shows tasks assigned to the currently logged-in staff user. Falls back gracefully if FluentBoards is not connected.

---

## CSS Classes Reference

### FAB Dock

| Class | Purpose |
|---|---|
| `.gantt-fab-dock` | Fixed-position dock container (z-index: 90) |
| `.gantt-fab-header` | Title + close button row |
| `.gantt-fab-title` | Item name (truncated) |
| `.gantt-fab-sub` | Project · phase · status subtitle |
| `.gantt-fab-close` | Circle × button |
| `.gantt-fab-grid` | 3-column action button grid |
| `.gantt-dock-action` | Individual action button |
| `.gantt-dock-action.danger` | Red-tinted destructive action (Delete) |

### Template Gallery

| Class | Purpose |
|---|---|
| `.gantt-template-gallery` | Auto-fill tile grid |
| `.gantt-template-tile` | Individual template card |
| `.t-cat` | Category label (gold uppercase) |
| `.t-meta` | Bottom meta row (duration + task count) |

### Stats Bar

| Selector | Purpose |
|---|---|
| `#fb-stats-wrap` | Container above view tabs |
| `.gantt-overview` | Stats layout inside wrap |

---

## Key Functions Reference

| Function | Description |
|---|---|
| `loadGanttItems(force?)` | Fetches `GANTT_ITEMS` from Supabase |
| `ganttFilteredItems()` | Returns filtered subset of `GANTT_ITEMS` |
| `ganttScheduleStats()` | Computes project health stats |
| `updateFBStatsWrap()` | Renders stats into `#fb-stats-wrap` |
| `buildScheduledProjectGroups()` | Groups items by project key |
| `switchFBView(view)` | Switches active tab and renders view |
| `renderFBView()` | Dispatches to the active view's render function |
| `renderFBGantt(force?)` | Gantt timeline view |
| `renderFBList()` | List view |
| `renderFBTable()` | Table view |
| `renderFBKanban()` | Kanban view |
| `renderFBCalendar()` | Calendar view |
| `renderFBTemplates()` | Template gallery view |
| `renderFBMyTasks()` | My Tasks view (FluentBoards) |
| `showGanttFAB(item, x, y)` | Opens FAB dock at viewport position |
| `hideGanttFAB()` | Closes FAB dock and removes listeners |
| `ganttFABAction(action, itemId)` | Executes a FAB dock action |
| `duplicateGanttItem(item)` | Clones a GANTT_ITEM with "(copy)" suffix |
| `ganttPriorityColor(priority)` | Returns CSS color string for priority |
| `bindGanttDrag(bar, item)` | Attaches drag-to-reschedule + click-to-FAB |
| `openGanttItemModal(item)` | Opens create/edit modal for a GANTT_ITEM |
| `openGanttTemplateModal(slug?)` | Opens new-project-from-template modal |

---

## Global State Variables

| Variable | Type | Description |
|---|---|---|
| `GANTT_ITEMS` | Array | Cached items from Supabase |
| `GANTT_LOADED_KEY` | String | Board key for cache invalidation |
| `GANTT_FAB_ITEM` | Object / null | Currently selected item in FAB dock |
| `GANTT_SUPPRESS_FAB` | Boolean | Prevents FAB on drag release |
| `FB_VIEW` | String | Active view tab name (default: `'gantt'`) |
| `FB_TASKS` | Array | FluentBoards tasks (My Tasks only) |

---

## Data Model — `GANTT_ITEMS`

Core fields used by the dashboard:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | String | Item name |
| `item_type` | String | `'project'`, `'task'`, `'milestone'`, `'phase'` |
| `project` | String | Project key (used for grouping) |
| `schedule_group_key` | String | Alternate grouping key |
| `parent_item_id` | UUID | Parent task/project for nesting |
| `phase` | String | Phase name |
| `status` | String | Status value (see statuses below) |
| `priority` | String | `'low'`, `'normal'`, `'high'`, `'critical'` |
| `assignee` | String | Assigned user name or ID |
| `start` | Date | Start date |
| `end` | Date | End/due date |
| `progress` | Integer | 0–100 percent complete |
| `client_visible` | Boolean | Show on client-facing views |
| `visible_on_gantt` | Boolean | Show bar in Gantt timeline |
| `dependency_ids` | Array | IDs of blocking items |
| `vendor` | String | Assigned vendor/subcontractor |
| `notes` | String | Internal notes |
| `fluent_task_id` | String | FluentBoards task ID (optional sync) |
| `wp_post_id` | Integer | WordPress post ID (optional sync) |
| `created_at` | Timestamp | |
| `updated_at` | Timestamp | |

### Status Values

```
not_started
in_progress
waiting
delayed
needs_review
blocked
complete
cancelled
```

### Priority Values

```
low
normal
high
critical
```

---

## Integration Notes

### FluentBoards

- Used only for **My Tasks** tab
- `fluent_task_id` on `GANTT_ITEMS` stores the linked FluentBoards task ID
- Sync is one-way: CMI → FluentBoards on project create/update
- Disconnecting FluentBoards has no impact on Gantt, List, Table, Kanban, or Calendar views

### WordPress

- Not used for project data
- `wp_post_id` is reserved for future portfolio sync (when an internal project becomes a public portfolio item)
- Portfolio items have their own data model (`portfolio` table) separate from `GANTT_ITEMS`

### FluentBooking / FluentCRM

- Bookings and contacts link to projects via `project_id` foreign keys in their respective tables
- Gantt view does not pull from booking or CRM tables

---

## Security Notes

- `GANTT_ITEMS` is protected by Supabase RLS — staff read/write, public no access
- Project data never surfaces to unauthenticated requests
- The FAB dock actions that modify data (`delete`, `complete`, `hide`) use the authenticated Supabase client
- Vendor/client names shown in the UI are already stored in Supabase — no external API calls on FAB open
- API keys, webhook secrets, and credentials are never stored in `GANTT_ITEMS`

---

## Planned Extensions

### Short Term

- Wire `loadGanttItems()` into the `nav()` function so stats populate immediately on section load (currently triggers on first Gantt render)
- Add drag-and-drop reordering in Kanban columns
- Progress inline edit on list/table rows
- Bulk status change via table multi-select

### Medium Term

- Dependency arrows on Gantt timeline
- Auto-shift dependent tasks when a blocking task moves
- Critical path highlighting
- Export schedule as PDF/CSV

### Long Term

- Client-facing schedule view (read-only, `client_visible` items only)
- Calendar sync (Google Calendar / iCal)
- Mobile-optimized timeline view
- Subcontractor portal with task confirmation

---

## Related Files

| File | Purpose |
|---|---|
| `staff-dashboard.html` | All dashboard JS, CSS, and HTML — primary implementation file |
| `assets/cmi-project-templates.js` | `window.CMI_PROJECT_TEMPLATES` data |
| `supabase/2026-05-28_user_management_phase1.sql` | Current Supabase schema migration |
| `docs/features/Gantt-Management.md` | This file |

---

## Change Log

| Date | Change |
|---|---|
| 2026-06-01 | Full rewrite to reflect live implementation: FAB dock, Supabase-first views, view tab structure, template gallery, stats bar, suppress pattern |
| Initial | Original planning spec (pre-implementation) |
