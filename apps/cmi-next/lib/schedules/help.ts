// How Schedules work, in plain words, for Claude (cmi_schedule_help) to explain
// to staff and to walk them through setting one up. Keep it in step with the
// dashboard (and lib/agent/dashboard-guide.ts) when the Schedules feature changes.

export type HelpTopic =
  | "overview" | "setup" | "templates" | "dates" | "views" | "inside" | "links"
  | "master_packages" | "client" | "permissions" | "claude" | "faq";

export const SCHEDULE_HELP: Record<HelpTopic, { title: string; body: string }> = {
  overview: {
    title: "What Schedules are",
    body: `A job can have many schedules (Construction, Design, Permitting, Procurement, Selections, Inspections, Closeout, Warranty, or a room or trade), each with phases, tasks and milestones (◆). One schedule can be the job's Master Schedule.
Where to find them: a job → Schedule tab (that job's schedules), or Sidebar → Jobs → Schedules (every schedule across all jobs, with counts for at-risk, delayed, due today/this week, overdue and waiting items).
The Schedules list sorts by any column header; tick schedules for quick actions at the bottom (Status, Health, Archive, Delete).`,
  },
  setup: {
    title: "Setting up a schedule (step by step)",
    body: `1. Add Schedule (Schedules page top right, or the job's Schedule tab).
2. Start step: on the Schedules page choose what it's for (a Job; with the Schedule Builder also a Pipeline deal, Pre-Con record or Selection) and pick it.
3. Start from: Template (New Construction is first), Blank, or Copy another schedule on the same job.
   With a template: pick the Start date (it shows the Estimated finish), then choose what happens when a date changes: "Move the tasks that follow it" (linked tasks shift automatically) or "I'll adjust dates myself" (only the task you edit moves).
4. Details: name (filled from the template), type, priority, owner, manager, target completion, Master Schedule, and (Schedule Builder) which schedule it sits inside.
5. Work Calendar: which weekdays are working days (Mon–Fri by default). Template spacing and date moves count only these days.
6. Visibility: Internal only, Client visible, Vendor visible or Contractor visible.
7. Review → Create Schedule. You land on the schedule with every task laid out.
Questions to ask the person before setting one up: which job (or deal / Pre-Con / selection)? which template, or blank? what start date? should linked tasks move automatically? any schedules inside it (e.g. Customer, Vendor, Trade Partner)? make it the Master?`,
  },
  templates: {
    title: "Templates",
    body: `Built-in templates: New Construction (76 tasks in 9 phases, site visit and contract → design and permits → site, framing, MEP → finishes → final walkthrough, about 207 working days, built from CMI's BuilderTrend schedule), Construction, Pre-Construction, Design, Permitting, Procurement, Client Selections, Inspections, Closeout and Warranty.
New Construction keeps the original task order, durations, links and lags in working days, so any start date lays it out with the same spacing. Tasks assigned in the original (e.g. Receive Signed Contract → Brandon Fadden and Joseph Ballard) are assigned to those staff.
Packages create several schedules at once: Custom Home, Renovation, ADU / Addition (Package button on a job's Schedule tab; set the start date first).`,
  },
  dates: {
    title: "Dates, links and moving things",
    body: `Links (dependencies): a task can wait for another — Finish→Start (most common), Start→Start, Finish→Finish, Start→Finish — with a lag in working days (can be negative, e.g. start 3 days before the other finishes). Add them in a task's editor or with Link on the Gantt.
Moving a task (drag on the Gantt, or edit its dates): when "move the tasks that follow it" is on, every linked task after it moves by the same working days; the banner says how many moved. Tasks only move later, never earlier, and locked tasks stay put. Slack is respected: if a later task already has room, it doesn't move.
"I'll adjust dates myself": links stay as a reference but nothing moves automatically.
Shift dates (button on a schedule): moves the whole schedule to a new start date; every task keeps its length and spacing; preview first; complete and locked tasks stay unless you include them.
Baselines: Capture baseline saves today's plan; turn on Baseline on the Gantt to see planned vs current.`,
  },
  views: {
    title: "Views",
    body: `Gantt (drag to move or resize, links drawn, milestones, today line, baseline, critical items), Timeline (Gantt by month, grouped by schedule), List, Table, Cards, Calendar (day/week/month/year), Kanban (by status or priority) and Resource (by assignee, flags double-booking). Tick several schedules in the schedule picker to overlay them. PDF prints a branded schedule.`,
  },
  inside: {
    title: "Schedules inside schedules (Schedule Builder)",
    body: `A schedule can hold other schedules, as many levels as needed — e.g. a Master with Customer, Vendor and Trade Partner schedules inside, or Install with Demo, Electrical, Windows and Doors inside. On a schedule click "Add inside", or choose "Inside" on the Details step. The schedule picker shows them indented. Archiving a schedule archives everything inside it; deleting deletes them. Schedules can also belong to a Pipeline deal, a Pre-Con record or a selection (Schedules page → Add Schedule → Schedule for); when Pre-Con becomes a job, its schedules (and its deal's) move to the job.`,
  },
  links: {
    title: "Linking a task to a record (Schedule Builder)",
    body: `In a task, "Linked to" points it at a Pipeline deal, job, Pre-Con, vendor or trade partner, contact, selection, project, punch list or another schedule (e.g. "Install Windows" → the window vendor, "Cabinet decision due" → the selection, "Install" → the Install schedule). The list shows a ↗ tag that opens the record, and the record's page lists it under Schedules (deal page; Pre-Con → Punch List tab).`,
  },
  master_packages: {
    title: "Master Schedule",
    body: `One schedule per job (or deal / Pre-Con / selection) can be the Master (★): tick "Designate as Master" when creating it, or Make Master on the schedule. A schedule inside another can't be the Master. Each task has a "show on Master" setting (inherit, don't show, milestones only, when critical, always).`,
  },
  client: {
    title: "What clients see",
    body: `Only schedules marked Client visible, and only their client-visible tasks, appear in the client portal's Schedule tab (internal notes never show). Set it on the Visibility step or per task ("Client visible"). Whether a client sees the schedule at all is also set per contact under Job Info → Clients → Portal permissions.`,
  },
  permissions: {
    title: "Who can do what",
    body: `View: Super Admin, Admin, Project Manager, Superintendent, Estimator, Designer, Staff. Create and edit: Super Admin, Admin, Project Manager, Superintendent, Estimator. Make Master, capture baselines and delete schedules: Super Admin, Admin, Project Manager. Assignees get a notification when they're assigned or a schedule they're on moves.`,
  },
  claude: {
    title: "What Claude can do with schedules",
    body: `List schedules and tasks (late, this week, by date), explain this guide, create a schedule from a template on a start date (with schedules inside it), apply a package, add or update tasks and assign staff, link tasks to each other or to records, shift a whole schedule (shows a preview first), and change a schedule's name, status, priority, target date or Master. Claude doesn't delete schedules.`,
  },
  faq: {
    title: "Common questions",
    body: `Why didn't the finish date move when I pushed a task? The tasks after it had slack (in New Construction, A/V pre-wire has no predecessor and leaves about 12 working days of float before the Pre-Drywall Scan), or linked tasks are set to "I'll adjust dates myself".
Why did a task skip a day? Only working days count (see Work Calendar); weekends are skipped.
How do I start over on a different date? Shift dates on the schedule.
I applied a package twice — how do I undo? Tick the extra schedules on the Schedules page → Archive.
Where's the template? Add Schedule → Start → Template (first option).`,
  },
};

export const HELP_TOPICS = Object.keys(SCHEDULE_HELP) as HelpTopic[];
