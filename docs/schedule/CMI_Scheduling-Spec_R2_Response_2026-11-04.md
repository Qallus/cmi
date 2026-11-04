# Scheduling Module Spec R2: response

To: Brandon Fadden · From: Jeremy · Nov 4, 2026
Re: *Project Scheduling Module, Functional Specification R2 (Nov 2, 2026)*

I checked the spec against the code and the live database. The direction is right, and so is the phase order. Phase 1
(calendars, critical path and the grid) is what everything else depends on. Below are a few corrections to the "what we
have" inventory, some things the spec assumes that don't exist yet, decisions I'd like us to agree on before building,
answers to Section 15, and the effort estimate.

---

## 1. Corrections to §2 and §3 (what we have today)

| Spec says | What's actually there |
|---|---|
| Critical path "flagged, not computed" | Correct. "Critical" is a checkbox on the task today; nothing calculates it. |
| "Existing float is respected" | Only in one direction. When a task moves, the tasks after it are pushed later, and a task that already has room is left alone. Nothing is ever pulled earlier, and no float number is calculated or shown. |
| % complete: "status only" | We already store % complete per task (a slider in the task editor). We don't have actual start/finish dates or remaining duration. |
| Baselines: single | Every baseline capture is already saved, with name, reason and approver. The Gantt only shows the latest one. Multiple baselines is a smaller job than §7.3 suggests. |
| Table view | Read-only. The grid is new work, not an upgrade of the Table view. |
| Gantt drag | Dragging a bar counts calendar days on screen, then the server re-spaces the following tasks in working days. Phase 1 fixes that, so the drag uses working days throughout. |
| Resource view: staff only | Tasks can already be assigned to vendors and contractors as well as staff. Only staff get notified. |
| Calendar | One working-weekdays setting per schedule. The date math already has a slot for holidays, but nothing fills it yet. |

## 2. What the spec assumes that we don't have yet

None of these block Phase 1, but Phases 2 and 3 depend on them:

| Assumed | Reality | What I'd do |
|---|---|---|
| Adaptive budget lines / cost codes on a job | Not connected. The Adaptive integration is waiting on API credentials. We do have the trade → cost code list from the trade partner work. | Phase 1 gives each task a **cost code** field that matches that list. It becomes a real budget-line link once Adaptive is connected. The AI builder's "from budget" step (§9) needs Adaptive. |
| Procurement dashboard / POs | Not built. POs are an outline in Trade Partner Phase 4. | Order-by dates can be calculated and flagged in Phase 2. The "no PO issued by that date" check waits for POs. |
| Trade partner portal showing a partner's tasks | Partners don't have a login. The application uses a secure link. | The trade lookahead (§7.6) goes out as a secure link plus a PDF. A partner login is a separate project. |
| Per-job Slack channels | No Slack integration. | Weekly update summaries post to the job's daily log and the bell. Slack later, if wanted. |
| CARL (durations from history) | Not in the system. | Phase 3 starts recording actual durations as soon as Phase 2 is live. **What is CARL?** If it's an existing tool, we need to know how to reach it. |
| Inspections / jurisdictions | Nothing beyond the inspection template rows. | Inspection milestones get jurisdiction, type and result in Phase 2. |
| Change order approval drives schedule days | Change orders exist, but approving one only changes its status. Nothing else happens. | Phase 2 adds the "approved → schedule extension → new baseline" step. |
| Selection decision dates | Exist (decision, order, delivery and install target dates). | Ready to use as predecessors. |
| Today tiles, daily log, punch list % closed, mobile capture | All exist. | Usable as written. |

## 3. Decisions to agree before building

1. **Turning on two-way auto-scheduling for existing schedules (§6.2).** With a true critical path, a task with no
   predecessor or constraint moves to the schedule start. Switching it on for a live schedule could pull dates earlier
   all over. So switching a schedule to the new engine is an explicit step with a before/after preview, like Shift Dates.
   Any task that currently sits later than the engine would put it gets a *Start No Earlier Than* constraint at its
   current date. Nothing moves unless the PM accepts it.
2. **The critical path crosses schedules.** Tasks already link across a job's schedules (for example Procurement →
   Construction). The engine calculates the whole job, not one schedule at a time, so the critical path doesn't stop at
   a schedule boundary.
3. **Calendar levels.** Company → job → task, as written. Deal, Pre-Con and selection schedules have no job, so for them
   the middle level is the schedule itself. **A lag counts in the successor's calendar** (P6's default). Worth stating
   in the spec.
4. **Activity IDs.** Existing schedules get IDs by tens in their current order (10, 20, 30…). Row order and ID are
   independent, as §4.3 says.
5. **Friday send to trade partners.** This emails outside companies automatically. It goes from info@ with Reply-To set
   to the PM, only after the PM's Friday-morning preview (with a Hold button), and through the same opt-out and
   suppression checks as all other outbound messages.
