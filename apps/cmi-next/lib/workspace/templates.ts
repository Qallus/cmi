// Built-in Workspace templates. Content is Plate JSON; creating from a template copies it.
type Node = { type: string; children: { text: string }[]; checked?: boolean; [key: string]: unknown };
const h = (type: string, text: string): Node => ({ type, children: [{ text }] });
const p = (text = ""): Node => ({ type: "p", children: [{ text }] });
const todo = (text: string): Node => ({ type: "todo_item", checked: false, children: [{ text }] });
const hr = (): Node => ({ type: "hr", children: [{ text: "" }] });
const bullet = (text = "", indent = 1): Node => ({ type: "p", indent, listStyleType: "disc", children: [{ text }] });
const num = (text = "", indent = 1): Node => ({ type: "p", indent, listStyleType: "decimal", children: [{ text }] });
const quote = (text: string): Node => ({ type: "blockquote", children: [{ text }] });

// --- Live-app block builders (Project Tracker / Kanban / Calendar) ---
// Deterministic ids (no runtime randomness) — unique within a document is all that's required.
let _seq = 0;
const nid = (prefix: string) => `${prefix}-${(_seq += 1)}`;

// MJG brand: gold-stepped + ink; statuses avoid green per brand.
const GOLD = "#C9A46E", BRONZE = "#B58F55", DEEP_GOLD = "#9E7A46", INK = "#3f3a34", RED = "#9B2F2E";
const TRACKER_STATUSES = [
  { label: "Upcoming", color: GOLD },
  { label: "In Progress", color: RED },
  { label: "Complete", color: INK },
];

const trackerRow = (name: string, opts: { owner?: string; status?: string; deadline?: string } = {}) =>
  ({ id: nid("row"), name, home: "workspace", recordId: null, href: null, ownerId: null, ownerName: opts.owner ?? "", status: opts.status ?? null, deadline: opts.deadline ? { date: opts.deadline } : null, attachment: null });
const projectTracker = (rows: ReturnType<typeof trackerRow>[]): Node =>
  ({ type: "project_tracker", statuses: TRACKER_STATUSES, rows, children: [{ text: "" }] });

const card = (text: string) => ({ id: nid("card"), text });
const column = (title: string, color: string, cards: string[] = []) => ({ id: nid("col"), title, color, cards: cards.map(card) });
const kanban = (columns: ReturnType<typeof column>[]): Node =>
  ({ type: "kanban_board", columns, children: [{ text: "" }] });

const calendar = (events: { date: string; title: string }[] = []): Node =>
  ({ type: "doc_calendar", events: events.map((e) => ({ id: nid("ev"), date: e.date, title: e.title, color: RED })), children: [{ text: "" }] });

// Rich Project Tracker builders — custom typed columns + per-row cells (see live-apps.tsx).
const PALETTE = [GOLD, RED, INK, BRONZE, "#7C6F5A", "#4B4844", "#191815"];
const statusSet = (labels: string[]) => labels.map((label, i) => ({ label, color: PALETTE[i % PALETTE.length] }));
type TCol = { id: string; name: string; type: string; options?: { label: string; color: string }[] };
const colDef = (name: string, type: string, options?: string[]): TCol =>
  ({ id: nid("col"), name, type, ...(options ? { options: options.map((label, i) => ({ label, color: PALETTE[i % PALETTE.length] })) } : {}) });
const richRow = (
  name: string,
  o: { owner?: string; status?: string; deadline?: string; home?: string; cells?: Record<string, unknown> } = {},
) => ({ id: nid("row"), name, home: o.home ?? "workspace", recordId: null, href: null, ownerId: null, ownerName: o.owner ?? "", status: o.status ?? null, deadline: o.deadline ? { date: o.deadline } : null, attachment: null, cells: o.cells ?? {} });
const richTracker = (o: { statuses?: { label: string; color: string }[]; columns?: TCol[]; rows: ReturnType<typeof richRow>[] }): Node =>
  ({ type: "project_tracker", statuses: o.statuses ?? TRACKER_STATUSES, columns: o.columns ?? [], rows: o.rows, children: [{ text: "" }] });

