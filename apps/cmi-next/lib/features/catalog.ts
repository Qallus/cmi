import {
  Activity, BarChart3, BookOpen, Bot, Briefcase, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck, ClipboardList, Cloud, Compass,
  CreditCard, FileBarChart, FileText, FolderKanban, Globe, HandshakeIcon, HardHat, IdCard, Inbox, KeyRound, LayoutDashboard,
  LayoutGrid, ListChecks, Map, Megaphone, MessageCircle, MessagesSquare, Mic, Newspaper, NotebookPen, Package, PanelLeft, PartyPopper, Phone,
  Plug, Printer, Puzzle, Ruler, Search, Settings, ShieldCheck, Sparkles, SquarePen, Sun, Target, ToggleRight, TrendingUp, User, UserPlus,
  UserRoundCog, Users, Workflow, type LucideIcon,
} from "lucide-react";
import { featureVisible, type FeatureRule } from "./visibility";

// Every CMI feature, in one place: what it does and where to find it. The
// "All features" slide-out on the Overview reads this list, filtered to what
// the signed-in person can open (the same roles and flags as the sidebar in
// components/dashboard/nav.tsx). Keep it in step with the nav and with Bolt's
// guide (lib/agent/dashboard-guide.ts).

export type Feature = FeatureRule & {
  group: FeatureGroup;
  title: string;
  /** Where it lives. Omit for an info-only entry (see `steps`). */
  href?: string;
  icon: LucideIcon;
  what: string;
  keywords?: string;
  /** Opens in a new tab (public site, outside links). */
  external?: boolean;
  /** How-to shown in the panel instead of (or as well as) a link. */
  steps?: string[];
  /** A value to copy, e.g. the Claude connector URL. */
  copy?: { label: string; value: string };
};

export const FEATURE_GROUPS = [
  "Start", "CRM", "Jobs", "Schedule", "Communication", "Money", "Reporting", "Files", "Marketing", "AI and integrations", "Public site", "Account",
] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

const STAFF = ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "staff"];
const SALES = ["super_admin", "admin", "project_manager", "estimator"];
const JOBS = ["super_admin", "admin", "project_manager", "estimator", "superintendent", "designer"];
const PEOPLE = ["super_admin", "admin", "project_manager", "designer", "estimator", "superintendent"];
const ADMIN = ["super_admin", "admin"];