6. **Excel re-import never deletes silently.** As written. Missing rows are offered as deletions in the preview.

## 3a. First results from the engine

The critical-path engine and the calendars are built and tested; nothing is switched on yet. Running our New
Construction template through the engine already turned up three things:

- **The critical path runs through A/V Pre-Wire.** That task has no predecessor, so it keeps its original date as a
  constraint. That date then drives the Pre-Drywall Scan, inspection, insulation, drywall and the rest of the finishes.
  On a real job, A/V pre-wire follows framing or rough electrical.
  - **Question for you:** what should A/V pre-wire hang off, and with what lag?
  - This is exactly the "orphan" report from §6.1, and it applies to every template.
- **The template has about 6 working days of slack along its links.** The original Buildertrend job had gaps between
  linked tasks that no link explains, probably holidays or real delays. Laid out by its links alone, the template
  finishes in about **200 working days, not 207**. The engine never puts a task later than the template does; it only
  closes those gaps.
- **§5.2 example.** "A 10-day task starting Friday finishes the second Friday after." Counting the Friday as day 1,
  it finishes on the **Thursday** of the week after next. This matches P6, where the task ends at close of business on
  Thursday. We count the start day as day 1, which is how the current module and the template already work.

## 4. Answers to Section 15

**Grid component.** Build our own. A schedule is under 500 rows, so we don't need a big-data grid. The hard parts are
specific to us: the phase outline (indent, collapse), staying row-for-row in step with our Gantt, and the "ripple" flash.
Those are easier with full control. AG Grid's free version lacks tree rows and fill-down; the paid version is about
$1,000+ per developer per year. Handsontable needs a commercial license. Excel-style keyboard, paste, fill-down and a
50-step undo are about a week of the Phase 1 work. If the feel isn't right in testing, AG Grid's paid version is the
fallback.

**Where the critical-path engine runs.** Both, from the same code. The browser runs it on every keystroke, which gives
the instant ripple and the what-if sandbox. The server runs the same code again on save and stores the dates, float and
critical flags. That makes the server the source of truth, and Claude uses the same engine.

**Holiday list.** Seed it in **Settings → Scheduling** from your list in §5. Admins maintain it once a year. The handbook
isn't in the dashboard, so Settings is the single source.

**Trade partner portal.** It doesn't show tasks today, and partners don't log in. The lookahead is a new page reached by
a secure link, plus a PDF.

**Inspection chains.** Start with Scottsdale and Phoenix. Each chain is data, not code, so Paradise Valley and Maricopa
County are a quick addition once someone writes down their inspection order.

**Friday lookahead send.** By email from info@ with Reply-To set to the PM, with the preview and hold. There's no portal
for partners yet, so it can't be portal-only.

**Effort.** Weeks of build time, including testing, alongside other dashboard work:

| Phase | Scope | Estimate | Waiting on |
|---|---|---|---|
| **1. Engine and grid** | Company/job calendars with typed exceptions; calendar-day tasks; critical path with float; grid (IDs by tens, predecessor shorthand, paste, undo); task panel; Gantt drag rules; milestone types and contract dates; what-if; Excel export, re-import and blank template | **6–8 weeks** | Nothing. Can start now. |
| **2. Field use** | Status date; weekly update and narrative; 3-week lookahead (internal, trade, client) and Friday send; notifications; mobile update; constraints; resource pool and cross-job view; multiple baselines and CO extensions; order-by dates; inspection results; WBS and location codes; 11x17 print | **7–9 weeks** | POs (for the PO check); Adaptive (budget links) |
| **3. Intelligence** | AI builder panel; sequencing library and lint; save as template with versions; durations from history | **4–6 weeks** | Adaptive budget lines; a few months of Phase 2 actuals for history |

**Total: roughly 4–6 months for all three phases.**

## 5. How Phase 1 rolls out

- Everything is behind a feature flag (`schedule_engine`) that stays off until you and Ben have tried it. With it off,
  Schedules work exactly as they do today.
- Each schedule switches to the new engine individually, with a preview.
- Build order, each step usable before the next:
  1. Calendars and the engine
  2. Engine on saves, plus the Gantt drag fix
  3. Grid and task panel
  4. Milestones, contract dates and what-if
  5. Excel
- Claude gets the same engine: recalc, what-if and "what's critical on this job".

**Questions back to you:**

1. What is CARL?
2. Who will write down the Scottsdale and Phoenix inspection order?
3. Is the §5 holiday list exactly what we observe, Christmas Eve through New Year's Day? July 4 falls on a Saturday in
   2026 and a Sunday in 2027. Do we take the Friday (Jul 3, 2026) and the Monday (Jul 5, 2027) off? The seeded calendar
   doesn't include them yet.
4. What should A/V pre-wire depend on in the New Construction template?
