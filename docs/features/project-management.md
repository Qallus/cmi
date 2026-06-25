# Project Management (Gantt) — Feature & Replication Guide

A Gantt-based project management system with multiple views (Gantt, Kanban, List,
Table, Calendar, Templates, My Tasks), drag-to-reschedule, dependencies,
construction templates, and rich asset associations (selections, media, code
references, billing links). Built on **Next.js (App Router) + Supabase
(Postgres)**.

---

## 1. Feature Overview

- **7 views** of the same schedule data: Gantt, Kanban board, List, Table,
  Calendar, Project Templates, and My Tasks.
- **Schedule items** are typed: `project | phase | task | milestone`, grouped by
  project (a "schedule group").
- **Gantt chart** with drag-to-move, drag-to-resize (start/end handles),
  dependency arrows (4 relationship types), per-bar action dock (FAB), and
  hover association badges.
- **Dependencies** with lag days and optional auto-shift (moving a predecessor
  shifts successors).
- **Construction templates** (e.g., Kitchen Remodel, ADU, New Custom Home) that
  generate a full schedule + dependencies from a project start date.
- **Asset associations** per task: product selections, photos/videos, building
  code references, and billing links (invoice/quote/SOW/contract/payment).
- **Filtering**: type, status, priority, phase, assignee, plus quick filters
  (Today, Day, Week, Month, Dependencies, Client View).
- **Inline editor** for full item details + dependency management.
- **CSV / PDF export** of a project or item (HTML table → browser print).

---

## 2. Data Model (Supabase)

All tables are scoped by a `board_id` (default `"default"`). RLS is enabled with
permissive policies; all access is brokered by server API routes using the
service-role client.

### `project_schedule_items` (the core record)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| board_id | text | filter/scope key (default `default`) |
| project_id | uuid | → projects.id (nullable) |
| client_project_id | uuid | nullable |
| type | text | `project \| phase \| task \| milestone` |
| project_title | text | grouping label |
| title | text | **required** |
| phase | text | |
| assignee | text | |
| client | text | |
| participants | text | comma-separated names |
| start_date / end_date | date | **required** |
| status | text | `pending \| scheduled \| in_progress \| waiting \| delayed \| blocked \| needs_approval \| complete \| canceled` |
| priority | text | `low \| normal \| high \| urgent \| critical \| blocking_closeout` |
| progress | int | 0–100 |
| notify | bool | |
| description / forms / punch / internal_notes | text | |
| is_blocked | bool | + `blocker_reason` text |
| client_visible | bool | |
| sort_order | int | |
| visible_on_gantt | bool | default true |
| schedule_group_key | text | Gantt grouping key |
| template_slug / template_name | text | provenance when created from a template |
| duration_minutes | int | explicit duration |
| metadata | jsonb | stores Gantt drag offsets, e.g. `timeline_start_offset_minutes`, `last_timeline_interaction` |
| created_by / updated_by / created_at / updated_at | | |

### `project_schedule_dependencies`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| board_id / project_id / client_project_id | | scope |
| source_item_id / target_item_id | uuid | → schedule_items (CASCADE) |
| dependency_type | text | `finish_to_start \| start_to_start \| finish_to_finish \| start_to_finish` |
| lag_days | int | default 0 |
| auto_shift | bool | move predecessor → shift successor |
| notes | text | |

Unique on `(source_item_id, target_item_id, dependency_type)`.

### `project_templates` + `project_template_tasks`
- **project_templates**: `id, name, slug (unique), description, category,
  suggested_duration_days, is_active, metadata`.
- **project_template_tasks**: `id, template_id, phase_name, task_key (unique per
  template), task_name, description, offset_days, duration_minutes,
  dependency_keys text[], suggested_roles text[], client_visible, priority,
  sort_order`.
- Seeded with ~12 construction templates (Kitchen/Bathroom/Bedroom/Garage
  Remodel, Casita/ADU, Home Addition, New Custom Home, Backyard, Front Yard,
  Whole Home, Commercial TI, Exterior) and ~14 standard phases/tasks (Intake →
  Design → Estimate → Contract → Permitting → Pre-Con → Demo → MEP rough →
  Inspections → Finishes → QC → Punch → Walkthrough → Closeout).

### Association tables
- **project_media**: `media_type (photo|video), title, caption, file_url,
  storage_bucket, storage_path, capture_source (upload|front_camera|rear_camera|
  unknown), client_visible` + `project_id`, `project_schedule_item_id`.
- **project_selections**: product selections — `name, vendor_id/vendor_name,
  category, manufacturer, sku, model_number, description, image_url, product_url,
  price, quantity, unit, status, client_approval_status, lead_time_days,
  delivery_date, client_visible`.
- **project_code_references**: `title, jurisdiction_type (city|county|state|
  federal|hoa|other), jurisdiction_name, code_source, code_section, code_text,
  source_url, applies_to_phase, required_inspection, compliance_status,
  client_visible`.
- **project_billing_links**: `link_type (invoice|quote|sow|contract|payment|
  billing_record), linked_record_id, linked_record_label, amount, status, url`.
- **selection_vendors**: `name, website_url, contact_name, email, phone, notes`
  (auto-upserted when a selection names a vendor).