export function featureCatalog(appUrl: string): Feature[] {
  return [
    // Start
    { group: "Start", title: "Overview", href: "/dashboard/overview", icon: LayoutDashboard, what: "Your dashboard: cards you can move, resize, hide and add." },
    { group: "Start", title: "Today", href: "/dashboard/today", icon: Sun, roles: PEOPLE, keywords: "briefing tasks meetings",
      what: "Your day: meetings, tasks due, overnight updates and what needs attention." },
    { group: "Start", title: "Search", icon: Search, keywords: "find ctrl k",
      what: "Search jobs, contacts, deals, files, schedules and pages from the top bar.",
      steps: ["Press Ctrl+K (⌘K on a Mac), or use the search box at the top of any page or on your Overview.", "Every word must match, in any order: \"waters 26\" finds The Waters Residence."] },
    { group: "Start", title: "Bolt (AI Agents)", href: "/dashboard/agent", icon: Sparkles, roles: PEOPLE, keywords: "ai chat assistant ask",
      what: "Ask Bolt about any job, deal or schedule, or how to do something in CMI. It can make changes for you." },
    { group: "Start", title: "Commitments", href: "/dashboard/commitments", icon: ListChecks, roles: STAFF, flag: "commitments",
      what: "What you and the team have promised, and when." },

    // CRM
    { group: "CRM", title: "Contacts", href: "/dashboard/contacts", icon: Users, roles: SALES, keywords: "people crm",
      what: "Everyone CMI works with, by type, with their deals, jobs and messages." },
    { group: "CRM", title: "Leads", href: "/dashboard/contacts?tab=Lead", icon: UserPlus, roles: SALES, what: "New people who might become clients." },
    { group: "CRM", title: "Prospects", href: "/dashboard/contacts?tab=Prospect", icon: Target, roles: SALES, what: "Contacts on a deal or in Pre-Con." },
    { group: "CRM", title: "Clients", href: "/dashboard/contacts?tab=Client", icon: HandshakeIcon, roles: SALES, what: "Clients with a job." },
    { group: "CRM", title: "Quotes and leads", href: "/dashboard/sales?tab=leads", icon: Inbox, roles: SALES, keywords: "website quote form",
      what: "Estimate requests from the website's quote form." },
    { group: "CRM", title: "Pipeline", href: "/dashboard/pipeline", icon: Workflow, roles: SALES, keywords: "deals funnel board",
      what: "Early deals from first contact to Closed Won, on a board or a table." },
    { group: "CRM", title: "Pre-Con", href: "/dashboard/sales", icon: TrendingUp, roles: SALES, keywords: "preconstruction opportunities",
      what: "Won deals being priced and planned before they become jobs." },
    { group: "CRM", title: "Trade Partners", href: "/dashboard/trade-partners", icon: HardHat, roles: SALES, flag: "prequalification", keywords: "subcontractor prequal coi msa",
      what: "Trade partner applications, MSA e-signatures, insurance (COI) and requalification." },
    { group: "CRM", title: "Interviews", href: "/dashboard/trade-partners", icon: ClipboardList, roles: SALES, flag: "prequalification",
      what: "Qualification meetings that write answers back onto the company profile. Trade Partners → Interviews tab." },

    // Jobs
    { group: "Jobs", title: "Jobs", href: "/dashboard/jobs", icon: Briefcase, roles: JOBS, what: "Every job, each with its own schedule, team, files, client portal and money." },
    { group: "Jobs", title: "Projects", href: "/dashboard/project-manager", icon: FolderKanban, roles: [...JOBS, "subcontractor"], keywords: "tasks board my tasks",
      what: "Project boards and tasks, including My Tasks." },
    { group: "Jobs", title: "Jobs Map", href: "/dashboard/jobs/map", icon: Map, roles: JOBS, what: "Every job on a map." },
    { group: "Jobs", title: "Job templates", href: "/dashboard/jobs/new-from-template", icon: Package, roles: ["super_admin", "admin", "project_manager"],
      what: "Start a job from a template with its schedule and tasks." },
    { group: "Jobs", title: "Schedules", href: "/dashboard/schedules", icon: CalendarClock, roles: STAFF, keywords: "gantt inspections calendar",
      what: "Job schedules with calendar, Gantt and grid views, inspections and lookaheads." },
    { group: "Jobs", title: "Selections", href: "/dashboard/selections", icon: SquarePen, roles: ["super_admin", "admin", "project_manager", "designer"], keywords: "finishes approvals",
      what: "Finish and fixture selections, sent to clients for approval." },
    { group: "Jobs", title: "Live Selection Builder", href: "/dashboard/selections/live-builder", icon: LayoutGrid, roles: ["super_admin", "admin", "project_manager", "designer"],
      what: "Turn vendor pages into selection cards." },
    { group: "Jobs", title: "Daily Logs", href: "/dashboard/daily-logs", icon: NotebookPen, roles: JOBS, keywords: "field reports",
      what: "Daily field reports with photos, weather and notes." },
    { group: "Jobs", title: "Punch Lists", href: "/dashboard/punch-lists", icon: ClipboardCheck, roles: STAFF, what: "Checklists on deals, Pre-Con and jobs, with dictation and templates." },
    { group: "Jobs", title: "Client Engagement", href: "/dashboard/client-engagement", icon: Users, roles: ["super_admin", "admin", "project_manager"],
      what: "How clients are using their portal." },
    { group: "Jobs", title: "Project Canvas", href: "/dashboard/canvas", icon: SquarePen, roles: PEOPLE, flag: "project_canvas",
      what: "Client photo markups and project briefs." },
    { group: "Jobs", title: "Take-Off", href: "/dashboard/take-off", icon: Ruler, roles: ["super_admin", "admin", "project_manager", "staff", "estimator"], flag: "take_off",
      what: "Measure quantities from plans." },

    // Schedule
    { group: "Schedule", title: "Bookings", href: "/dashboard/bookings", icon: CalendarRange, roles: SALES, keywords: "appointments booking page",
      what: "Appointments, booking pages and calendar sync." },
    { group: "Schedule", title: "Events", href: "/dashboard/events", icon: PartyPopper, roles: SALES, flag: "event_invitations", keywords: "invitation rsvp party",
      what: "Invitation pages with RSVPs, +1s, a guest list and animated themes." },

    // Communication
    { group: "Communication", title: "Communications", href: "/dashboard/communications", icon: MessageCircle, roles: SALES, keywords: "email sms inbox",
      what: "Email, texts and calls with contacts, in one inbox." },
    { group: "Communication", title: "Dialpad", href: "/dashboard/communications?panel=dialer", icon: Phone, roles: SALES, keywords: "call phone softphone",
      what: "Call from the CMI office line in your browser." },
    { group: "Communication", title: "Email templates", href: "/dashboard/communications?tab=templates", icon: FileText, roles: SALES,
      what: "Branded email templates, including the animated Hero block." },
    { group: "Communication", title: "Prints", href: "/dashboard/communications?tab=prints", icon: Printer, roles: SALES, keywords: "flyer pdf",
      what: "Flyers and print pieces built with the email blocks." },
    { group: "Communication", title: "Direct Messages", href: "/dashboard/direct-messages", icon: MessagesSquare, roles: STAFF, keywords: "dm chat",
      what: "Private messages between staff." },
    { group: "Communication", title: "Notifications and broadcasts", href: "/dashboard/notifications", icon: Megaphone, roles: ["super_admin"],
      what: "Send a broadcast to staff and clients, and manage the morning briefing." },
    { group: "Communication", title: "Messaging Consent", href: "/dashboard/messaging-consent", icon: ShieldCheck, roles: ADMIN, keywords: "opt in opt out stop",
      what: "Who has opted in or out of texts and emails." },
    { group: "Communication", title: "Recording Studio", href: "/dashboard/recording-studio", icon: Mic, roles: STAFF, keywords: "meeting transcribe summary",
      what: "Record meetings, transcribe them and get AI summaries." },

    // Money
    { group: "Money", title: "Projections", href: "/dashboard/projections", icon: BarChart3, roles: ADMIN, flag: "projections", keywords: "forecast revenue",
      what: "12-month revenue and workload forecast." },
    { group: "Money", title: "Billing", href: "/dashboard/billing", icon: CreditCard, roles: ["super_admin", "admin", "estimator"], keywords: "invoices",
      what: "Invoices and payments." },

    // Reporting
    { group: "Reporting", title: "Weekly reports", href: "/dashboard/reporting", icon: FileBarChart, roles: SALES, flag: "reporting",
      what: "Weekly workload meeting reports, editable in place." },
    { group: "Reporting", title: "Analytics", href: "/dashboard/reporting/analytics", icon: Activity, roles: SALES, flag: "reporting", what: "Charts across jobs, deals and schedules." },

    // Files
    { group: "Files", title: "Cloud", href: "/dashboard/cloud", icon: Cloud, roles: STAFF, keywords: "files drive upload",
      what: "Company files: folders, uploads and sharing." },
    { group: "Files", title: "Workspace", href: "/dashboard/documents", icon: FileText, keywords: "documents docs notes",
      what: "Documents, contracts and the collaborative Workspace editor." },

    // Marketing
    { group: "Marketing", title: "Business Cards", href: "/dashboard/business-cards", icon: IdCard, roles: STAFF, keywords: "qr nfc",
      what: "Your digital business card, shared by link or QR; people who save it become leads." },
    { group: "Marketing", title: "Site Content", href: "/dashboard/site-content", icon: Globe, roles: ["super_admin", "admin", "designer"], what: "Edit the public website's pages." },
    { group: "Marketing", title: "Portfolio", href: "/dashboard/portfolio", icon: LayoutGrid, roles: ["super_admin", "admin", "designer"], what: "Projects shown on the website." },
    { group: "Marketing", title: "Blog", href: "/dashboard/blog", icon: Newspaper, roles: ["super_admin", "admin", "designer"], what: "Blog posts for the website." },
    { group: "Marketing", title: "Team", href: "/dashboard/team", icon: Users, roles: ADMIN, what: "The team page on the website." },

    // AI and integrations
    {
      group: "AI and integrations", title: "Claude connector (MCP)", icon: Plug, roles: PEOPLE, keywords: "claude mcp ai connector",
      what: "Use CMI from Claude: jobs, deals, schedules, email, files and more, with confirmation before anything is sent.",
      steps: [
        "In Claude, open Settings → Connectors → Add custom connector.",
        "Paste the connector URL below and save.",
        "Sign in with your CMI dashboard login (your @constructedmatter.com email).",
        "Ask Claude things like \"What's due this week?\" or \"Draft an invite for the holiday party\".",
      ],
      copy: { label: "Connector URL", value: `${appUrl}/api/mcp` },
    },
    { group: "AI and integrations", title: "Claude access settings", href: "/dashboard/settings?tab=claude", icon: Sparkles, roles: ADMIN,
      what: "Who can connect Claude and what it can do: email, texts, company-wide access." },
    { group: "AI and integrations", title: "Paperclip agents", href: "/dashboard/agent", icon: Bot, roles: PEOPLE, keywords: "agents hermes",
      what: "CMI's AI agents, their work and approvals." },
    { group: "AI and integrations", title: "Chrome extension", href: "/dashboard/chrome-extension", icon: Puzzle, roles: ["super_admin", "admin", "project_manager", "designer"],
      keywords: "selection card capture", what: "Capture vendor products into selections from Chrome." },
    { group: "AI and integrations", title: "Integrations and keys", href: "/dashboard/settings?tab=credentials", icon: KeyRound, roles: ADMIN,
      keywords: "google plaud twilio resend", what: "Google Workspace, Plaud, Twilio and Resend status." },

    // Public site
    { group: "Public site", title: "Website", href: "/", icon: Globe, external: true, what: "constructedmatter.com home page." },
    { group: "Public site", title: "Book a meeting", href: "/book", icon: CalendarDays, external: true, what: "The public booking page clients use." },
    { group: "Public site", title: "Become a Trade Partner", href: "/become-a-trade-partner", icon: HardHat, external: true, what: "Where trade partners apply." },
    { group: "Public site", title: "Contact form", href: "/contact", icon: MessageCircle, external: true, what: "The website's contact page." },
    { group: "Public site", title: "Client portal sign-in", href: "/client/login", icon: BookOpen, external: true, roles: JOBS,
      what: "Where clients sign in to see their jobs, schedules, selections and messages." },

    // Account
    { group: "Account", title: "My Profile", href: "/dashboard/my-profile", icon: User, what: "Your details, photo and notification preferences." },
    { group: "Account", title: "User Management", href: "/dashboard/users", icon: UserRoundCog, roles: ADMIN, what: "Invite people and set their roles." },
    { group: "Account", title: "Settings", href: "/dashboard/settings", icon: Settings, roles: ADMIN, what: "Company settings." },
    { group: "Account", title: "Feature flags", href: "/dashboard/settings?tab=features", icon: ToggleRight, roles: ADMIN, what: "Turn features on or off." },
    { group: "Account", title: "Sidebar navigation", href: "/dashboard/settings?tab=sidebar", icon: PanelLeft, roles: ["super_admin"], what: "Hide sidebar items company-wide." },
    { group: "Account", title: "Bolt's guide", href: "/dashboard/agent", icon: Compass, roles: PEOPLE, keywords: "help how to",
      what: "Ask Bolt how anything in CMI works." },
  ];
}

/** The features this person can open, with an optional search. */
export function visibleFeatures(list: Feature[], role: string | null | undefined, flags: Record<string, boolean>, q = ""): Feature[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((f) => {
    if (!featureVisible(f, role, flags)) return false;
    const text = `${f.title} ${f.what} ${f.group} ${f.keywords ?? ""}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}
