<!-- Approved 2026-11-04. Response to Brandon: docs/schedule/CMI_Scheduling-Spec_R2_Response_2026-11-04.md -->
# Scheduling Module Spec R2: review, answers to Section 15, and the Phase 1 plan

## Context

Brandon's spec (`docs/schedule/CMI_Project-Scheduling-Module_Functional-Spec_2026-11-02_R2.md.txt`, with a .docx copy)
asks to upgrade Schedules so Fernando and Ben can run jobs from the dashboard instead of MS Project or P6. It wants:

- a P6-style grid
- calendars
- critical path with float
- progress tracking and lookahead
- Excel export and import
- an AI schedule builder

Section 15 asks Jeremy for the grid library, where the critical-path engine runs, and an effort estimate by phase for
the 2026 plan.

I checked the spec against the code and the live database. Its direction and phase order are right, and the "What we
already have" table (§2) is mostly accurate. A few claims are off, and several things it assumes exist don't yet.

**Deliverable (after approval):**
- A response document, `docs/schedule/CMI_Scheduling-Spec_R2_Response_2026-11-04.md`, containing the review, the
  Section 15 answers and the estimate below.
- The Phase 1 build that follows, behind a feature flag.

## 1. Corrections to §2/§3 (what CMI has today)

| Spec says | Actually |
|---|---|
| Critical path: "Flagged, not computed" | Correct. `is_critical` is a manual checkbox (`item-drawer.tsx:144`). |
| Date logic: "Existing float is respected" | Only in one direction. The cascade (`lib/schedules/data.ts:344-430`, server only) pushes forward from the edited task and skips any successor that already starts later. There's no backward pass and no float figure. |
| "% complete: Status only" | `schedule_items.percent_complete` already exists (a 5% slider in the drawer). There are no actual start/finish columns. |
| Baselines: single | `schedule_baselines` already stores every capture as a snapshot (name, reason, approved_by). The Gantt only shows the latest because capture overwrites `baseline_start/end` on each item. Multiple baselines is a smaller job than the spec implies. |
| Table view | Read-only (`views/list-view.tsx`, 93 lines). The grid is new work, not an extension of it. |
| Gantt drag | Works in **calendar** days on the client (`gantt-view.tsx:133-140`), then the server cascades in working days. Phase 1 has to fix that mismatch. |
| Resource view: staff only | `assignees` already accepts staff, vendor, contractor and client. Only staff get notified (`lib/schedules/notify.ts`). |
| Calendar | One `workdays` column per schedule. `addWorkdays` already accepts a `holidays` set that nothing passes in, which is an easy hook. |

There's also a small bug: the drawer shows a negative lag as `+-3d`. I'll fix it in Phase 1.

## 2. Things the spec assumes exist but don't

None of these should block Phase 1, but Phases 2 and 3 depend on them:

| Assumed | Reality | Consequence |
|---|---|---|
| Adaptive budget lines / cost codes on a job | Not built. The Adaptive plan (`docs/features/adaptive/adaptive-mcp-plan.md`) is waiting on API credentials. Only `trade_cost_codes` (trade → cost code) exists. | Phase 1 stores a plain `cost_code` text on each task, matching `trade_cost_codes`. It becomes a real budget-line link once Adaptive is connected. The AI builder's "from budget" step depends on this. |
| Procurement dashboard / POs | Not built. They're in Trade Partner Phase 4 (an outline only). | The order-by date can be computed and flagged in Phase 2. The "no PO issued" check waits for POs. |
| Trade partner portal showing a partner's tasks | Partners have no login. The application flow uses a token link. | Phase 2 sends the trade lookahead as a token link plus a PDF by email. A login portal is separate work. |
| Per-job Slack channels | No Slack integration. | Weekly update summaries go to the daily log (`createDailyLog`) and the bell. Slack comes later, if wanted. |
| CARL (durations from history) | Doesn't exist anywhere in code. | Phase 3 needs a `schedule_task_history` table. Define CARL before then. |
| Inspections / jurisdictions | No tables. There's a legacy `project_code_references` tied to the old schedule system. | Inspection milestones get their own fields in Phase 2. |
| Change order approval hook | COs exist (`lib/change-orders/data.ts`). Approving one is only a status change with no hook. | Phase 2 adds a hook in `updateChangeOrder` when status becomes approved. |
| Selection decision date | `project_selections.target_decision_date` exists. | Ready to use as a predecessor. |
| Company holiday settings | None. A generic `app_settings` table exists. | Phase 1 adds a calendars table (below). |
| Today tiles, daily log, punch % closed, mobile capture | All exist. | Usable as the spec describes. |

