# Schedules: Phase 2 ("Field use") plan

Spec: `docs/schedule/CMI_Project-Scheduling-Module_Functional-Spec_2026-11-02_R2.md.txt`, §7, §8 and §9.4.
Phase 1 (engine, calendars, grid, what-if, contract dates, Excel, history) is live behind
`schedule_engine`. Phase 2 builds on it behind a new flag, **`schedule_progress`**, which stays
off until Jeremy turns it on. With the flag off, schedules behave exactly as they do now.

Each step is usable on its own and ships separately.

## Step 1: Progress and status date (spec §7.1). No blockers.

- **Status date** on each schedule (`job_schedules.status_date`, which already exists), shown and
  set from the schedule's action bar.
- **% complete stamps actuals.**
  - Going above 0 sets Actual Start to today (Arizona) unless one was typed, and status
    becomes In progress.
  - 100 sets Actual Finish and status Complete.
  - Typing an Actual Finish sets 100%. Clearing % back to 0 clears the stamps the app made.
- **Remaining duration**: Duration × (1 − %), or a typed value. Editing it moves the forecast,
  not the %.
- **Engine** (`cpm.ts`, P6 "data date" behaviour, per task's own schedule status date):
  - Started, not finished: remaining work runs from the first working day after the status
    date, giving the forecast finish.
  - Not started but planned before the status date: pushed to after it (shown as late).
  - Finished: held on its actual dates.
- **Variance**: forecast finish minus baseline finish, in working days (positive = late). Shown
  in the grid and summarised in the action bar.
- **Grid columns**: Actual start, Actual finish, Remaining, Variance, plus a "Progress" layout.
- **Gantt**:
  - a dashed status-date line
  - the completed part of each bar shaded
  - in-progress bars split at the status date

## Step 2: Weekly update flow and narrative (§7.5). No blockers.

- An **Update** button filters the grid to tasks touching last status date → today.
- Type % or click Done. Tasks that should have started but sit at 0% are flagged: start them,
  or push them with a one-line reason that logs to the job.
- **Finish update** moves the status date to today, recalculates, and shows the new finish,
  what moved and why.
  - Optionally posts the summary to the job's daily log. Slack isn't connected.
- **Narrative**: Bolt drafts the plain-language narrative (progress this period, changes,
  critical path, risks, next two weeks). The PM edits and sends it. Nothing goes out without
  the PM.

**Built (2026-11-06, behind `schedule_progress`):** the schedule's **Update** button opens a side
panel (`components/schedules/weekly-update.tsx`, API `/api/schedules/[id]/update`, logic in
`lib/schedules/weekly-update.ts` + `weekly-update-data.ts`). Push reasons log to
`schedule_activity` (`update_pushed`); Finish update logs `update_finished`. The narrative is
copied or posted to today's Field Report under Internal notes. There's no email send; the PM
shares it themselves.

## Step 3: Three-week lookahead (§7.6). Internal and client versions have no blockers.

- A view plus a one-page branded PDF: this week, next week, the week after, grouped by phase.
  It shows task, trade, start, finish, status, and the selection it waits on.
- Client version: client-visible tasks only.

**Built (2026-11-06, internal and client versions, behind `schedule_progress`):** the schedule's
**Lookahead** button (`components/schedules/lookahead-view.tsx`) and a one-page landscape PDF
(`components/pdf/lookahead-pdf.tsx`, `/api/schedules/[id]/lookahead/pdf?audience=client`). Rows come from
`lib/schedules/lookahead.ts` (with tests). "Waits on" is the task's linked selection, shown red
when it isn't decided before the work starts. The client version leaves out trades, late flags
and selections the client can't see. The trade version and the Friday send are still waiting on Brandon.
- **Trade version and Friday send are decisions for Brandon.**
  - They email outside people automatically: from info@, Reply-To the PM, a Friday-morning
    preview and a hold, through the outbound guard and consent checks.
  - Partners have no login, so it goes as a token link plus a PDF.

## Step 4: Multiple baselines and CO extensions (§7.3). No blockers.

- Baseline 0 is captured at contract and locked.
- Later baselines are numbered and labelled, and include the calendar.
- A picker on the Gantt shows any earlier baseline. Variance reads against the current one.
- A change order carries schedule days. Approving it:
  - adds a Schedule Extension (days, reason, CO)
  - moves the affected contract dates
  - offers a new baseline
- This needs a hook in `updateChangeOrder`, a `schedule_extensions` table and a CO "days" field.

**Built (2026-11-06, a17dece; migration `2026-11-06_schedule_baselines_extensions.sql` applied):**
- Baselines are numbered and Baseline 0 is locked; each keeps the calendar it was captured on.
- A picker beside the Baseline toggle shows earlier baselines.
- `change_orders.schedule_days` is handled in `lib/schedules/extensions.ts`, called from
  `updateChangeOrder`/`createChangeOrder`. It moves open contract milestones on or after the approval
  date, once per CO.
- The Change Orders page shows a banner with Capture new baseline.

## Step 5: Schedule health tiles (§7.4)

- Forecast vs baseline and vs contract.
- Tasks behind the status date, critical tasks, float on the finish, weather days, late selections.
- Each tile links to the filtered grid. Also shown on the Today page.

**Built (2026-11-06):** `lib/schedules/health.ts` (pure, tested) + `health-data.ts`, `/api/schedules/[id]/health`,
`components/schedules/health-tiles.tsx` under the action bar, and a "Schedules needing a look" section on Today.
Each tile opens the list of tasks behind it, and clicking a task opens it. There's no grid filter.
Float on the finish = working days from the forecast finish to the latest contract milestone's contract date (or the target).

## Step 6: Notifications (§7.6)

- Staff assignees are notified N working days before a task starts (default 5, set per job) and
  when its dates move.
- This uses the existing notifier (bell, email, push), which is held outside production.
- Subs follow the Step 3 decision.

## Step 7: Resources (§8)

- A pool of staff plus trades: a trade-partner record, or a generic label like "Electrician"
  that can be converted to a partner in one click.
- Multi-select assignment in the grid.
- Cross-job resource view: weeks across, overlaps highlighted. No levelling.

## Step 8: Remaining Phase 2 items

| Item | Notes |
|---|---|
| Order-by dates | Lead-time task successor start − lead. The "no PO issued" flag waits for POs (Trade Partner Phase 4). |
| Inspection results | A fail inserts Corrections + Re-inspection and re-points successors. The inspection order per jurisdiction is still open with Brandon. |
| WBS and location codes | Grid columns. |
| 11×17 Gantt print | Drafting-style title block, legend, options (full, lookahead, milestones, client). |
| Client milestone page | Contract and client-decision milestones with contract date, forecast and variance. |
| Mobile field update | Tap % or Done from the lookahead on a phone, with a photo or note, through the existing capture flow. |

**Step 8 progress (2026-11-06):**
- **Built:**
  - WBS / Location grid columns (and in Excel).
  - Lead (wd) + Order by columns, with a Procurement layout. Migration `2026-11-06_schedule_lead_times.sql`.
  - 11×17 Gantt print (`components/pdf/gantt-pdf.tsx`, `/api/schedules/[id]/gantt-pdf?view=`).
  - Mobile field update cards in the Lookahead.
- **Steps 6–7 built:** Step 6 is start reminders; Step 7 is resources and the cross-job Resources view.
- **Still open:**
  - The client milestone page waits for Jeremy's uncommitted client-portal work (portal schedule page and layout).
  - Inspection results wait on Brandon (item 2 below).
  - The "no PO issued" flag waits on purchase orders.

## Open with Brandon

1. **Friday trade send:** confirm the email plan above (Step 3).
2. **Inspection order** for Scottsdale, Phoenix, Paradise Valley and Maricopa County (Step 8).
3. Whether Slack posting is wanted. It's not connected; the daily log stands in for now.
4. From Phase 1, still open:
   - what CARL is
   - whether July 4 is observed when it falls on a weekend
   - what A/V pre-wire depends on