> Association counts are **computed at load time** (not stored) and attached to
> each schedule item as `association_counts` for the hover badges.

---

## 3. API Routes (`app/api/project-manager/…`)

| Route | Methods | Behavior |
|---|---|---|
| `/schedule` | GET, POST | GET returns items for a board (decorated with association counts, ordered by start_date/sort_order). POST creates an item (validates/normalizes title, dates, status, priority, type, progress 0–100, board, group key). |
| `/schedule/[id]` | PATCH, DELETE | Partial update (touches `updated_at`); delete by id. |
| `/dependencies` | GET, POST | List/create (rejects self-deps; validates type; default board). |
| `/dependencies/[id]` | PATCH, DELETE | Update/delete a dependency. |
| `/templates` | GET | Returns active templates + all template tasks. |
| `/apply-template` | POST | Body `{ template_id, project_title, start_date, board_id }`. Creates schedule items offset by `offset_days`, derives durations from `duration_minutes`, then wires dependencies from `dependency_keys` (type `finish_to_start`, `auto_shift: true`). Returns created items + dependency count. |
| `/assets` | POST | Body `{ resource: "media" | "selection" | "code_reference", ...fields }`. Creates the asset; selections auto-upsert a vendor by name. |

All routes use the service-role Supabase client; the dashboard is gated by the
auth layer (`requireAdmin` / session cookie).

---

## 4. Data Layer (`lib/project-manager/`)

- **types.ts** — `ScheduleItemType`, `ScheduleStatus`, `SchedulePriority`,
  `DependencyType`, `ProjectScheduleItem`, `ProjectScheduleDependency`,
  `ProjectTemplate`, `ProjectTemplateTask`, `ProjectManagerData`.
- **data.ts**
  - `loadProjectManagerData(boardId = "default")` → `{ items, dependencies,
    templates, templateTasks }`, with items decorated.
  - `decorateScheduleItems(supabase, items)` → queries selections / media / code
    references / billing links in parallel and attaches
    `association_counts: { selections, media, photos, videos, codes, billing,
    participants }`.

---

## 5. UI (`app/dashboard/project-manager/`)

- **page.tsx** — server component; loads data (demo fallback) → renders client.
- **project-manager-client.tsx** — single large client component holding all
  views + state (`items`, `dependencies`, `templates`, `collapsed`, `selected`,
  `assetModal`, `activeView`, `filters`).

### Views
- **Gantt** — timeline grid (day columns), bars positioned by date + intra-day
  offset; drag center = move, left/right edges = resize (snap 15 min); SVG
  dependency arrows; per-bar **action dock** (see FAB); hover shows association
  badges. Synthetic "project summary" rows per `schedule_group_key` can collapse.
- **Kanban** — 8 status columns; native HTML5 drag-and-drop to change status.
- **List** — hierarchical project → tasks with status/progress/date range.
- **Table** — sortable columns (project, status, start, end, progress).
- **Calendar** — month-ish grid placing items on their date range; today
  highlighted.
- **Project Templates** — browse templates by category; apply one (project name
  + start date) to generate the schedule.
- **My Tasks** — list filtered to the current user's assigned/participating items.

### FAB (per-bar action dock on the Gantt)
Clicking a Gantt bar opens a floating dock at the cursor with ~15 actions:
**Connect task** (dependency), **Add user**, **Photo**, **Video**, **Selection**,
**Code**, **Edit**, **Duplicate**, **Note**, **Hide**, **Complete**, **Cancel**,
**CSV**, **PDF**, **Delete**. Photo/Video/Selection/Code open the asset modal.

### Editors
- **Item editor** (modal): all fields + participants multi-select + incoming
  dependency management (add source, type, lag days, auto-shift; delete).
- **Asset modal**: photo/video (file + caption + capture source + client
  visible), selection (full product fields + client approval), code reference
  (jurisdiction + section + compliance).

---

## 6. Gantt technical notes
- Constants: `dayWidth ≈ 46px`, `minutesPerDay = 1440`, `dragSnapMinutes = 15`.
- Timeline = `{ start: YYYY-MM-DD, days }`, `days = max(14, span + 3)`.
- Item left = `(daysFromStart * 1440 + offsetMinutes)/1440 * dayWidth`;
  width = `(durationMinutes/1440) * dayWidth`.
- Dependency arrows are SVG paths between source/target centerlines; `auto_shift`
  recomputes successor timing when a predecessor is dragged.

---

## 7. Replication checklist
1. Apply migrations in order: schedule items (+ phase-1 fields + schedule groups),
   dependencies, templates (+ seed), media/selections/code-references, billing
   links, selection_vendors.
2. Port `lib/project-manager/{types,data}.ts`.
3. Implement the 5 route groups: `schedule`, `schedule/[id]`, `dependencies`,
   `dependencies/[id]`, `templates`, `apply-template`, `assets`.
4. Build the client with the 7 views; start with Table/List (cheap) then Gantt.
5. Implement Gantt math + SVG dependencies + drag move/resize + the action dock.
6. Add the item editor + asset modal.
7. Seed templates so "apply template" produces a usable schedule immediately.

**Dependencies:** none beyond Next.js + `@supabase/supabase-js` + `lucide-react`
+ Tailwind. No external Gantt library — the chart is hand-rolled.
