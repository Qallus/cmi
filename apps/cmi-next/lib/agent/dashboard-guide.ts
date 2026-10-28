// Bolt's map of the CMI dashboard: every area, where it is, how to get there,
// and step-by-step directions for the common jobs. Bolt looks entries up with
// the dashboard_help tool so it can answer "how do I…" and "where is…" with
// accurate directions and a link.
//
// Keep this in step with components/dashboard/nav.tsx and the features
// themselves. Paths are relative; the tool makes them absolute.

export type GuideEntry = {
  id: string;
  name: string;
  path: string;
  /** How to reach it from the sidebar (desktop) or the phone's bottom menu. */
  nav: string;
  /** Who can use it, when it isn't every staff role. */
  roles?: string;
  summary: string;
  steps?: string[];
  keywords: string[];
};

export const GLOSSARY = [
  "Contact: any person in the CRM (Contacts). Its Type says what they are: Lead, Client, Prospect, Customer, Vendor, Sub Contractor, Designer or Other.",
  "Lead: a Contact whose Type is Lead (Contacts → Leads tab). 'How many leads' means count contacts with type Lead, not quotes.",
  "Quote: an estimate request from the website's quote form (Quotes & Leads page).",
  "Deal: an early sales opportunity in the Pipeline (stages New/Working → Contacted → Qualified → Opportunity → Proposal → Negotiation → Closed Won / Lost-On Hold). A deal gets its number when it's marked Closed Won and moves into Pre-Con.",
  "Pre-Con: the pre-construction stage after a deal is Closed Won (Pre-Con page, numbers like CM-2026-0007). Stages: Opportunity → Active Budget → Pre-Construction / Design → Active Project → Warranty → Closed.",
  "Job: an active construction project (Jobs), numbered like 26_001_Name, with its own Summary, Schedule, Daily Logs, Files, Selections, Change Orders, Invoices and Client Portal.",
  "Daily Log: a record of a day on site for a Job or a Pre-Con project. Weather fills in automatically. Types: Standard (written), Photos, Voice (transcribed recordings).",
  "Morning Briefing: each staff member's 6 AM Arizona email (Monday to Friday) plus the Today page.",
];