Also: the base schedule tables (`job_schedules`, `schedule_items`, …) have no CREATE TABLE in the repo; they exist only in
the live database. Phase 1 writes a baseline migration from the live schema first, so later ALTERs have something to
diff against.

## 3. Design points to settle before building

1. **Switching existing schedules to two-way auto-scheduling (§6.2).** In a real critical-path model, a task with no
   predecessor or constraint snaps to the schedule start. Turning it on for a live schedule could therefore pull dates
   earlier everywhere.
   - *Plan:* turning on critical-path calculation for a schedule is an explicit step with a before/after preview, the
     same pattern as Shift Dates. Any task whose current start is later than the computed early start gets a
     Start-No-Earlier-Than constraint at its current date, so nothing moves unless the person accepts it.
2. **Links between schedules.** Links already cross schedules (`is_cross_schedule`). The engine calculates the whole
   network for the job (all of the job's schedules), not one schedule at a time. Otherwise the critical path stops at a
   schedule boundary.
3. **Calendar level.** The spec has company → job → task. Deal, Pre-Con and selection schedules have no job, so the
   middle level is "the job, or the schedule when it has no job". A lag counts in the successor's calendar, P6's
   default. The spec should say this explicitly.
4. **Activity IDs.** Add `activity_id` as an integer, unique per schedule, backfilled as `sort_order × 10`. Row order
   stays `sort_order`. This matches §4.3.
5. **Friday send to trade partners.** This emails external people automatically. It goes through the existing outbound
   guard (`canSendOutbound`, held outside production) and the consent/suppression checks. It sends from info@ with
   Reply-To set to the PM, and only after the PM's Friday-morning preview, with a hold option.
6. **No silent deletes on Excel re-import.** The spec already says this. Keep it.

## 4. Answers to Section 15

- **Grid component: a custom grid, built in the codebase.** Reasons:
  - Under 500 rows doesn't need virtualization.
  - The hard parts are the outline (WBS indent and collapse), row-for-row sync with the custom Gantt, and the ripple
    flash. All of those are easier with full control.
  - AG Grid Community lacks tree data and range fill (those are Enterprise, about $1k+ per developer per year), and
    Handsontable needs a commercial license.
  - Keyboard navigation, paste, fill-down and an undo stack of the last 50 actions are about a week of focused work.
  - If the keyboard feel falls short in testing, AG Grid Enterprise is the fallback.
- **Where the engine runs: both, from one module.**
  - `lib/schedules/cpm.ts` is a pure TypeScript function, like `workdays.ts`, so it runs in the browser and on the
    server.
  - The browser recalculates on every keystroke and powers the what-if sandbox.
  - On save, the server re-runs it and stores early/late dates, float and the critical flag. The server result is
    authoritative.
  - MCP tools and the API use the same function.
  - It replaces `computeCascade`.
- **Holidays: seed in Settings → Scheduling** with Brandon's list from §5, editable by admins. The handbook isn't in the
  system, so Settings is the single source.
- **Trade partner portal:** it doesn't render tasks. The lookahead is a new page: a token link like the prequal flow,
  plus a PDF. A login portal is separate.
- **Inspection chains:** start with Scottsdale and Phoenix. Each chain is data, so Paradise Valley and Maricopa County
  are a quick addition once someone gives us their inspection order.
- **Friday send: email from info@ with Reply-To set to the PM** (existing pattern), with the PM preview and hold. Not
  portal-only, because there is no portal.
- **Effort** (weeks of build time for Jeremy with Claude Code, testing included):

| Phase | Scope | Estimate | Blocked by |
|---|---|---|---|
| 1. Engine and grid | Calendars and holidays, calendar-day tasks, critical path with float, grid, task panel, Gantt drag rules, milestone types and contract dates, what-if, Excel export/import/blank template | **6–8 weeks** | Nothing |
| 2. Field use | Status date, weekly update and narrative, 3-week lookahead (internal/trade/client) and Friday send, notifications, mobile update, constraints, resource pool and cross-job view, multiple baselines and CO extensions, order-by dates, inspection results, WBS/location codes, 11x17 print | **7–9 weeks** | PO check needs POs; trade portal view needs partner access; budget links need Adaptive |
| 3. Intelligence | AI builder panel, sequencing library and lint, save-as-template with versions, duration history | **4–6 weeks** | Adaptive budget lines; a few months of Phase 2 actuals for the history step |

Total: roughly 4–6 months alongside other dashboard work. Phase 1 can start now.

## 5. Phase 1 build plan (after approval)

Everything sits behind a new flag, `schedule_engine` (off). With the flag off, the current Table view, cascade and
Gantt behave exactly as they do today.

**Migrations** (Jeremy runs them):
- `2026-11-xx_schedule_base.sql`: the CREATE TABLE IF NOT EXISTS baseline, captured from the live schema.
- `2026-11-xx_schedule_engine.sql`:
  - `schedule_calendars`: id, scope (company | job | schedule), scope_id, name, working_weekdays, exceptions jsonb
    `{date, working, type, label}`, version. Seeded with the company calendar and Brandon's holidays.
  - `job_schedules` gets calendar_id, status_date, scheduling_mode (auto | manual | legacy), target_finish.
  - `schedule_items` gets:
    - activity_id (backfilled ×10) and wbs
    - duration_unit (workdays | calendar)
    - constraint_type and constraint_date (is_locked maps to "locked")
    - actual_start, actual_finish, remaining_duration
    - early/late start/finish, total_float, free_float
    - milestone_type, contract_date, cost_code, guid
  - `schedule_baselines` gets number, label and calendar_snapshot.
  - Item history goes in the existing `schedule_activity`.

**Code:**
- `lib/schedules/calendar.ts`: merges company, job and schedule calendars into one effective calendar; adds typed
  exception counts; converts working days and calendar days. It extends `workdays.ts`, which already has the holidays
  hook.
- `lib/schedules/cpm.ts`:
  - forward and backward passes over FS/SS/FF/SF with lag, the task's own calendar, and constraints (start no earlier
    than, must finish on, as late as possible, locked)
  - phase roll-up, total and free float, critical and near-critical, orphan list, loop detection
  - pure functions with heavy unit tests (`cpm.test.mjs`)
