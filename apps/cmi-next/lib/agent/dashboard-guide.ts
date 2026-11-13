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
  "Search: the Search Constructed Matter box at the top of every dashboard page (Ctrl/⌘+K; on a phone, the magnifying glass next to the light/dark button slides a search field down under the top bar). Every word must match, in any order, so 'waters 26' finds The Waters Residence and 'ben framing' finds Ben's framing task. It finds dashboard pages (Go to, e.g. 'consent' → Messaging Consent), jobs, contacts, Pipeline deals, Pre-Con projects, trade partners, selections, change orders, invoices, schedule tasks (by title, location, assignee, job or schedule), daily logs (private ones only for their author), punch list items, Cloud files and Workspace documents. Pipeline, Pre-Con, trade partners and invoices show for Admins, Project Managers and Estimators. Pick a result to open its page.",
  "Contact: any person in the CRM (Contacts). Its Type says what they are: Lead, Client, Prospect, Customer, Vendor, Sub Contractor, Designer or Other.",
  "Lead: a Contact whose Type is Lead (Contacts → Leads tab). 'How many leads' means count contacts with type Lead, not quotes.",
  "Quote: an estimate request from the website's quote form (Quotes & Leads page).",
  "Deal: an early sales opportunity in the Pipeline (stages New/Working → Contacted → Qualified → Opportunity → Proposal → Negotiation → Closed Won / Lost-On Hold). A deal gets its number when it's marked Closed Won and moves into Pre-Con.",
  "Pre-Con: the pre-construction stage after a deal is Closed Won (Pre-Con page, numbers like CM-2026-0007). Stages: Opportunity → Active Budget → Pre-Construction / Design → Active Project → Warranty → Closed.",
  "Job: an active construction project (Jobs), numbered like 26_001_Name, with its own Summary, Schedule, Daily Logs, Files, Selections, Change Orders, Invoices and Client Portal.",
  "Daily Log: a record of a day on site for a Job or a Pre-Con project. Weather fills in automatically. Types: Standard (written), Photos, Voice (transcribed recordings).",
  "Phone quick menu: the footer bar on dashboard pages scrolls sideways (Dashboard, Daily Log, Jobs, Schedules, Selections, Bolt, Contacts, Call, SMS, Email, Record, Camera, Workspace; on a phone, Add daily log opens between the top bar and this bar so both stay on screen); the Hide tab on its top edge tucks it away and Show brings it back, remembered per device. Sign out is the door-and-arrow button at the top right. On phones and tablets the round Quick Actions button starts hidden; Settings → Appearance → Show brings it back.",
  "Hide stats: pages with stat cards have a Hide stats / Show stats button at the top right; it's remembered per person, and on phones the stats start hidden.",
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
      "Sort contacts: in the Table view click any column header (Name, Email, Company, Lead Owner, Status, …); click again to reverse. Choose columns with View options (right of the filters; Reset to default), and switch views with the icons on the far right.",
      "See leads: Contacts → the Leads tab.",
      "Assign a contact to an existing deal: open the contact → Pipeline deals → Assign to Pipeline → pick the deal and their role → Assign.",
      "Start a new deal from a contact: open the contact → More (…) → + Pipeline.",
      "Row actions: the ⋯ at the end of any contact row → Open, Copy link, Email, SMS, Message a teammate (sends them the contact card), Duplicate, Archive / Restore, Delete (Super Admin / Admin; permanent — Archive is reversible).",
      "Bulk actions: tick contacts (or the header box for the page) → change type, set status, set lead owner, add or remove tags, Add to Pipeline, Export the selected to CSV, Archive, or Delete (Super Admin / Admin).",
      "Find archived contacts: Contacts → All Statuses → Archived; restore one from its ⋯ menu.",
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
      "Set insurance minimums: Trade Partners → Setup → Insurance minimums → set the default (e.g. general liability $2,000,000), then Add a category for a trade or partner type that needs more or less (or a line not required) → Save. A partner matching several categories gets the strictest. Check a partner previews what someone must carry. The application, the Become a Trade Partner page and Claude's certificate check all use these.",
      "Clean up duplicates: Trade Partners → Directory → Duplicates → Keep first / Keep second (the other is archived, not deleted).",
      "See companies that were only a contact's employer: Trade Partners → Directory → tick Show non-partner companies.",
      "Add a trade partner through Claude (CMI connector): \"add Desert Sparks Electric, an electrical sub in Scottsdale, contact Maria Lopez maria@desertsparks.com\" — it's added to the directory as a prospect (or Claude shows the existing record if they're already in CMI). Then \"invite them to apply\": Claude previews the email and sends the pre-filled qualification form only after you say yes; replies come back to you.",
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
    summary: "Early sales deals from New/Working to Closed Won, as a list, table, kanban board, calendar or map. Each deal has contacts (primary, secondary and more, each with a role), key fields, to-do items, tasks, an activity timeline and stage history. Every deal gets its job (pipeline) number, e.g. 26_059, the moment it enters the Pipeline, at the front of its title; Pre-Con and the job keep it (the job reads 26_014_26_059_Name). Closed Won moves the deal into Pre-Con and off the Pipeline board.",
    steps: [
      "Add a deal: Pipeline → New deal → title, contact, value → Save. The next number is added to the title for you (or keep one you typed, if no other deal has it).",
      "Fix a deal's job number or name: open the deal → the pencil next to its title → change Number (e.g. 26_058) and/or Name → Save. Or in the Pipeline Table view, edit the Job # or Job name cell. The number must be YY_### and not used by another deal or Pre-Con project; a Pre-Con project made from the deal takes the new number too, and the change is logged on the deal's timeline. A job already created keeps its own name (rename it in Job Info).",
      "Choose the columns: Pipeline → View options (right of the filters) → tick or untick columns; the List and Table views each remember their own choice, and Reset to default puts them back. Switch views (List, Table, Kanban, Calendar, Map) with the icons on the far right.",
      "Hide the stat cards (Tasks, Open deals, Pipeline value, Closed Won, Follow-ups due): Pipeline → Hide stats (top right); Show stats brings them back. It's remembered for you.",
      "In the List and Table views the first column is the Job # and the second is the Job name; click either header to sort by it (click again to reverse).",
      "Estimated amount and range: open a deal → Edit (Key fields) → Estimated amount, plus the optional Estimated low and Estimated high for a range (e.g. $850,000 – $950,000). The list shows the amount with the range under it; totals use the amount, or the range's midpoint when there's no amount. The Table view has Est. low and Est. high columns.",
      "Add people to a deal: open the deal → Lead / Contact details → type first/last name, phone, email and relation in the Primary contact block; use + Add contact for more. Fields save as you leave them; partial details are fine.",
      "Move a deal: open it → click the next stage in the stage bar (or Closed Won / Closed Lost at the top).",
      "List view: click a deal's row to open it. Edit there, or switch to the Table view.",
      "Table view works like a spreadsheet: click a cell and type (deal name, stage, owner, job type, value, probability, close date, source, next action and due date). Tab / Shift+Tab move across, Enter or ↑/↓ move down and up, Esc undoes; each change saves when you leave the cell.",
      "Find a won deal: it leaves the Pipeline and lives in Pre-Con (Sidebar → Jobs → Pre-Con). On the kanban, drag a card onto Closed Won to send it there.",
      "Add a task: open the deal → Tasks → Add Task (the assignee gets an email with the deal, job number and due date).",
    ],
    keywords: ["pipeline", "deals", "sales", "crm", "opportunity", "stage", "closed won", "deal contacts", "tasks", "follow up"],
  },
  {
    id: "precon", name: "Pre-Con", path: "/dashboard/sales", nav: "Sidebar → Jobs → Pre-Con (just above Jobs Map)",
    roles: "Super Admin, Admin, Project Manager, Estimator",
    summary: "Pre-construction projects (CM-#### numbers) from Opportunity through Active Project, Warranty and Closed. Each has stage tabs with the fields that stage needs, history, and a Photos & voice notes section.",
    keywords: ["pre-con", "precon", "pre construction", "sales", "budget", "design", "opportunities", "cm number"],
  },
  {
    id: "projections", name: "Projections", path: "/dashboard/projections", nav: "Sidebar → Projections",
    roles: "Super Admin, Admin",
    summary: "The 12-month revenue and workload forecast, in grid, list, table, cards, calendar, map and workload views, with actuals import and PDF export. On a phone, the view buttons and the Status, PM, Super, Allocation and Show filters are under Filters & Views (right of Combined / Committed / Potential).",
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
      "Open a job: Jobs → click the job. Or, from any page, the job menu in the top bar right of \"CMI Dashboard\": search by name or number, filter by Status, Type and Project manager (multi-select; Active jobs only by default), and pick a job. From a job's page it opens the other job on the same tab (Schedule → its Schedule).",
      "Fold a job's side menu into icons: the panel button at the bottom of the job menu (when the main sidebar is collapsed) turns it into a rail like the main sidebar; hover an icon for its name. The choice is remembered on that browser.",
      "Set a job's inspection profile (when inspection milestones are switched on): Job → Job Info → Job Details → Inspections. Pick the Jurisdiction (by parcel, not mailing address; a button suggests one from the city), the Scope (NEW new build, ADD addition / large renovation, REN interior remodel) and the Conditions (pool, gas, CMU, stucco, fire sprinklers, site work, right-of-way and so on). These choose which inspections from the inspection library (Scottsdale, Phoenix, Paradise Valley, Mesa, Tempe, Chandler, Cave Creek, Carefree, Maricopa County) apply to the job. The section shows how that jurisdiction takes requests and its next-day cutoff.",
      "Edit the inspection jurisdictions (Super Admin / Admin): Settings → Scheduling → Inspections → the pencil on a jurisdiction (or Add jurisdiction). Set its next-day cutoff (a time, Midnight, or Not published), how to request, phone, portal, hours, notes and the date it was last verified; untick Offered on jobs to retire one (jobs that use it keep it). Claude can do the same (cmi_inspection_jurisdiction_save).",
      "Who can update inspection status: Settings → Scheduling → Inspections → Who can update inspection status. Super Admins tick the roles (Project Managers and Superintendents by default); Super Admins and Admins always can. Claude: cmi_inspection_settings_update (Super Admin).",
      "Add inspections to a job schedule (when inspection milestones are switched on; Admins, PMs and schedule editors): Job → Schedule → pick the schedule → Inspections (on phones: the filter icon → Add → Inspections). Set the job's jurisdiction and scope in Job Info first. Required rows start ticked, \"If …\" rows follow the job's conditions, \"As needed\" rows are marked Confirm; repeating ones (per pour, per lift) ask how many. Each becomes a milestone (Not Ready) linked Finish→Start from the work before it to the work it releases, so a late inspection pushes what follows. Afterwards it lists hooks it couldn't link (the task isn't on that schedule) to link by hand. Loading again skips what's already there.",
      "Update an inspection (PMs and Superintendents by default; Settings → Scheduling → Inspections sets who): open the inspection milestone on the schedule → Inspection box → Status → Update inspection. It shows the hold point, how to request it and the request-by time (the jurisdiction's cutoff the working day before). Passed finishes it so the work after it can start; Failed / Correction needs the re-inspection date and a note and moves the milestone (and what follows); a date on Requested / Scheduled moves it too; N/A keeps it on record. Each change adds a dated line to the notes. Starting work that an inspection holds before it has passed shows a hold point warning.",
      "Where inspections show up: the three-week lookahead lists each one's status and request-by time (amber when it needs a call today), the schedule health tiles show Waiting on inspection (red when one failed), and the Today page lists Call today for upcoming inspections. Claude: cmi_job_inspections and cmi_inspection_status_update.",
      "Check inspections against the permit (when inspection milestones are switched on): Job → Schedule → Permit list (phones: filter icon → Add → Permit list). Paste the inspection list printed on the permit, one per line (\"615 Footing\"), then Compare. Matched inspections take the permit's names and numbers; ones only on the schedule can be marked N/A (kept on record); ones only on the permit are added after a task you pick, or matched by hand to one already there. Applying records the date and who checked it. Claude: cmi_inspection_permit_check.",
      "Jobs on a phone: the filter button at the right of the Jobs title opens a sheet from the bottom: the views in one row (List, Table, Card, Kanban, Calendar, Map), search, one filter field with checkboxes under Status, Type and PM (pick several), Active only and Show archived switches, and Export / Import. A number on the button shows how many filters are on.",
      "Filter jobs by status, type or project manager. The PM list shows every CMI staff member; anyone set up as a Project Manager on a job (including owners who also run jobs) appears under their name.",
      "On a phone, the job's menu is the row under All jobs / Edit Job Info; swipe it sideways.",
    ],
    keywords: ["jobs", "projects", "construction", "job info", "summary", "job number"],
  },
  {
    id: "daily-logs", name: "Daily Logs", path: "/dashboard/daily-logs", nav: "Sidebar → Jobs → Daily Logs (phone: bottom menu → Daily Log)",
    summary: "Every Job and Pre-Con daily log in one place, by day, with search, a job filter and a delays-only toggle. Each job also has its own Daily Logs tab with All Logs / Standard / Photos / Voice tabs. Weather and temperature fill in automatically from the site's location.",
    steps: [
      "Add a log: Jobs → Daily Logs → Add Log → pick one or more Jobs or Pre-Con projects → write what happened (weather fills itself) → Save log.",
      "With Field Reports on, Add Log has two saves: Save as draft (adds to that job's log for the day, still open) and Save & submit (adds it and submits the day's log). After saving it says where it went (e.g. 'Saved as a draft in Daily Log #3 · Mackay Residence') with View log. Closing with anything in it asks first: Save as draft, Keep editing or Discard. Clicking outside never throws it away, and the text, job and settings are kept on the device, so reopening Add Log offers Restore it.",
      "Edit a log: Daily Logs → Edit (on an earlier log, or on a day's Field Report card) opens the full editor: change the text (earlier logs) or add notes that are sorted into the sections (Field Reports), add photos, video or voice notes, remove any photo or attachment (e.g. from the wrong job), change who sees it, and change the Job to move the log. A Field Report moved to a job that already has a log that day is combined with it; its photos and commitments move too. Edits to a submitted log are recorded.",
      "Add a log to one job: open the job → Daily Logs → Add Log.",
      "From a phone: bottom menu → Daily Log (opens the form straight away).",
      "Field Reports (when switched on; Jobs only): each job has ONE daily log per day. Everything added that day (typing, Record on the phone, Camera, Add Log) lands in it and is sorted into the standard sections: Work completed, On site (company and trade; crew and hours optional), Deliveries, Inspections (with result), Delays & issues (with impact), Safety, Equipment, Visitors, Look-ahead, Action items (owner, due) and Internal notes.",
      "Review and submit a day: open the job → Daily Logs → open the day's card → fix anything under Needs a look (no safety note, an inspection without a result, a delay without an impact, a company without a trade, an action item without an owner) → star (☆) what should lead the Executive Summary → Submit. Submitting locks the log (later edits are recorded) and turns its action items into Commitments. PDF prints the finished report. Admins and PMs can Reopen.",
      "Quick add: job → Daily Logs → type into Today's log → Add to today's log. The original words (and voice recordings) are kept under Original words.",
    ],
    keywords: ["daily log", "daily logs", "site log", "site visit", "field report", "field reports", "weather", "logs", "submit daily log", "needs a look", "on site", "crew"],
  },
  {
    id: "job-photos", name: "Job Photos", path: "/dashboard/jobs", nav: "Open a job → Photos (next to Daily Logs; when Field Reports is on)",
    summary: "Every photo on a job in one library, wherever it was uploaded (daily logs, phone camera, job Files, Client Updates, Executive Summaries). Filter by date, source, area, trade, tag and client OK; photos are grouped by the day they were taken.",
    steps: [
      "Tag photos: job → Photos → tick photos (or Select day) → Area, Trade, Tags, Client OK or Internal only. Click a photo to edit its caption, area, trade, tags and star.",
      "Show photos to the client: mark them Client OK; they appear on the client's portal Photos page, grouped by area.",
      "Build a summary from photos: tick them → Add to Executive Summary (they start ticked in the summary).",
      "Upload: Photos → Upload (they're also filed in Files → Job Photos). Removing a photo from the library doesn't delete the file.",
    ],
    keywords: ["photos", "photo library", "job photos", "pictures", "site photos", "client ok", "area", "trade"],
  },
  {
    id: "executive-summary", name: "Executive Summary", path: "/dashboard/jobs", nav: "Open a job → Executive Summary (end of the job's menu); also on Pre-Con projects",
    summary: "Bolt drafts a branded summary for the Team (candid: budget, risks, owners) or the Client (client-safe). Edit it, preview it, then email it, text a link, post it to the client portal, or save a PDF.",
    steps: [
      "Write one: job → Executive Summary → Team or Client → (Field Reports on) choose the Period → Generate → Edit / Preview → Send Email or Send SMS.",
      "Client guardrail: delays, who was on site, action items and internal notes from the daily logs are listed under Kept internal and never appear as written. Bolt may mention what they mean for the client in calm, client-ready words. Tick an item to add it back, then Regenerate.",
      "Photos: tick the ones to include, or Upload new ones (they join the job's Photos library). From the Photos tab, tick photos → Add to Executive Summary.",
      "Save as draft to finish later; drafts show in the list at the bottom. Sending a client summary on a job (Field Reports on) also posts it to the portal as an Executive Summary when ticked, and saves the PDF to the job's Files → Executive Summaries.",
      "Outside production nothing is sent: the result says 'held: not production'.",
    ],
    keywords: ["executive summary", "summary", "client summary", "owner report", "weekly update", "status report", "kept internal"],
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
      "Ask Claude (CMI connector) the same way: create a list on a job, add items, or check them off (\"mark the outlet cover done on the Lillie punch list\").",
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
    summary: "Every job on a map as a pin in the job's colour, labelled with its job number (e.g. 027). Hover a pin for the name; click it for status, address, View job and Directions.",
    steps: [
      "Find a job on the map: Jobs Map → hover it in the list on the left (its pin grows) or click it (the map flies to it and opens its card).",
      "Jobs close together group into a numbered bubble; click the bubble to zoom in. Turn grouping off or on with Cluster (top right; remembered for you).",
      "Switch between the street map and Satellite, or click Map All to fit every job back into view.",
    ],
    keywords: ["map", "jobs map", "locations", "pins", "directions", "cluster", "satellite"],
  },
  {
    id: "job-templates", name: "Job Templates", path: "/dashboard/jobs/new-from-template", nav: "Sidebar → Jobs → Templates",
    roles: "Super Admin, Admin, Project Manager",
    summary: "Create a job from a template (job details, settings, schedule shape).", keywords: ["template", "new job", "job template"],
  },
  {
    id: "schedules", name: "Schedules", path: "/dashboard/schedules", nav: "Sidebar → Jobs → Schedules",
    summary: "Schedules across all jobs (Gantt, timeline, list, table, card, calendar, kanban and resource views), with templates and client-facing dates. Templates include New Construction (76 tasks from the initial site visit to the final walkthrough, in 9 phases).",
    steps: [
      "A job's schedule on a phone or tablet: the filter button at the right of the Schedules title opens every schedule tool, in sections: View (Gantt, List, Table, Calendar, Kanban, Timeline, Cards, Resource), Add (Item, Milestone, Phase, Add inside, Add Schedule, Package), Gantt (Link, Links, Baseline, Capture baseline, Zoom), Progress (finish, vs contract, status date, Update, Lookahead, scheduling mode), Schedule (Calendar, Shift dates, Make Master, Archive) and PDF. On a computer they stay in the action bar.",
      "Search or filter the Schedules page on a phone: tap the filter button at the right of the Schedules title; search, job, type and health (or the Items views) are inside. A number on it shows how many are on.",
      "Add a schedule from the Schedules page: Add Schedule (top right) → pick the job → name it → choose a source (template, copy or blank) → Create. You're taken to that job's schedule.",
      "Start from a template right away: Add Schedule opens on Start → Template (New Construction is first) → pick the Start date (the Estimated finish shows) → Next for the name and details.",
      "Schedule Builder (when switched on): Add Schedule → Schedule for: Job, Pipeline deal, Pre-Con or Selection → pick the record. Inside a schedule, 'Add inside' adds a schedule within it (e.g. Customer, Vendor and Trade Partner schedules, or Demo / Electrical / Windows / Doors under Install), as many levels deep as you need. In a task, 'Linked to' points it at a deal, job, Pre-Con, vendor or trade partner, contact, selection, project, punch list or another schedule; that record's page then lists it under Schedules (deal page, and Pre-Con → Punch List tab).",
      "Sort the Schedules list by clicking any column header (click again to reverse). Tick schedules to get quick actions at the bottom of the screen: set Status, set Health, Archive, or Delete (Project Manager and up).",
      "Start a schedule from a template: open the job → Schedule → Add Schedule → name it → Source: Use a template → pick one (e.g. New Construction) → choose the Start date. Every task is laid out from that date with the template's spacing in working days, and the Estimated finish shows before you create it.",
      "In the same step choose what happens when a date changes: 'Move the tasks that follow it' (linked tasks shift automatically) or 'I'll adjust dates myself' (only the task you edit moves).",
      "Track progress (when progress tracking is switched on): open a schedule → set Status date in the action bar (or Today) → type % complete in the grid (Table view → Progress layout) or the task panel. Above 0% stamps Actual start, 100% stamps Actual finish; Remaining overrides the work left. The finish re-forecasts from the status date; the bar shows vs baseline and how many tasks are behind.",
      "Weekly update (when progress tracking is switched on): open a schedule → Update (action bar). It lists the tasks since the last status date: type % or click Done; tasks that should have started are flagged — click Started today, or Push… with a new start date and a reason (the reason is logged on the job). Finish update moves the status date to today, re-forecasts, and shows the finish before → after and what moved. Bolt then drafts the narrative (progress, changes, critical path, risks, next two weeks); edit it, then Copy it or Post to daily log (today's log, under Internal notes). Nothing is sent to anyone from here.",
      "Three-week lookahead (when progress tracking is switched on): open a schedule → Lookahead (action bar). It shows this week, next week and the week after, grouped by phase: task, trade, start, finish, status, the selection it waits on (red when not decided before the work starts) and a day-by-day bar strip. Switch Internal / Client (client-visible tasks only, no trades or late flags), then PDF prints it on one landscape page. Click a task to open it.",
      "Baselines (Admin / Project Manager): open a schedule → Capture baseline. The first is Baseline 0 (the plan at contract) and is locked; later ones are numbered (Baseline 1, 2…) and become the current baseline that variance reads against. Turn on Baseline, then pick any earlier baseline from the list next to it to see its grey bars on the Gantt.",
      "Schedule days on a change order (when progress tracking is switched on): Change Orders → open or add one → Schedule days (working days). When it's approved, the job's open contract milestone dates move by that many working days (once per change order) and a schedule extension is recorded; a banner lists what moved and offers Capture new baseline.",
      "Schedule health (when progress tracking is switched on): under a schedule's action bar, tiles show forecast vs baseline and vs contract (working days, + = late), tasks behind the status date, critical tasks (critical-path schedules), float on the finish (to the contract completion or target), weather days so far and late selections. Click a tile for the tasks behind it, then a task to open it; Hide / Show is remembered. The Today page lists job schedules that need a look.",
      "Start reminders (when progress tracking is switched on): staff assigned to a task get a 'Starting soon' notice in the bell (and on their phone, with notifications on) a set number of working days before it starts — 5 by default. Change it per job: open a job schedule → Calendar → 'Remind assigned staff … working days before a task starts' (0 turns it off; Admin / Project Manager). A task that moves gets a new reminder for its new date; assignees are also told when a task's dates change.",
      "Resources (when progress tracking is switched on): a task's Assignees can be staff, trade partners (search by company name) or a trade with no partner yet (type e.g. 'Electrician' → Add trade). In the grid, select rows → right-click → Assign… to assign several tasks at once (tick Replace to swap who's on them). Schedules → Resources shows everyone across every job, weeks across: each cell counts open tasks that week, red = two on the same day; click a cell for the tasks. On a trade row, Pick trade partner converts it to a partner on every task in one click. Nothing is re-dated for you.",
      "Print a big Gantt (11×17): open a schedule → PDF → Gantt, 11×17 → Full schedule, Three-week lookahead, Milestones or Client (client-visible tasks, no IDs, trades or critical path). Tick 'Show the baseline under each bar' first if you want it. Every sheet has a drafting-style title block (project, schedule, forecast finish, status date, printed date, sheet x of y) and a legend. Schedule list keeps the Letter list PDF.",
      "Grid columns (Table view → Columns): WBS and Location (edit like any cell; also in the Excel export and import), Lead (wd) = working days to get the material, and Order by = the date to order it (the earliest following task's start minus the lead time, or the task's own start if nothing follows). The Procurement layout shows them together.",
      "Field update from a phone: open a schedule → Lookahead. On a phone each task is a card: pick a % or tap Done, or tap Note / photo to add to today's daily log for the job.",
      "Colours on the Gantt: double-click a task's bar → a side panel sets the bar colour and, for the lines before and after it, the colour and style (Auto, solid, dotted, dashed); Save colors. Auto keeps the standard look. Saved on the schedule, so everyone sees it. By default each phase has its own colour (Pre-Construction bronze, Design & Permitting slate blue, and so on); a phase's own colour or a bar colour you set still wins. Past-due work (should have finished, not complete) turns red with a Past due tag, and the next task coming up is tagged Up next with a soft moving highlight.",
      "Show or hide the link lines between tasks on the Gantt: Links button (Gantt toolbar, or the grid toolbar in Table view). Finish→Start lines run from the end of one bar to the start of the next; critical links are solid charcoal. Remembered for you.",
      "Change any single task by dragging it on the Gantt or opening it and editing its dates.",
      "Move a whole schedule: select it → Shift dates → pick the new start date. The preview shows how many working days it moves and the new finish; locked and complete tasks stay put.",
      "Packages (several schedules at once): Package → set the Start date → pick a package.",
      "Critical path (when the schedule engine is switched on; Admin / Project Manager): open a schedule → the dates button in the action bar ('Push later only') → choose Critical path (auto) or Manual → the preview shows the new finish and anything that moves → Use this. 'Keep today's dates' (on by default) gives tasks that sit later than their links a Start No Earlier Than, so nothing moves earlier. On the critical path the schedule works out its own dates from the links, the company holiday calendar and each schedule's working days; tasks move later and earlier, critical tasks get a dark outline, and hovering a bar shows its activity ID and float. Dragging a bar later sets a Start No Earlier Than (⇥); dragging it earlier than its links allow is refused with the link that holds it. Manual keeps dates where you put them and shows float as advice. Switch back to 'Push later only' any time; no dates change.",
      "Grid (when the schedule engine is switched on): open a schedule → Table view. It's a spreadsheet beside the Gantt (Grid + Gantt, or Grid only), one row per task: ID (activity IDs by tens), Task name, Duration (8 = working days, 7cd = calendar days, 0 = milestone), Start, Finish, Predecessors (shorthand like 120, 120FS+2, 150SS, 180FF-1), Successors, %, Float, Constraint, Assigned, Notes. Split view: Grid + Gantt, Grid only or Gantt only (remembered per schedule; below about 1100px wide the grid sits above the Gantt). Clicking a Gantt bar selects that task's grid row and scrolls to it; double-clicking a bar opens the task (colours are in the row's right-click menu → Colors…). Click a link line to select it, then press Delete or the chip's Delete button to remove it (undoable). After a change ripples, the banner says how many tasks moved and the new finish (e.g. “3 tasks moved · finish now Mar 11, 2027 (2 days later)”). Type to edit; Enter / Tab move like Excel; F2 edits in place; Esc cancels. Shift+arrows select a range; Ctrl+D fills the top cell down; Delete clears; Ctrl+C copies; paste rows straight from Excel (a header row maps columns by name, extra rows become new tasks). Ctrl+Z / Ctrl+Y undo and redo (History lists the last 50 changes). Right-click a row to insert above / below, duplicate, move or delete; drag the grip to reorder (dropping under another phase moves it there); Alt+Shift+↑/↓ moves a row. Typing a new ID moves the row to where that number sorts, and it can carry the task into the phase it lands in (in the grid, in a task's drawer, or when adding a task with a number); dragging a row moves it without changing its ID. Inserting a task takes the midpoint of its neighbours (25 between 20 and 30); when there's no number left between them (25 and 26) the insert is refused and Renumber by 10s opens instead. Renumber by 10s (grid toolbar, the schedule's action bar, or on phones the filter icon → Schedule) first shows a preview of every task's old → new ID, then tidies all IDs to 10, 20, 30… with predecessors following; the full old → new list is saved in the schedule history. A number already used on the schedule is refused with a message. On a schedule that uses links, a task with nothing before it (other than the first task) shows “no predecessor” in the Predecessors column (or an amber dot on its ID if that column is hidden); deleting a task tells you which tasks were left with no predecessor. Cells the recalculation moved flash. Columns → pick a layout (PM view, Super view, Client print) or tick columns. Double-click a row for the full task (activity ID, duration, constraint, actual dates, early / late dates and float).",
      "What-if (schedule on Critical path (auto); Table view → What-if): try changes without saving them. Edit durations, dates, constraints or predecessors in the grid, drag bars on the Gantt, or type a number in 'Start … working days later' → Try (e.g. 10 to see starting two weeks late). The bar shows the finish before → after and how many tasks differ; Step back undoes one try. Apply saves them all as one change; Discard throws them away. Adding, deleting or renaming tasks waits until you leave What-if.",
      "Milestone types and contract dates: open a milestone (or the grid's Milestones layout) → Milestone type (Contract, Inspection, Client decision, Internal) and Contract date. The grid's 'vs contract' column shows working days late (+) or early (−), the Gantt draws a dashed line at the contract date (red when the forecast is past it), and the schedule bar shows the milestone furthest behind ('vs contract +5 wd').",
      "Excel (Table view → Excel): Export to Excel (the grid, the calendar and a weekly Gantt sheet), Download blank template, or Import from Excel. Rows match on a hidden Task GUID column; the preview lists every change before anything is saved, and tasks missing from the file are offered for deletion (none ticked by default).",
      "Work calendar for a job (critical-path schedules): open a schedule → Calendar (action bar). Add working Saturdays, weather, owner or jurisdiction days, or work a company holiday; the counts by type help with time-extension requests. Saving recalculates the schedules. Company holidays are in Settings → Scheduling.",
      "Task history: open a task (it opens as a side panel beside the grid) → History shows who changed what, before → after, from the editor, the grid or an Excel import, and every move the schedule made.",
      "Ask Claude (CMI connector): \"start a New Construction schedule on 26_014 beginning Nov 3\", \"push the Olson schedule back to Dec 1\" (Claude shows how far it moves and the new finish first), \"what's late on the Lillie job?\", or \"make Drywall wait for Insulation\".",
    ],
    keywords: ["schedule", "schedules", "gantt", "calendar", "timeline", "look ahead", "schedule template", "new construction", "start date", "shift dates", "push back", "critical path", "float", "holidays", "work calendar", "start no earlier than", "grid", "spreadsheet", "predecessors", "activity id", "paste from excel", "what if", "what-if", "contract date", "variance", "milestone type"],
  },
  {
    id: "selections", name: "Selections", path: "/dashboard/selections", nav: "Sidebar → Jobs → Selections",
    summary: "Product and finish selections for clients, built from vendor pages into selection cards.",
    steps: [
      "Read and answer client comments on selections: Job → Selections. A banner counts new client comments; each card and the table's Latest comment column show the newest one with a \"new\" badge. The 💬 button on any row or card (every view) opens the comments panel: the whole thread, Reply (the client sees it under that selection in their portal and gets a notice) and Mark handled. The card preview and the editor show the same thread; the client's own words can't be edited. Client comments alert the job's team with Notifications on, always the Project Manager, and Admins if a job has no PM (bell, push and email).",
      "See everything a client sent on a job: the Client activity button (bottom right on every job page) or the Client Activity tab. Selection comments, portal messages, texts, emails, warranty requests, finished action items and Canvas briefs, newest first, with Needs reply on anything waiting. Counts show on the Selections, Messages, Communications and Client Activity tabs. Job Info → Internal Users warns when nobody would be alerted.",
      "Install the Chrome extension (CMI Selection Card Builder, captures products from vendor sites): Selections → Chrome Extension (or /dashboard/chrome-extension) → Download, unzip, open chrome://extensions, turn on Developer mode, Load unpacked → pick the CMI Selection Card Builder folder, then pin it. It uses your dashboard sign-in in that Chrome profile. Extension access per person is in Settings → Extension Access.",
      "Edit a selection from inside a job (Job → Selections → the pencil, or Create New → Manual Selection): the same editor as the Selections page slides in from the right, with every field (project, room, category, catalog product, size / finish / colors, client, vendor, subcontractor, designer, linked task, the four statuses, costs and dates, plus everything the Chrome extension captures: eyebrow, manufacturer, SKU, model #, short and long description, features (one per line), product URL and source page, selection group, and client / contractor / vendor visibility) and media uploads for the featured image, gallery and video (or URLs instead).",
      "Client responses to a selection: in their portal a client can Approve (with an optional note), mark it Not approved (saying what they would like instead) or just Comment, and change their decision later. Their notes build up, dated, in the selection's Client Comments; the job's team gets a notification and it is logged on the selection.",
      "Ask Claude (CMI connector): \"add a Kohler matte black faucet to the kitchen on the Olson job\", \"what selections on the Lillie job still need a decision?\", or \"mark the kitchen faucet ordered\". Claude can also duplicate a selection or reuse one on another job.",
      "Send selections to the client through Claude: \"send the kitchen selections to the client to approve by Nov 15\" — Claude shows which ones and sends only after you say yes; the client is notified and sees them in the portal.",
    ],
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
    summary: "Turn a job's client portal on, set progress, phase and next milestone, invite clients and publish client updates. What each client can see is set per contact under Job Info → Clients → Portal permissions (schedule, phases, photos, documents & files and messages are on by default; selections, financials, PM phone and warranty requests are opt-in). Items still need sharing on their own tab: on the job's Files tab, use the Client column (or select several → Share with client) or tick 'Share with client' before uploading.",
    keywords: ["client portal", "portal", "invite client", "client update", "progress", "preview as client", "milestones", "key dates"],
    steps: [
      "See what a client sees: Jobs → open the job → Client Portal → Client Access → Preview next to a client. The portal opens in a new tab as that client, read-only, for 30 minutes (an amber bar says so; nothing can be changed or sent). Works before the portal is switched on or the client is invited. Exit preview returns to the job.",
      "What clients see on their project: Home (action needed, latest project summary, key dates, recent updates and photos, their team), Updates, Progress (the job's own phases from its shared schedule), Schedule, Milestones (contract and client-decision milestones with the contract date, today's forecast and how many working days apart they are), Photos, Documents, Selections, Action Items, Punch List, Financials, Change Orders, Messages and Warranty — each only when allowed for that client. On a computer the project's pages are in a sidebar on the left (Home; Activity; Decisions; Build; Files; Money). On a phone or tablet the menu button (top left) opens every page, and a footer bar that scrolls sideways lists them too (the Hide tab on its top edge tucks it away; Show brings it back). The sun/moon button switches light and dark mode; it starts from the device's setting.",
      "Milestones show to the client when the milestone and its schedule are client-visible and it's a Contract or Client decision milestone (or has a contract date).",
    ],
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
    summary: "The public website's content: Portfolio, Team and Blog. (Messaging Consent, the SMS/email opt-in records, is under Communications → Messaging Consent.)",
    steps: [
      "Landing pages (Super Admin): Site Content → Landing pages lists them with Preview and Live links. Create or edit them by asking Claude (CMI connector), e.g. \"draft a landing page at /lp/kitchen-remodels\"; Claude shares a private preview link and publishes only after you confirm. Every publish is kept in history and can be rolled back.",
    ],
    keywords: ["site content", "website", "portfolio", "team", "blog", "messaging consent", "opt out", "landing page", "publish", "preview"],
  },
  {
    id: "ai-agents", name: "AI Agents (Bolt)", path: "/dashboard/agent", nav: "Sidebar → AI Agents",
    summary: "Chat with Bolt (this assistant), manage what it knows (Training) and see CMI's Paperclip agents. Open Paperclip at paperclip.constructedmatter.com.",
    steps: [
      "Approve a knowledge draft (one Claude or a teammate wrote): AI Agents → Training → open the Draft → Approve. Drafts aren't used by Bolt or Claude until approved.",
    ],
    keywords: ["bolt", "ai", "agent", "ai agents", "training", "paperclip", "chat", "knowledge", "draft", "approve", "sop"],
  },
  {
    id: "commitments", name: "Commitments", path: "/dashboard/commitments", nav: "Sidebar → Commitments",
    summary: "Promises and follow-ups from emails, meetings, calls and Slack, kept until they're done: who owns it, when it's due, who we're waiting on, and a link back to where it came from. Claude adds them when you approve them.",
    steps: [
      "See what you owe: Commitments → Mine. What others are waiting on you for: Waiting on me. Admins: Everyone.",
      "Close one: click Done and add a short note or link showing it happened (required). Dismiss (X) if it no longer applies; Reopen brings it back.",
      "Hand one off: Reassign → pick the person → they're notified.",
      "Capture commitments from a meeting: ask Claude \"what did we promise in today's meeting?\" — it suggests them, and adds only the ones you approve.",
    ],
    keywords: ["commitments", "promises", "follow ups", "follow-ups", "waiting on", "action items", "owed", "accountability"],
  },

  // ── Account & admin ──
  {
    id: "notifications", name: "Notifications (Broadcasts & Morning Briefing)", path: "/dashboard/notifications", nav: "Sidebar → Communications → Notifications",
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
    steps: [
      "Invite someone: User Management → add the user → open them → Preview Invite → Resend Invite.",
      "Give someone a second job title: open them → Edit → 'Also works on jobs as' → tick Project Manager and/or Superintendent → Save. They're then offered when a job's PM or Superintendent is picked, e.g. an owner who also runs jobs.",
    ],
    keywords: ["users", "staff", "invite", "roles", "permissions", "user management", "add employee", "job title", "project manager", "superintendent"],
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
    summary: "Tabs: General (appearance, Project Canvas visibility), Features (turn staged features on or off: feature flags), Claude (who can connect Claude to CMI data, who has company-wide access, and who may receive AI-generated email, SMS, DMs and notifications; Super Admin edits), Sidebar Navigation (hide any sidebar item for everyone; Super Admin), Extension Access (who may use the Selection Card Builder Chrome extension) and Credentials (which service keys are set).",
    steps: [
      "Turn a feature on or off (e.g. schedule_engine, schedule_builder, projections): Settings → Features → flip its switch; it takes effect within about 30 seconds.",
      "Company holidays and work days (Admin; schedule engine on): Settings → Scheduling → tick the working weekdays, add or remove holidays (Add CMI holidays fills a year) → Save. Critical-path schedules recalculate.",
      "Hide a sidebar item: Settings → Sidebar Navigation → switch it off.",
      "Give someone the company-wide (ownership) view in Claude: Settings → Claude → find the person → switch on Company-wide access.",
      "Let a client or vendor receive AI messages: Settings → Claude → Add a person → search them → switch on AI emails / AI text messages. Claude can then email them (from info@, replies come back to whoever asked) or text them, always after showing a preview and getting a yes. Opt-outs (STOP / unsubscribe) always win.",
      "Connect Claude to CMI: Settings → Claude → copy the connector URL → in Claude Team, Admin settings → Connectors → add a custom connector.",
      "Choose which AI apps may connect and what they may do: Settings → Claude → AI Apps, Activity & Trash → Connected apps → tick read / write / high (Super Admin). Add an app (ChatGPT, Codex) with its OAuth redirect URI.",
      "See what AI did, or undo an AI delete: Settings → Claude → AI Apps, Activity & Trash → Activity, or Trash → Restore (Super Admin / Admin). AI deletes always go to this trash, never permanently.",
      "Change how many emails, texts or deletes one person can do through AI per day: Settings → Claude → Daily limits per person → Save limits (Super Admin).",
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
    id: "take-off", name: "Take-Off", path: "/dashboard/take-off", nav: "Sidebar → Take-Off (when the Take-Off feature is turned on in Settings → Features)",
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