// "Weekly Workload Meetings" — the running CMI agenda rebuilt around live-app
// blocks. Built as a function so custom column ids can be referenced by row cells.
function weeklyWorkload(): Node[] {
  // Active projects — Owner/Status/Deadline(default) + Original Completion (date) + Financial (select).
  const apOrig = colDef("Original Completion", "date");
  const apFin = colDef("Financial", "select", ["Paid", "Not Paid", "Contracted", "Pending"]);
  const activeProjects = richTracker({
    statuses: statusSet(["In Progress", "In Process", "Contracted", "Kick Off", "On Hold", "Complete"]),
    columns: [apOrig, apFin],
    rows: [
      richRow("25_062_ Olson Casita", { owner: "Ben", status: "In Progress", cells: { [apOrig.id]: { date: "2026-05-22" }, [apFin.id]: "Paid" } }),
      richRow("24_071_ Lysay Residence", { owner: "YH", status: "In Progress", deadline: "2026-10-22", cells: { [apOrig.id]: { date: "2026-10-01" }, [apFin.id]: "Paid" } }),
      richRow("25_042_ Baxter Residence", { status: "In Progress", cells: { [apOrig.id]: { date: "2026-08-28" }, [apFin.id]: "Not Paid" } }),
      richRow("25_057_ Shepherd of the Desert church", { status: "In Process", cells: { [apFin.id]: "Paid" } }),
      richRow("25_036_ Schluter Art Sales (E Main Gallery)", { status: "In Progress", cells: { [apOrig.id]: { date: "2027-01-15" }, [apFin.id]: "Pending" } }),
      richRow("26_025_ Kendrick Residence (Jenny Nguyen)", { status: "Contracted", cells: { [apOrig.id]: { date: "2026-09-07" }, [apFin.id]: "Contracted" } }),
      richRow("26_016_ Mackay Residence", { status: "Kick Off" }),
      richRow("26_028_ Schott Residence", { status: "Contracted" }),
    ],
  });

  // Action items — Job (text) + Assignees (users); Owner/Status/Deadline are the defaults.
  const aiJob = colDef("Job", "text");
  const aiWho = colDef("Assignees", "user");
  const actionItems = richTracker({
    statuses: statusSet(["Open", "In Progress", "Blocked", "Done"]),
    columns: [aiJob, aiWho],
    rows: [
      richRow("Electrical panel upgrade — permit in process", { status: "In Progress", cells: { [aiJob.id]: "Olson Casita" } }),
      richRow("Final clean — schedule (Mon)", { cells: { [aiJob.id]: "Olson Casita" } }),
      richRow("Substantial completion", { cells: { [aiJob.id]: "Olson Casita" } }),
      richRow("Photograph before move-in", { owner: "Ben", cells: { [aiJob.id]: "Olson Casita" } }),
      richRow("Install mirror", { cells: { [aiJob.id]: "Olson Casita" } }),
      richRow("Patchback", { owner: "Angel", cells: { [aiJob.id]: "Olson Casita" } }),
      richRow("Stair handrail", { cells: { [aiJob.id]: "Lysay Residence" } }),
      richRow("Upstairs HVAC", { cells: { [aiJob.id]: "Lysay Residence" } }),
      richRow("Sierra Pacific — issues", { cells: { [aiJob.id]: "Lysay Residence" } }),
      richRow("COI — Irish man (follow up)", { owner: "YH", cells: { [aiJob.id]: "Lysay Residence" } }),
      richRow("C-top installation begins", { status: "In Progress", deadline: "2026-08-20", cells: { [aiJob.id]: "Baxter Residence" } }),
      richRow("ATC (8/24–8/25)", { deadline: "2026-08-24", cells: { [aiJob.id]: "Baxter Residence" } }),
      richRow("Wallpaper — push out", { cells: { [aiJob.id]: "Baxter Residence" } }),
      richRow("Waiting on permit", { status: "Blocked", cells: { [aiJob.id]: "Shepherd of the Desert" } }),
      richRow("Need Fireline & sprinkler submittals", { cells: { [aiJob.id]: "Schluter Art Sales" } }),
      richRow("APS electrical design", { cells: { [aiJob.id]: "Schluter Art Sales" } }),
      richRow("Sample approval — this week", { cells: { [aiJob.id]: "Kendrick Residence" } }),
      richRow("Bench & light fixture installed", { status: "Done", cells: { [aiJob.id]: "Kendrick Residence" } }),
      richRow("Order mirror (Jocoran measure after demo)", { cells: { [aiJob.id]: "Kendrick Residence" } }),
      richRow("Demo begins", { deadline: "2026-08-19", cells: { [aiJob.id]: "Kendrick Residence" } }),
      richRow("Install brackets", { deadline: "2026-08-20", cells: { [aiJob.id]: "Kendrick Residence" } }),
      richRow("T.K.", { deadline: "2026-08-20", cells: { [aiJob.id]: "Kendrick Residence" } }),
      richRow("Kick off — next Friday", { cells: { [aiJob.id]: "Mackay Residence" } }),
    ],
  });

  // Procurement — Job (text) + Vendor Assignment (date) + Ordered (checkbox) + Bill/Deposit (text).
  const pJob = colDef("Job", "text");
  const pVendorDate = colDef("Vendor Assignment", "date");
  const pOrdered = colDef("Ordered", "checkbox");
  const pBill = colDef("Bill / Deposit", "text");
  const procurement = richTracker({
    statuses: statusSet(["To Order", "Ordered", "Backordered", "Received"]),
    columns: [pJob, pVendorDate, pOrdered, pBill],
    rows: [
      richRow("Sink accessories (YH order items included)", { owner: "YH", status: "To Order", cells: { [pJob.id]: "Lysay Residence" } }),
      richRow("Zia tile", { status: "Backordered", deadline: "2026-09-15", cells: { [pJob.id]: "Lysay Residence" } }),
      richRow("Release RnR — Laundry baskets", { owner: "YH", status: "To Order", cells: { [pJob.id]: "Baxter Residence" } }),
      richRow("Soap dispenser / TP holder", { status: "Ordered", deadline: "2026-09-14", cells: { [pJob.id]: "Kendrick Residence", [pOrdered.id]: true } }),
      richRow("Faucet", { status: "Ordered", deadline: "2026-10-14", cells: { [pJob.id]: "Kendrick Residence", [pOrdered.id]: true } }),
      richRow("Toto", { status: "Ordered", deadline: "2026-10-22", cells: { [pJob.id]: "Kendrick Residence", [pOrdered.id]: true } }),
      richRow("Appliances", { status: "Ordered", cells: { [pJob.id]: "Schott Residence", [pOrdered.id]: true } }),
      richRow("P/O in adaptive — Chris Cabinets", { cells: { [pJob.id]: "Schott Residence", [pBill.id]: "$24,000" } }),
    ],
  });

  // Warranty jobs — Substantial Completion + Warranty Expires (dates) + Notes.
  const wSub = colDef("Substantial Completion", "date");
  const wExp = colDef("Warranty Expires", "date");
  const wNotes = colDef("Notes", "text");
  const warranty = richTracker({
    statuses: statusSet(["Active", "Walk Due", "Complete"]),
    columns: [wSub, wExp, wNotes],
    rows: [
      richRow("25_052_ VCS", { status: "Active", cells: { [wSub.id]: { date: "2025-08-22" }, [wExp.id]: { date: "2027-08-22" }, [wNotes.id]: "1 year walk" } }),
      richRow("24_008_ Gupta Residence", { status: "Active", cells: { [wSub.id]: { date: "2025-03-15" }, [wExp.id]: { date: "2027-03-15" }, [wNotes.id]: "Dream Retreats" } }),
      richRow("22_001_ Conrad Interior", { status: "Walk Due", cells: { [wSub.id]: { date: "2025-07-18" }, [wExp.id]: { date: "2027-07-18" }, [wNotes.id]: "1 year walk — JB Friday" } }),
      richRow("24_058_ Duff Residence", { status: "Active", cells: { [wSub.id]: { date: "2025-06-06" }, [wExp.id]: { date: "2027-06-06" } } }),
      richRow("25_010_ Stein", { status: "Active", cells: { [wSub.id]: { date: "2025-07-18" }, [wExp.id]: { date: "2027-07-18" } } }),
      richRow("24_023_ Ahearn ADU", { status: "Active", cells: { [wSub.id]: { date: "2025-02-14" }, [wExp.id]: { date: "2027-02-14" } } }),
      richRow("24_047_ Gupta landscape", { status: "Active", cells: { [wSub.id]: { date: "2025-04-04" }, [wExp.id]: { date: "2027-04-04" } } }),
      richRow("24_075_ Rosman ADU", { status: "Walk Due", cells: { [wSub.id]: { date: "2025-02-20" }, [wExp.id]: { date: "2027-02-20" }, [wNotes.id]: "6-month call — Ben" } }),
      richRow("24_060_ Stanley Residence", { status: "Active", cells: { [wSub.id]: { date: "2026-02-13" }, [wExp.id]: { date: "2028-02-13" } } }),
      richRow("24_066_ Laidig Residence", { status: "Active", cells: { [wSub.id]: { date: "2026-01-09" }, [wExp.id]: { date: "2028-01-09" } } }),
      richRow("24_031_ Nielsen Residence", { status: "Active", cells: { [wSub.id]: { date: "2026-07-10" }, [wExp.id]: { date: "2028-07-10" } } }),
    ],
  });

  return [
    h("h1", "Weekly Workload Meetings"),
    p("Date: "),
    p("Attendees: "),
    hr(),

    h("h2", "Active Project Status"),
    p("Live status of every active job. Assign an Owner (PM), set Status, Original Completion & Financial; the Deadline column tracks the current completion date. Use the Project ⌄ menu to Connect a row to a CMI Job, and Attachment to add photos or docs."),
    activeProjects,
    hr(),

    h("h2", "Action Items"),
    p("One row per action item — assign staff in Assignees, set a due date (Deadline) and Status, and note the Job. Check them off as they close."),
    actionItems,
    hr(),

    h("h2", "Procurement"),
    p("Products & selections — vendor in Owner, need-by / ETA in Deadline, an Ordered checkbox, and Bill / Deposit."),
    procurement,
    hr(),

    h("h2", "Key Dates"),
    p("Upcoming installs, milestones, procurement ETAs, and out-of-office. Hover a day and click + to add an event."),
    calendar([
      { date: "2026-08-14", title: "Brandon OOO" },
      { date: "2026-08-18", title: "VCS — Counters" },
      { date: "2026-08-19", title: "Kendrick — Demo begins" },
      { date: "2026-08-20", title: "Baxter — C-top install" },
      { date: "2026-08-20", title: "Kendrick — Install brackets" },
      { date: "2026-08-20", title: "Kendrick — T.K." },
      { date: "2026-08-20", title: "VCS — Front Window" },
      { date: "2026-08-24", title: "Baxter — ATC (8/24–8/25)" },
      { date: "2026-09-14", title: "Kendrick — Soap/TP holder ETA" },
      { date: "2026-09-15", title: "Lysay — Zia tile ETA" },
      { date: "2026-10-14", title: "Kendrick — Faucet ETA" },
      { date: "2026-10-22", title: "Kendrick — Toto ETA" },
    ]),
    hr(),

    h("h2", "Sales & Lead Pipeline"),
    p("Drag a card as a job moves from lead → proposal → contracted. Each column's ⋯ menu recolors or renames it."),
    kanban([
      column("Pre-Construction / Design", GOLD, [
        "25_045 Dredge Roig — ID kickoff 7/24; permit by end of Sept (Craydl, RnR)",
        "26_027 Coronado Addition — updated bid/construction set coming (Garth)",
      ]),
      column("Active Budgets / Proposals", BRONZE, [
        "26_001 Bebeau — client to circle back ($1M, Exeter)",
        "26_006 Livak — BF meeting Thursday ($1M–$2M)",
        "26_017 DeConzo — BF follow up",
        "26_030 Lillie — presented",
        "26_034 Hines — meeting tomorrow (Historic remodel, Encanto)",
        "26_035 Waltrup — BF follow up (2nd story, McCormick Ranch)",
        "26_036 McGaffin — BF follow up (Interior remodel, Cactus Corridor)",
        "26_037 Jimenez — BF to work through (Chandler)",
      ]),
      column("Active Leads", RED, [
        "26_013 Garfield Casita — Ben send to contract engineering",
        "26_019 Latino — waiting on client",
        "26_026 Young — waiting on client",
        "26_004 Zack — HOA/architect (pend. design)",
        "26_033 TI Project",
      ]),
      column("Long-Term Leads", INK, [
        "25_003 Weisenburger — client hold (landscape design)",
        "25_026 Harris — F&F, BF building budget",
        "25_031 Rehse — BF follow up (addition)",
        "25_038 Lively — client hold, check Q1",
        "25_047 Kaminsky — reach out later (Guest House + garage)",
        "25_073 Pach — presented initial budget",
        "26_002 Gropler — future purchase (PCH docs)",
        "26_010 Walling",
        "26_012 Donovan — BF/JB budget review Thursday",
        "25_059 Zimber — pre-construction signed",
        "25_072 Waring ADU — LOI sent ($600–$800, Hype Studios)",
        "26_023 Popat — pre-con sent",
      ]),
    ]),
    hr(),

    h("h2", "Angel"),
    todo("Patch back — Olson"),
    todo("Wood ceiling in dining room — Lysay"),
    todo("Paint — Baxter"),
    todo("Stucco Paint — Shepherd of the Desert"),
    todo("Roman Clay — Kendrick"),

    h("h2", "Office Items"),
    todo("Storage Organization — Shed"),
    hr(),

    h("h2", "Warranty Jobs"),
    p("Substantial-completion and warranty-expiration dates. Set Status to “Walk Due” when a 1-year walk or 6-month call is coming up."),
    warranty,
    hr(),

    h("h2", "General Items"),
    num("Builder's Risk Maintenance"),
    bullet("IH4 M320606 00 — 3/13/26 — Olson Casita, 938 W. Moreland Street, Phoenix, AZ 85007", 2),
    bullet("IH4 M342269 00 — 4/06/2026 — Lysay Residence, 8923 N 45th St., Phoenix, AZ 85028", 2),
    bullet("IH4 M405173 00 — 5/28/2026 — Baxter Residence, 6456 E Calle Del Media, Scottsdale, AZ", 2),
    bullet("IH4 M433332 00 — 6/24/26 — Shepherd of the Desert, 9400 E. Mountain View Rd, Scottsdale, AZ 85258", 2),
    bullet("IH4 M458462 00 — 7/17/2026 — VCS Offices, 6900 W Galveston St., Chandler, AZ 85226", 2),
    num("Pre-Lien Maintenance"),
    todo("Olson"),
    todo("Lysay"),
    todo("Baxter"),
    todo("Shepherd of the Desert — Needed"),
    num("Marketing Initiatives / Action Items"),
    todo("Weekly check-in for project details to highlight"),
    todo("Social media"),
    todo("Photography — Nielsen (completed?), Olson"),
    todo("Print marketing upon receiving edited photos — BF to make an ad"),
    num("Networking Events"),
    bullet("Networking Events (Attended)", 2),
    bullet("Industry Partners Meetings", 2),
    bullet("Industry Professionals for Intros", 2),
    num("Company Items"),
    todo("Daily Logs"),
    todo("August Timecard (END OF MONTH)"),
    bullet("Out of Office — enter in Intuit for approval / tracking:", 2),
    bullet("Brandon — Aug 14; Sep 14–18; Sep 30–Oct 2 (Havasupai); Dec 3–8 (Elk Hunt)", 3),
    bullet("Joe — Oct 15–23 (North Dakota)", 3),
    bullet("Ben · Angel · Yovana", 3),
    num("Safety Focus Items — JB"),
    bullet("Safety Consultant", 2),
    bullet("CPR / First Aid — Local 493 Trustee: $40/person CPR/AED (2–2.5 hrs); $50/person CPR/AED + First Aid (2.5–3 hrs); AHA certs valid 2 years; 8-student minimum", 2),
    bullet("OSHA 10 — Angel (BF: next session?)", 2),
    num("Rotation Topics"),
    bullet("Close-out Manuals (Nielsen / Olson)", 2),
    bullet("Wallpaper installers — good ones", 2),
    bullet("Award submissions — jobs to submit: Duff Residence, Rosman ADU, Osborn Drive", 2),
    num("Upcoming Community Events"),
    num("Constructed Matter Events"),
    hr(),

    h("h2", "Goals // 2026"),
    todo("TBD"),
  ];
}

