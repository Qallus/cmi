// Built-in Workspace templates. Content is Plate JSON; creating from a template copies it.
type Node = { type: string; children: { text: string }[]; checked?: boolean; [key: string]: unknown };
const h = (type: string, text: string): Node => ({ type, children: [{ text }] });
const p = (text = ""): Node => ({ type: "p", children: [{ text }] });
const todo = (text: string): Node => ({ type: "todo_item", checked: false, children: [{ text }] });

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