- `lib/schedules/predecessors.ts`: parses and formats shorthand like `120FS+2, 150SS, 7cd`, and computes successors.
- `lib/schedules/data.ts`:
  - `recalcJob(jobId)` runs the engine and saves the changed rows.
  - `updateItem` calls it when the schedule's mode isn't legacy.
  - A switch-to-engine preview, a "Renumber by tens" action, and baselines by number.
- **Grid UI** in `components/schedules/grid/`:
  - `schedule-grid.tsx`: cells, keyboard, editing, paste, fill-down, undo/redo, row drag, indent/outdent, column chooser
    with saved layouts.
  - `task-panel.tsx`: replaces `item-drawer` when the flag is on.
  - `split-layout.tsx`: grid plus Gantt with synced scroll and selection.
- **Gantt** (`gantt-view.tsx`):
  - drag in working days; moving a bar later sets Start No Earlier Than
  - an early drag is refused with a message naming the link
  - critical path drawn in Charcoal, contract-date markers, constraint icon
- **What-if:** client-side sandbox state. Apply saves through the same endpoint.
- **Settings → Scheduling** tab: the company calendar and holidays. Job → Schedule → Calendar for job overrides and
  weather/owner/jurisdiction days, with running counts.
- **Excel** (add `exceljs`):
  - `lib/schedules/excel.ts` exports three sheets (Schedule with hidden GUIDs, Calendar, and a formula-shaded Gantt) and
    a blank template.
  - Import parses, matches on GUID, and builds a diff.
  - Routes `app/api/schedules/[id]/export`, `/import` (preview → apply) and `/api/schedule-templates/blank.xlsx`.
- **MCP** (`lib/mcp/tools-ops.ts`):
  - `cmi_schedule_recalc` and `cmi_schedule_what_if` (read-only)
  - `cmi_schedule_critical_path`
  - create/update accept activity IDs and shorthand
  - update `lib/schedules/help.ts`
- **Docs:** `lib/agent/dashboard-guide.ts` (grid, calendars, critical path, Excel) and
  `docs/features/schedule-builder/schedule-engine-plan.md`.

**Build order** (each step usable before the next):
1. Migrations, calendar and engine, with tests.
2. Engine wired into saves, the switch preview and the Gantt drag fix.
3. Grid and panel.
4. Milestones, contract dates and what-if.
5. Excel.

## Verification

- `npm run typecheck`, `npm run lint` and `npm run test` in `apps/cmi-next`.
- **New unit tests:**
  - critical path on textbook networks with known float, all four link types, negative lag, calendar-day tasks across
    holidays and weekends, and constraints
  - loop detection
  - shorthand parse/format round-trip
  - Excel export → import with no changes produces an empty diff
- **New Construction template:** run the engine on it and check the finish (about 207 working days) and the critical
  path. A/V pre-wire should show about 12 days of float, matching `help.ts`.
- **Locally, end to end on a ZZ Test job:**
  - switch the schedule to the engine; the preview shows no unexpected moves
  - in the grid, type a duration or predecessor and watch the ripple
  - toggle Saturdays on the job calendar
  - run a what-if, then discard it
  - export, edit in Excel, re-import; check the diff
- **In the browser with Playwright:** the same flow on the deployed site once Jeremy turns the flag on.
- No outbound messages in Phase 1.
