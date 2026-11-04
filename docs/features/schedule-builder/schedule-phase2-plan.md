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

## Step 3: Three-week lookahead (§7.6). Internal and client versions have no blockers.

- A view plus a one-page branded PDF: this week, next week, the week after, grouped by phase.
  It shows task, trade, start, finish, status, and the selection it waits on.
- Client version: client-visible tasks only.
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

## Step 5: Schedule health tiles (§7.4)

- Forecast vs baseline and vs contract.
- Tasks behind the status date, critical tasks, float on the finish, weather days, late selections.
- Each tile links to the filtered grid. Also shown on the Today page.

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

## Open with Brandon

1. **Friday trade send:** confirm the email plan above (Step 3).
2. **Inspection order** for Scottsdale, Phoenix, Paradise Valley and Maricopa County (Step 8).
3. Whether Slack posting is wanted. It's not connected; the daily log stands in for now.
4. From Phase 1, still open:
   - what CARL is
   - whether July 4 is observed when it falls on a weekend
   - what A/V pre-wire depends on