export const DASHBOARD_GUIDE: GuideEntry[] = [
  // ── Everyday ──
  {
    id: "overview", name: "Overview", path: "/dashboard/overview", nav: "Sidebar → Overview",
    summary: "A snapshot of the business: counts of contacts, projects, bookings, quotes, leads, documents and staff, recent activity, the revenue outlook and quick actions.",
    keywords: ["overview", "home", "dashboard", "snapshot", "stats", "summary"],
  },
  {
    id: "today", name: "Today page & Morning Briefing", path: "/dashboard/today", nav: "Sidebar → Today",
    summary: "Your day on one page: an AI summary, today's meetings, overdue / due-today / this-week tasks, what's waiting on you and overnight changes to your jobs and deals. The same content is emailed at 6 AM Arizona time, Monday to Friday. The greeting follows the time of day.",
    keywords: ["today", "briefing", "morning", "daily summary", "my day", "agenda", "what's due"],
  },

  // ── Contacts & sales ──
  {
    id: "contacts", name: "Contacts", path: "/dashboard/contacts", nav: "Sidebar → Contacts",
    roles: "Super Admin, Admin, Project Manager, Estimator",
    summary: "The CRM: every person, with tabs by type (Leads, Clients, Prospects, Vendors, Designers…), search, bulk actions, duplicate finder, CSV import/export. Open a contact to call, text, email, see the deals they're on and assign them to a deal.",
    steps: [
      "Add a contact: Contacts → Add Contact → fill in name, email, phone, type → Save.",
      "See leads: Contacts → the Leads tab.",
      "Assign a contact to an existing deal: open the contact → Pipeline deals → Assign to Pipeline → pick the deal and their role → Assign.",
      "Start a new deal from a contact: open the contact → More (…) → + Pipeline.",
      "Choose which columns the table shows: Contacts → View options (next to the view buttons) → tick or untick Email, Phone, Company, Lead Owner, Type, Status, Tags, Source, City / State, Last Activity, Created. Reset to default restores the standard set; the choice is remembered in your browser. Scroll the table sideways for more columns.",
    ],
    keywords: ["contacts", "crm", "people", "leads", "clients", "add contact", "import", "duplicates", "assign to pipeline"],
  },
  {
    id: "trade-partners", name: "Trade Partners", path: "/dashboard/trade-partners", nav: "Sidebar → Contacts → Trade Partners",
    summary: "Trade partner (subcontractor) prequalification applications, the company directory, compliance documents, qualification interviews and Setup (the Master Subcontractor Agreement applicants sign online, and the trade → cost code map). Applicants start at constructedmatter.com/become-a-trade-partner or the trade partner path on the Contact page.",
    steps: [
      "Review an application: Trade Partners → open it → Approve as trade partner (emails the onboarding guide), Decline (reason required; moves to Archive), Schedule follow-up meeting or Follow up: missing documents (each opens an editable email draft; nothing sends until you click Send).",
      "Upload a document a sub emailed in: open the application → Documents → Upload / Replace on that document.",
      "Export the partner list to Excel (cost codes, 1099 structure, contacts by role, document status): Trade Partners → Directory → Export to Excel.",
      "Attach the onboarding guide to approval emails: Trade Partners → Setup → Trade Partner Onboarding Guide → Upload PDF.",
      "Subs send missing or renewed documents from the link in our emails (constructedmatter.com/prequalification/documents). Incomplete applications with no activity for 90 days move to Archive automatically.",
      "Upload a new MSA version: Trade Partners → Setup → choose the PDF → Upload as current. New applicants sign that version.",
      "Countersign a signed MSA: Trade Partners → open the application → Master Subcontractor Agreement → Countersign (or Setup → Signed agreements). The executed PDF is emailed to the sub.",
      "Map trades to cost codes: Trade Partners → Setup → Trade cost codes → enter codes → Save.",
      "Clean up duplicates: Trade Partners → Directory → Duplicates → Keep first / Keep second (the other is archived, not deleted).",
      "See companies that were only a contact's employer: Trade Partners → Directory → tick Show non-partner companies.",
      "Claude reads each uploaded COI, W-9 and license automatically: open the application → Documents shows the coverage lines, limits, expiry and anything below our minimums. Check it, then Verify. Re-read runs it again.",
      "Download the master insurance list (every coverage line, soonest expiry first): Trade Partners → Directory → Insurance tracking (top right).",
      "Switch Directory views with the icons at the right of the filter bar: Table, List, Cards, Kanban (grouped by qualification status), Calendar (insurance/license expiries and yearly renewals) and Map (partners placed by address, colored by status). Click a partner in any view to open their application. Duplicates, Insurance tracking, Export to Excel and Requalify are at the top right of the page.",
      "Red flags on the Directory mark approved partners with no W-9 or COI, expired insurance or license, or coverage below our minimums.",
      "Requalify partners: Trade Partners → Directory → tick partners (or Requalify → Select all approved) → optional message → optionally ask for the current MSA → Send requalification. Each gets a pre-filled form; their update arrives in Applications marked Requalification, and Approve renews them for a year.",
      "Leave a partner out of select-all requalification: Directory → Exclude from requalification on their card.",
      "Expiry reminders go to the sub 45 days out, weekly after that, and urgently in the last 7 days with the office CC'd. After expiry they stop and the office gets an alert.",
    ],
    keywords: ["trade partners", "subcontractors", "prequalification", "prequal", "vendors", "compliance", "insurance", "interviews", "msa", "master subcontractor agreement", "countersign", "cost codes", "duplicates", "merge", "requalification", "requalify", "coi", "certificate of insurance", "red flags", "insurance tracking", "reminders"],
  },
  {
    id: "pipeline", name: "Pipeline (Deals)", path: "/dashboard/pipeline", nav: "Sidebar → Pipeline",
    roles: "Super Admin, Admin, Project Manager, Estimator",
    summary: "Early sales deals from New/Working to Closed Won, as a list, table, kanban board, calendar or map. Each deal has contacts (primary, secondary and more, each with a role), key fields, to-do items, tasks, an activity timeline and stage history. Closed Won moves the deal into Pre-Con.",
    steps: [
      "Add a deal: Pipeline → New deal → title, contact, value → Save.",
      "Add people to a deal: open the deal → Lead / Contact details → type first/last name, phone, email and relation in the Primary contact block; use + Add contact for more. Fields save as you leave them; partial details are fine.",
      "Move a deal: open it → click the next stage in the stage bar (or Closed Won / Closed Lost at the top).",
      "Add a task: open the deal → Tasks → Add Task (the assignee gets an email with the deal, job number and due date).",
    ],
    keywords: ["pipeline", "deals", "sales", "crm", "opportunity", "stage", "closed won", "deal contacts", "tasks", "follow up"],
  },
  {
    id: "precon", name: "Pre-Con", path: "/dashboard/sales", nav: "Sidebar → Pre-Con",
    roles: "Super Admin, Admin, Project Manager, Estimator",
    summary: "Pre-construction projects (CM-#### numbers) from Opportunity through Active Project, Warranty and Closed. Each has stage tabs with the fields that stage needs, history, and a Photos & voice notes section.",
    keywords: ["pre-con", "precon", "pre construction", "sales", "budget", "design", "opportunities", "cm number"],
  },
  {
    id: "projections", name: "Projections", path: "/dashboard/projections", nav: "Sidebar → Projections",
    roles: "Super Admin, Admin",
    summary: "The 12-month revenue and workload forecast, in grid, list, table, cards, calendar, map and workload views, with actuals import and PDF export.",
    keywords: ["projections", "forecast", "revenue", "workload", "backlog", "financial"],
  },
  {
    id: "reporting", name: "Reporting", path: "/dashboard/reporting", nav: "Sidebar → Reporting",
    roles: "Super Admin, Admin, Project Manager, Estimator",
    summary: "Weekly workload meeting reports: sections of projects with status, dates, latest update and action items; Changes since last week; and open Action items. Each report has List, Table and Board views, checkboxes and quick actions (status, completion date, move, add action item, remove), PDF export and Mark final.",
    steps: [
      "New report: Reporting → New report.",
      "Bring in past meetings: Reporting → Import a past meeting.",
      "Update many items at once: open a report → tick items (or Select all) → use the bar at the bottom.",
    ],
    keywords: ["reporting", "reports", "weekly meeting", "workload", "action items", "changes", "pdf"],
  },
  {
    id: "analytics", name: "Analytics", path: "/dashboard/reporting/analytics", nav: "Sidebar → Reporting → Analytics",
    summary: "Marketing and search performance. Placeholder: Google Analytics, Search Console, Ads, Meta and LinkedIn aren't connected yet.",
    keywords: ["analytics", "google analytics", "seo", "ads", "marketing"],
  },

  // ── Jobs ──
  {
    id: "jobs", name: "Jobs", path: "/dashboard/jobs", nav: "Sidebar → Jobs",
    summary: "All construction jobs (list, table, card, kanban, calendar). Open a job for its own menu: Summary, Job Info, Price Summary, Client Portal, Schedule, Daily Logs, Projects & Tasks, Documents, Files, Messages, Communications, Change Orders, Invoices, Selections, Warranty, Notes and Activity. The Summary has stat cards (Documents, Contracts, Daily Logs, Selections, Change Orders, Invoices…) that link to each area.",
    steps: [
      "Open a job: Jobs → click the job.",
      "On a phone, the job's menu is the row under All jobs / Edit Job Info; swipe it sideways.",
    ],
    keywords: ["jobs", "projects", "construction", "job info", "summary", "job number"],
  },
  {
    id: "daily-logs", name: "Daily Logs", path: "/dashboard/daily-logs", nav: "Sidebar → Jobs → Daily Logs (phone: bottom menu → Daily Log)",
    summary: "Every Job and Pre-Con daily log in one place, by day, with search, a job filter and a delays-only toggle. Each job also has its own Daily Logs tab with All Logs / Standard / Photos / Voice tabs. Weather and temperature fill in automatically from the site's location.",
    steps: [
      "Add a log: Jobs → Daily Logs → Add Log → pick one or more Jobs or Pre-Con projects → write what happened (weather fills itself) → Save log.",
      "Add a log to one job: open the job → Daily Logs → Add Log.",
      "From a phone: bottom menu → Daily Log (opens the form straight away).",
    ],
    keywords: ["daily log", "daily logs", "site log", "site visit", "field report", "weather", "logs"],
  },
  {
    id: "punch-lists", name: "Punch Lists", path: "/dashboard/punch-lists", nav: "Sidebar → Jobs → Punch Lists; also a Punch List tab on every Job, Pre-Con project and Pipeline deal",
    summary: "Checklists of fixes and tasks attached to a Job, Pre-Con project or Pipeline deal — as many lists per record as you need. Check items off with one tap (built for phones), add notes, room, trade, priority, due date and an assignee. Items assigned to someone appear in their Daily Brief. Job lists can be made visible to the client (read-only, in their portal). Start blank or from a construction template (Final Walkthrough, Pre-Drywall, Kitchen, Bathroom, Exterior & Landscape, Closeout) or a saved one.",
    steps: [
      "New list: open the Job (Punch List tab), Pre-Con project (Punch List tab) or Pipeline deal → New punch list → pick a template or blank → Create list. Or Jobs → Punch Lists → New punch list → Attach to… → search the record.",
      "Add items: type in “Add an item…” and press Enter (paste several lines to add several), or tap the mic to dictate a walkthrough — each sentence becomes an item — or list menu (⋯) → Import items (.csv or .txt).",
      "Check off: tap the box. Tap the item text to edit notes, room, trade, priority, assignee and due date.",
      "Share with the client (Jobs only): list menu → Edit list → Visible to the client.",
      "Save as template: list menu → Save as template.",
      "Ask Bolt: “add a punch list to the Lillie job: touch up hallway paint, missing outlet cover in the primary bath” — Bolt shows the items and you tap Save.",
    ],
    keywords: ["punch list", "punch lists", "punchlist", "punch", "walkthrough", "walk-through", "checklist", "check list", "closeout", "pre-drywall", "to do", "fix list", "deficiency"],
  },
  {
    id: "site-photos", name: "Photos, video and voice notes from a phone", path: "/dashboard/jobs", nav: "Phone: bottom menu → Camera or Record",
    summary: "Capture on site and file it in one step. Save to a Job (files + timeline, optional client sharing, and 'Also add to today's daily log', on by default), a Pre-Con project, or a Daily Log. Voice notes are transcribed automatically when you stop recording.",
    steps: [
      "Photo or video: bottom menu → Camera → Single Photo / Photo Gallery / Video → Save to Job, Pre-Con or Daily Log → pick it → add a note → Save.",
      "Voice note: bottom menu → Record → Start recording → Stop (it transcribes) → edit the transcript → Save to Job, Pre-Con or Daily Log → Save.",
    ],
    keywords: ["photo", "camera", "picture", "video", "voice note", "record", "recording", "transcribe", "transcription", "mobile", "phone", "site photos"],
  },
  {
    id: "jobs-map", name: "Jobs Map", path: "/dashboard/jobs/map", nav: "Sidebar → Jobs → Jobs Map",
    summary: "Every job on a map.", keywords: ["map", "jobs map", "locations"],
  },
  {
    id: "job-templates", name: "Job Templates", path: "/dashboard/jobs/new-from-template", nav: "Sidebar → Jobs → Templates",
    roles: "Super Admin, Admin, Project Manager",
    summary: "Create a job from a template (job details, settings, schedule shape).", keywords: ["template", "new job", "job template"],
  },
  {
    id: "schedules", name: "Schedules", path: "/dashboard/schedules", nav: "Sidebar → Jobs → Schedules",
    summary: "Schedules across all jobs (Gantt, list, table, calendar, kanban, resource views), with templates and client-facing dates.",
    keywords: ["schedule", "schedules", "gantt", "calendar", "timeline", "look ahead"],
  },
  {
    id: "selections", name: "Selections", path: "/dashboard/selections", nav: "Sidebar → Jobs → Selections",
    summary: "Product and finish selections for clients, built from vendor pages into selection cards.",
    keywords: ["selections", "finishes", "fixtures", "products", "vendors", "selection cards"],
  },
  {
    id: "client-engagement", name: "Client Engagement", path: "/dashboard/client-engagement", nav: "Sidebar → Jobs → Client Engagement",
    roles: "Super Admin, Admin, Project Manager",
    summary: "Client portal activity across jobs: portal jobs, pending approvals, open action items, unread client messages, warranty and jobs missing updates.",
    keywords: ["client engagement", "client portal", "client updates", "approvals", "warranty"],
  },
  {
    id: "client-portal", name: "Client Portal (per job)", path: "/dashboard/jobs", nav: "Jobs → open a job → Client Portal",
    summary: "Turn a job's client portal on, set progress, phase and next milestone, invite clients and publish client updates.",
    keywords: ["client portal", "portal", "invite client", "client update", "progress"],
  },

  // ── Files, comms, content ──
  {
    id: "cloud", name: "Cloud", path: "/dashboard/cloud", nav: "Sidebar → Cloud",
    summary: "Google-Drive-style file storage with folders, upload, preview and sharing.",
    keywords: ["cloud", "files", "drive", "folders", "upload", "storage"],
  },
  {
    id: "communications", name: "Communications", path: "/dashboard/communications", nav: "Sidebar → Communications",
    roles: "Super Admin, Admin, Project Manager, Estimator",
    summary: "All email, SMS and calls with tabs: All, Email, SMS, Calls, Contact Form (website submissions), Templates (email builder) and Prints (flyers). Includes the browser phone dialer.",
    steps: [
      "Call from the browser: Communications → Calls / dialer (phone: bottom menu → Call).",
      "Send an email or text: Communications → compose, or open a contact and use Email / Text.",
      "See website form submissions: Communications → Contact Form. Vendor pitches have their own filter; spam is kept under Spam, out of the inbox.",
      "Reply, forward, archive or delete a message: Communications → the message's ⋯ menu (or open it and use the buttons). Tick several messages to archive or delete them together.",
      "Find archived messages: Communications → Archived (next to Inbox). Use Received / Sent to filter by direction.",
    ],
    keywords: ["communications", "email", "sms", "text", "call", "dialer", "phone", "contact form", "submissions", "templates", "prints", "flyers", "reply", "forward", "archive", "delete message", "inbox"],
  },
  {
    id: "direct-messages", name: "Direct Messages", path: "/dashboard/direct-messages", nav: "Sidebar → Communications → Direct Messages",
    summary: "Staff-to-staff messaging.", keywords: ["direct messages", "dm", "chat", "message a coworker"],
  },
  {
    id: "business-cards", name: "Business Cards", path: "/dashboard/business-cards", nav: "Sidebar → Communications → Business Cards",
    summary: "Build your digital business card, share its link, and see views and leads.", keywords: ["business card", "digital card", "vcard"],
  },
  {
    id: "recording-studio", name: "Recording Studio", path: "/dashboard/recording-studio", nav: "Sidebar → Communications → Recording Studio",
    summary: "Record meetings, get transcripts and AI summaries with action items.", keywords: ["recording studio", "meeting recording", "transcript", "meeting notes", "summary"],
  },
  {
    id: "workspace", name: "Workspace", path: "/dashboard/documents", nav: "Sidebar → Workspace",
    summary: "Collaborative documents (with project trackers, kanban boards and calendars inside), plus contracts, SOWs and notes. Templates include Client Meeting Notes, Site Walk & Punch List, New Client Onboarding, Client Project Tracker, 6-Week Look-Ahead Schedule, Trade Partner Bid Board, Weekly Workload Meetings and more.",
    steps: ["Start from a template: Workspace → Templates → View or Use template."],
    keywords: ["workspace", "documents", "docs", "contracts", "sow", "notes", "templates", "punch list", "look ahead", "bid board"],
  },
  {
    id: "site-content", name: "Site Content", path: "/dashboard/site-content", nav: "Sidebar → Site Content",
    roles: "Super Admin, Admin, Designer",
    summary: "The public website's content: Portfolio, Team, Blog and Messaging Consent (SMS/email opt-in records).",
    keywords: ["site content", "website", "portfolio", "team", "blog", "messaging consent", "opt out"],
  },
  {
    id: "ai-agents", name: "AI Agents (Bolt)", path: "/dashboard/agent", nav: "Sidebar → AI Agents",
    summary: "Chat with Bolt (this assistant), manage what it knows (Training) and see CMI's Paperclip agents. Open Paperclip at paperclip.constructedmatter.com.",
    keywords: ["bolt", "ai", "agent", "ai agents", "training", "paperclip", "chat"],
  },

  // ── Account & admin ──
  {
    id: "notifications", name: "Notifications (Broadcasts & Morning Briefing)", path: "/dashboard/notifications", nav: "Sidebar → Notifications",
    roles: "Super Admin",
    summary: "Broadcasts: send an announcement to everyone, staff, clients or a role. Morning Briefing: turn the 6 AM email on/off, weekdays only, choose recipients, include the AI summary, Send now, preview anyone's email and see send history.",
    steps: [
      "Send the briefing now: Notifications → Morning Briefing → Send now → choose people → Send.",
      "Preview someone's briefing: Notifications → Morning Briefing → Preview → pick a person → Open preview.",
    ],
    keywords: ["notifications", "broadcast", "announcement", "morning briefing", "briefing settings", "send briefing"],
  },
  {
    id: "users", name: "User Management", path: "/dashboard/users", nav: "Sidebar → User Management",
    roles: "Super Admin, Admin",
    summary: "Staff accounts, roles and invites. Open a person to edit them, Preview Invite, or Resend Invite.",
    steps: ["Invite someone: User Management → add the user → open them → Preview Invite → Resend Invite."],
    keywords: ["users", "staff", "invite", "roles", "permissions", "user management", "add employee"],
  },
  {
    id: "team", name: "Team (website profiles)", path: "/dashboard/team", nav: "Sidebar → Site Content → Team",
    roles: "Super Admin, Admin",
    summary: "The public team pages on constructedmatter.com/team: name, title, bio, photos, specialties and hours. Staff accounts (email, phone, dashboard role) are in User Management.",
    keywords: ["team", "team page", "staff profile", "bio", "who works here", "employees"],
  },
  {
    id: "my-profile", name: "My Profile", path: "/dashboard/my-profile", nav: "Sidebar → My Profile",
    summary: "Your details and notification preferences (email and push).", keywords: ["profile", "my profile", "notification settings", "preferences"],
  },
  {
    id: "settings", name: "Settings", path: "/dashboard/settings", nav: "Sidebar → Settings",
    roles: "Super Admin, Admin",
    summary: "Tabs: General (appearance, feature flags, Project Canvas visibility, extension access), Claude (who can connect Claude to CMI data, who has company-wide access, and who may receive AI-generated email, SMS, DMs and notifications; Super Admin edits), Sidebar Navigation (hide any sidebar item for everyone; Super Admin) and Credentials (which service keys are set).",
    steps: [
      "Hide a sidebar item: Settings → Sidebar Navigation → switch it off.",
      "Give someone the company-wide (ownership) view in Claude: Settings → Claude → find the person → switch on Company-wide access.",
      "Let a client or vendor receive AI messages: Settings → Claude → Add a person → search them → switch on AI emails / AI text messages.",
      "Connect Claude to CMI: Settings → Claude → copy the connector URL → in Claude Team, Admin settings → Connectors → add a custom connector.",
    ],
    keywords: ["settings", "sidebar", "hide menu", "feature flags", "credentials", "configuration", "claude", "mcp", "connector", "ai access", "company-wide", "allowlist"],
  },

  // ── Pages a Super Admin may hide from the sidebar (dashboard_help notes it live) ──
  {
    id: "projects", name: "Projects (Project Manager board)", path: "/dashboard/project-manager", nav: "Sidebar → Projects",
    summary: "The project management board (my tasks, list, kanban, table, calendar, Gantt).", keywords: ["projects", "project manager", "tasks", "board"],
  },
  {
    id: "bookings", name: "Bookings", path: "/dashboard/bookings", nav: "Sidebar → Bookings",
    summary: "Appointments and booking pages, with calendar sync.", keywords: ["bookings", "appointments", "calendar", "schedule a meeting"],
  },
  {
    id: "billing", name: "Billing", path: "/dashboard/billing", nav: "Sidebar → Billing",
    summary: "Invoices and billing.", keywords: ["billing", "invoices", "payments"],
  },
  {
    id: "project-canvas", name: "Project Canvas", path: "/dashboard/canvas", nav: "Sidebar → Project Canvas (when the feature is turned on)",
    summary: "Clients mark up photos of their space and fill in a project brief; staff review the briefs (Canvas Briefs).", keywords: ["project canvas", "canvas", "brief", "markup", "client photos"],
  },
  {
    id: "quotes", name: "Quotes & Leads", path: "/dashboard/quotes-leads", nav: "Reachable by link",
    summary: "Estimate requests from the website quote form.", keywords: ["quotes", "quote requests", "estimates"],
  },
  {
    id: "take-off", name: "Take-Off", path: "/dashboard/take-off", nav: "Sidebar → Take-Off (when the Take-Off feature is turned on in Settings → General → Feature Flags)",
    summary: "Plan take-off measuring tool.", keywords: ["take-off", "takeoff", "measure", "plans"],
  },
];

/** Best matches for a question, by overlap with names, keywords and summaries. */
export function searchGuide(query: string, limit = 4): GuideEntry[] {
  const words = query.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  const scored = DASHBOARD_GUIDE.map((e) => {
    const name = e.name.toLowerCase();
    const keys = e.keywords.join(" ").toLowerCase();
    const body = `${e.summary} ${(e.steps ?? []).join(" ")}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (name.includes(w)) score += 5;
      if (keys.includes(w)) score += 3;
      if (body.includes(w)) score += 1;
    }
    for (const k of e.keywords) if (query.toLowerCase().includes(k)) score += 4;
    return { e, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}

/** One line per area, for the system prompt. */
export function guideIndex(): string {
  return DASHBOARD_GUIDE.map((e) => `- ${e.name}: ${e.path} (${e.nav})`).join("\n");
}