export type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  content: Node[];
};

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "blank",
    name: "Blank document",
    description: "Start from scratch.",
    category: "General",
    content: [p("")],
  },
  {
    id: "meeting-notes",
    name: "Client Meeting Notes",
    description: "Capture a client conversation, decisions, and follow-ups.",
    category: "Meetings",
    content: [
      h("h1", "Client Meeting Notes"),
      p("Date: "),
      p("Attendees: "),
      h("h2", "Purpose"),
      p(""),
      h("h2", "Discussion"),
      p(""),
      h("h2", "Decisions"),
      p(""),
      h("h2", "Follow-up tasks"),
      todo(""),
      todo(""),
      h("h2", "Next appointment"),
      p(""),
    ],
  },
  {
    id: "blueprint-review",
    name: "Stewardship Blueprint Review",
    description: "Review a client's Blueprint across the key areas.",
    category: "Stewardship",
    content: [
      h("h1", "Stewardship Blueprint Review"),
      p("Client: "),
      p("Completion status: "),
      h("h2", "Faith"),
      p(""),
      h("h2", "Family"),
      p(""),
      h("h2", "Finances"),
      p(""),
      h("h2", "Future"),
      p(""),
      h("h2", "Advisor observations"),
      p(""),
      h("h2", "Recommended next steps"),
      todo(""),
      todo(""),
    ],
  },
  {
    id: "onboarding",
    name: "New Client Onboarding",
    description: "Onboard a new client with a checklist.",
    category: "Stewardship",
    content: [
      h("h1", "New Client Onboarding"),
      p("Client: "),
      p("Assigned advisor: "),
      h("h2", "Onboarding checklist"),
      todo("Welcome communication sent"),
      todo("Required documents collected"),
      todo("Account access set up"),
      todo("First appointment scheduled"),
      h("h2", "Open questions"),
      p(""),
    ],
  },
  {
    id: "team-agenda",
    name: "Team Meeting Agenda",
    description: "Run a focused team meeting.",
    category: "Meetings",
    content: [
      h("h1", "Team Meeting Agenda"),
      p("Date: "),
      p("Attendees: "),
      h("h2", "Updates"),
      p(""),
      h("h2", "Discussion topics"),
      p(""),
      h("h2", "Decisions"),
      p(""),
      h("h2", "Assigned actions"),
      todo(""),
      h("h2", "Next meeting"),
      p(""),
    ],
  },
  {
    id: "team-meeting-review",
    name: "Team Meeting Review",
    description: "Live team-meeting overview of every active job — status, dates, financials, issues, action items, and procurement.",
    category: "Meetings",
    content: [
      h("h1", "Team Meeting Review"),
      p("Meeting Date & Time: "),
      p("Project Coordinator: "),
      p("Attendees: "),
      hr(),

      h("h2", "Jobs Overview"),
      p("At-a-glance status of every active job. Owner = PM · Deadline = current completion date. Use “Add row” for each job and the Owner column to assign a PM."),
      projectTracker([
        trackerRow("Job — ", { status: "In Progress" }),
        trackerRow("Job — ", { status: "Upcoming" }),
      ]),
      hr(),

      h("h2", "Job Review"),
      quote("Duplicate this Job Review section for each active job discussed."),
      p("Job Name: "),
      p("Job Number: "),
      p("Status: "),
      p("Original Completion Date: "),
      p("Current Completion Date: "),
      p("Financial Status (as of date & time): "),

      h("h3", "Issues"),
      bullet(""),
      bullet(""),

      h("h3", "Action Items"),
      p("Add an item per row, assign staff/contacts in Owner (type a name or add a Users / Connect column for a CMI contact), and set a due date + status."),
      projectTracker([
        trackerRow("", { status: "Upcoming" }),
        trackerRow("", { status: "Upcoming" }),
      ]),

      h("h3", "Procurement"),
      p("Track products & selections — assign a vendor in Owner, set selection/install dates in Deadline, and use “Add column” for Vendor Assignment Date and Bill/Deposit."),
      projectTracker([
        trackerRow("Product / selection — ", { status: "Upcoming" }),
        trackerRow("Product / selection — ", { status: "Upcoming" }),
      ]),
      bullet("Product / selection & dates: "),
      bullet("Install: "),
      bullet("Vendor assignment date: "),
      bullet("Bill / deposit (selection / product): "),

      h("h3", "Notes"),
      p(""),
    ],
  },
  {
    id: "weekly-workload-meetings",
    name: "Weekly Workload Meetings",
    description: "CMI's weekly workload agenda, modernized — live Project Trackers, a pipeline Kanban, and a key-dates Calendar.",
    category: "Meetings",
    content: weeklyWorkload(),
  },
  {
    id: "event-planning",
    name: "Event Planning",
    description: "Plan an event end to end.",
    category: "Marketing",
    content: [
      h("h1", "Event Planning"),
      h("h2", "Overview"),
      p("Date & venue: "),
      p("Registration goal: "),
      h("h2", "Tasks"),
      todo("Invite list"),
      todo("Marketing"),
      todo("Assets"),
      todo("Speakers"),
      h("h2", "Day-of checklist"),
      todo(""),
      h("h2", "Follow-up"),
      p(""),
    ],
  },
  {
    id: "sop",
    name: "Process / SOP",
    description: "Document a standard operating procedure.",
    category: "Operations",
    content: [
      h("h1", "Standard Operating Procedure"),
      p("Purpose: "),
      p("Owner: "),
      h("h2", "Steps"),
      todo(""),
      todo(""),
      h("h2", "Related files"),
      p(""),
      p("Review date: "),
    ],
  },

  // ---- New templates using the live-app blocks (Project Tracker / Kanban / Calendar) ----
  {
    id: "client-project-tracker",
    name: "Client Project Tracker",
    description: "Track a client's projects with owners, statuses, deadlines, and files.",
    category: "Stewardship",
    content: [
      h("h1", "Client Project Tracker"),
      p("Client: "),
      p("Advisor: "),
      h("h2", "Projects"),
      projectTracker([
        trackerRow("Stewardship Blueprint", { status: "In Progress" }),
        trackerRow("Financial plan draft", { status: "Upcoming" }),
        trackerRow("Annual review", { status: "Upcoming" }),
      ]),
      h("h2", "Notes"),
      p(""),
      h("h2", "Follow-ups"),
      todo(""),
    ],
  },
  {
    id: "six-week-challenge",
    name: "6-Week Challenge Planner",
    description: "Plan a 6-Week Challenge cohort — session calendar, weekly prep board, and checklist.",
    category: "Experiences",
    content: [
      h("h1", "6-Week Challenge Planner"),
      p("Cohort / group: "),
      p("Start date: "),
      h("h2", "Session calendar"),
      calendar(),
      h("h2", "Weekly prep"),
      kanban([
        column("To prepare", GOLD, ["Week 1 email", "Week 1 materials"]),
        column("In progress", BRONZE),
        column("Sent", DEEP_GOLD),
      ]),
      h("h2", "Facilitator checklist"),
      todo("Confirm roster"),
      todo("Schedule the six sessions"),
      todo("Send the welcome message"),
    ],
  },
  {
    id: "content-pipeline",
    name: "Content & Blog Pipeline",
    description: "Move blog and social content from idea to published, with a schedule.",
    category: "Marketing",
    content: [
      h("h1", "Content & Blog Pipeline"),
      p("Owner: "),
      h("h2", "Pipeline"),
      kanban([
        column("Ideas", GOLD, ["Blog: stewardship basics", "Social: client testimony"]),
        column("Drafting", BRONZE),
        column("Review", DEEP_GOLD),
        column("Published", INK),
      ]),
      h("h2", "Scheduled pieces"),
      projectTracker([
        trackerRow("Blog post", { status: "Upcoming" }),
        trackerRow("Newsletter", { status: "Upcoming" }),
      ]),
      h("h2", "Publishing calendar"),
      calendar(),
    ],
  },
  {
    id: "event-speaking-planner",
    name: "Event & Speaking Planner",
    description: "Plan an event or speaking engagement — key dates, task owners, and a day-of checklist.",
    category: "Marketing",
    content: [
      h("h1", "Event & Speaking Planner"),
      p("Event: "),
      p("Date & venue: "),
      h("h2", "Key dates"),
      calendar(),
      h("h2", "Tasks"),
      projectTracker([
        trackerRow("Confirm venue", { status: "In Progress" }),
        trackerRow("Promote event", { status: "Upcoming" }),
        trackerRow("Prepare the talk", { status: "Upcoming" }),
      ]),
      h("h2", "Day-of checklist"),
      todo("A/V check"),
      todo("Materials printed"),
      todo("Registration table ready"),
    ],
  },
  {
    id: "quarterly-goals",
    name: "Quarterly Goals & Initiatives",
    description: "Set quarterly goals with owners and track initiatives on a board.",
    category: "Operations",
    content: [
      h("h1", "Quarterly Goals & Initiatives"),
      p("Quarter: "),
      h("h2", "Goals"),
      projectTracker([
        trackerRow("Grow the client base", { status: "In Progress" }),
        trackerRow("Launch a new experience", { status: "Upcoming" }),
        trackerRow("Hold a steady content cadence", { status: "Upcoming" }),
      ]),
      h("h2", "Initiatives"),
      kanban([
        column("Planned", GOLD),
        column("Active", BRONZE),
        column("Done", DEEP_GOLD),
      ]),
      h("h2", "Notes"),
      p(""),
    ],
  },
  {
    id: "facilitator-cohort",
    name: "Facilitator Cohort Board",
    description: "Lead a cohort — participants by stage, a session schedule, and follow-ups.",
    category: "Experiences",
    content: [
      h("h1", "Facilitator Cohort Board"),
      p("Facilitator: "),
      p("Cohort: "),
      h("h2", "Participants by stage"),
      kanban([
        column("Invited", GOLD),
        column("Active", BRONZE),
        column("Completed", DEEP_GOLD),
      ]),
      h("h2", "Session schedule"),
      calendar(),
      h("h2", "Follow-ups"),
      projectTracker([
        trackerRow("Weekly check-in", { status: "Upcoming" }),
      ]),
    ],
  },
];

export function getTemplateContent(id: string): Node[] | null {
  return WORKSPACE_TEMPLATES.find((t) => t.id === id)?.content ?? null;
}
