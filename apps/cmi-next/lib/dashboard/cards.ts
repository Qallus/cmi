import {
  AlarmClock, Bell, BellRing, Bot, BookOpen, Briefcase, CalendarCheck, CalendarDays, ChartArea, ChartBar, ChartColumn, ChartPie, ClipboardCheck,
  CloudSun, Compass, Files, FileText, Filter, HardHat, LayoutGrid, Link2, ListChecks, ListTodo, Mail, MessageSquareText, MessagesSquare, Mic,
  NotebookPen, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Settings, ShieldAlert, Sparkles, TrendingUp, Users, WandSparkles, Zap,
  Activity, CalendarClock, type LucideIcon,
} from "lucide-react";
import type { CardType, Size } from "./layout";

// Every card the Overview can show: what it is, where it sits in "Add card",
// its starting size, and whether you can have more than one.

export const CATEGORIES = ["Stats", "Activity", "Communication", "Schedule", "Projects", "Sales", "Files", "Tools", "Charts", "Company", "Info"] as const;
export type Category = (typeof CATEGORIES)[number];

export type CardMeta = { title: string; what: string; icon: LucideIcon; category: Category; size: Size; repeat?: boolean };

export const CARDS: Record<CardType, CardMeta> = {
  get_started: { title: "Get started", what: "Set up your profile, Claude, your business card and more.", icon: WandSparkles, category: "Info", size: "xl" },
  whats_new: { title: "What's new", what: "New CMI features worth trying.", icon: Sparkles, category: "Info", size: "xl" },

  search: { title: "Search", what: "Search jobs, contacts, deals, files and pages.", icon: Search, category: "Tools", size: "lg" },
  all_features: { title: "All features", what: "Every CMI feature, one click away.", icon: LayoutGrid, category: "Tools", size: "xs" },
  clock: { title: "Date and time", what: "Today's date and the time in Arizona.", icon: AlarmClock, category: "Tools", size: "sm", repeat: true },
  weather: { title: "Weather", what: "Weather at the office or where you are.", icon: CloudSun, category: "Tools", size: "sm", repeat: true },
  dialpad: { title: "Dialpad", what: "Call from the CMI office line (desktop).", icon: Phone, category: "Communication", size: "md" },
  recorder: { title: "Recorder", what: "Record a meeting into Recording Studio.", icon: Mic, category: "Tools", size: "md" },
  notepad: { title: "Notepad", what: "Quick notes that save as you type.", icon: NotebookPen, category: "Tools", size: "md", repeat: true },
  ask_bolt: { title: "Ask Bolt", what: "Ask Bolt about jobs, deals, schedules or how to use CMI.", icon: Bot, category: "Tools", size: "lg" },
  quick_links: { title: "Quick links", what: "Your most used pages as buttons.", icon: Link2, category: "Tools", size: "md" },
  task_list: { title: "To-do list", what: "A personal checklist with reminders.", icon: ListTodo, category: "Tools", size: "md", repeat: true },

  notifications: { title: "Notifications", what: "Your latest notifications.", icon: BellRing, category: "Activity", size: "md" },
  next_up: { title: "Next up", what: "Your next meeting or to-do.", icon: CalendarCheck, category: "Activity", size: "md" },
  agent_alert: { title: "AI agents", what: "Approvals and alerts from Paperclip agents and Bolt.", icon: Bot, category: "Activity", size: "md" },
  job_alert: { title: "Job alerts", what: "Schedules that need a look and job issues.", icon: HardHat, category: "Activity", size: "md" },

  my_tasks: { title: "My Tasks", what: "Your due tasks: deals, schedules, punch items and reports.", icon: ListChecks, category: "Activity", size: "xl" },

  mini_calendar: { title: "Calendar", what: "This month, with the day's agenda.", icon: CalendarDays, category: "Schedule", size: "lg" },
  upcoming: { title: "Upcoming", what: "Upcoming bookings and appointments.", icon: BookOpen, category: "Schedule", size: "md" },

  stat_calls: { title: "Call stats", what: "Calls this month, in, out and missed (office line).", icon: Phone, category: "Stats", size: "sm" },
  stat_outbound: { title: "Outbound", what: "Calls made this month.", icon: PhoneOutgoing, category: "Stats", size: "xs" },
  stat_inbound: { title: "Inbound", what: "Calls received this month.", icon: PhoneIncoming, category: "Stats", size: "xs" },
  stat_missed: { title: "Missed", what: "Calls missed this month.", icon: PhoneMissed, category: "Stats", size: "xs" },
  stat_sms: { title: "SMS", what: "Texts sent and received this month.", icon: MessageSquareText, category: "Stats", size: "sm" },
  stat_bookings: { title: "Booking stats", what: "Bookings this month.", icon: CalendarCheck, category: "Stats", size: "xs" },
  stat_calendar: { title: "Calendar stats", what: "Your events in the next 7 days.", icon: CalendarDays, category: "Stats", size: "xs" },
  stat_notifications: { title: "Notifications", what: "Unread notifications.", icon: Bell, category: "Stats", size: "xs" },
  stat_messages: { title: "Messages", what: "Unread direct messages.", icon: MessagesSquare, category: "Stats", size: "xs" },
  stat_alerts: { title: "Alerts", what: "Things that need your attention.", icon: ShieldAlert, category: "Stats", size: "xs" },
  stat_emails: { title: "Emails", what: "Emails sent this month.", icon: Mail, category: "Stats", size: "xs" },
  stat_files: { title: "File stats", what: "Cloud files and storage used.", icon: Files, category: "Stats", size: "sm" },
  stat_jobs: { title: "Jobs", what: "Active jobs by status.", icon: Briefcase, category: "Projects", size: "sm" },
  stat_pipeline: { title: "Pipeline", what: "Open deals and their value.", icon: Filter, category: "Sales", size: "sm" },
  stat_precon: { title: "Pre-Con", what: "Projects in Pre-Con.", icon: TrendingUp, category: "Sales", size: "xs" },
  stat_punch: { title: "Punch items", what: "Open punch items assigned to you.", icon: ClipboardCheck, category: "Projects", size: "xs" },
  stat_daily_logs: { title: "Daily logs", what: "Daily logs this week.", icon: NotebookPen, category: "Projects", size: "xs" },
  stat_contacts: { title: "Leads", what: "Leads and new contacts this month.", icon: Users, category: "Sales", size: "xs" },

  company_counts: { title: "Company counts", what: "Contacts, projects, bookings, quotes and more.", icon: Activity, category: "Company", size: "xl" },
  recent_activity: { title: "Recent activity", what: "The newest contacts, quotes, bookings and documents.", icon: Activity, category: "Company", size: "lg" },
  quick_actions: { title: "Quick actions", what: "Start a new contact, quote, booking and more.", icon: Zap, category: "Company", size: "md" },
  revenue_outlook: { title: "Revenue outlook", what: "The 12-month revenue forecast (admins).", icon: TrendingUp, category: "Company", size: "lg" },

  schedules_look: { title: "Schedules to check", what: "Schedules with late or at-risk items.", icon: CalendarClock, category: "Projects", size: "md" },

  chart_calls: { title: "Calls by day", what: "Calls in and out over 30 days.", icon: ChartArea, category: "Charts", size: "lg", repeat: true },
  chart_texts: { title: "Texts by day", what: "Texts sent and received over 30 days.", icon: ChartColumn, category: "Charts", size: "lg", repeat: true },
  chart_pipeline: { title: "Pipeline by stage", what: "Open deals at each stage.", icon: ChartBar, category: "Charts", size: "lg", repeat: true },
  chart_jobs: { title: "Jobs by status", what: "How the jobs are split by status.", icon: ChartPie, category: "Charts", size: "md", repeat: true },

  paperclip_agents: { title: "Paperclip agents", what: "Your AI agents, their issues and approvals.", icon: Bot, category: "Tools", size: "md" },
  recent_files: { title: "Recent files", what: "The newest files in Cloud.", icon: FileText, category: "Files", size: "lg" },
  admin_shortcuts: { title: "Admin shortcuts", what: "Users, feature flags, Claude access and settings.", icon: Settings, category: "Tools", size: "md" },
};

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  Stats: ChartColumn, Activity: Bell, Communication: Phone, Schedule: CalendarDays, Projects: HardHat, Sales: Filter, Files,
  Tools: Compass, Charts: ChartArea, Company: Activity, Info: Sparkles,
};
