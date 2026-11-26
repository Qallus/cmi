// Server data for the Overview dashboard. Loads only what the person's layout
// shows (and is allowed to see), each part on its own, so one slow or broken
// source never takes the page down: a failed part comes back null and its
// card says so.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadFlags } from "@/lib/flags";
import { publicAppUrl } from "@/lib/twilio";
import { buildBriefing, greetingFor, type BriefingItem } from "@/lib/briefing/build";
import { loadStaffNotifications } from "@/lib/notifications/staff";
import { getUnreadCount } from "@/lib/direct-messages/data";
import { storageUsedBytes } from "@/lib/files/data";
import { loadOverviewData, type OverviewData } from "@/lib/overview/data";
import { schedulesNeedingALook, type ScheduleNeedingLook } from "@/lib/schedules/health-data";
import { loadAssignedOpenItems } from "@/lib/punch/data";
import { calendarEvents } from "@/lib/google/workspace";
import { listApprovals, listIssues, listAgents, paperclipConfigured } from "@/lib/paperclip/client";
import { DEAL_STAGE_META } from "@/lib/deals/stages";
import { loadCallStats } from "@/lib/communications/call-stats";
import type { CallSummary, Count, DayPoint } from "@/lib/communications/call-stats-core";
import { canReadFinancials } from "@/lib/agent/access";
import { cardAllowed, canManageWhatsNew, canSetDashboardDefault } from "./access";
import { BLANK, normalize, STANDARD, typesIn, type CardType, type Layout } from "./layout";

export type { Count, DayPoint };
export type EventRow = { id: string; title: string; startsAt: string; allDay: boolean; kind: "appointment" | "meeting" | "deadline"; location: string | null; href: string };
export type TaskCard = BriefingItem & { bucket: "overdue" | "today" | "week" };
export type WhatsNewItem = { id: string; title: string; body: string; href: string | null; icon: string | null; tag: string | null; published_at: string | null };
export type NoteItem = { id: string; title: string; subtitle: string; time: string; href: string };

export type DashboardData = {
  firstName: string;
  greeting: string;
  role: string;
  appUrl: string;
  flags: Record<string, boolean>;
  canSetDefault: boolean;
  canManageNews: boolean;
  calls: CallSummary | null;
  texts: { sent: Count; received: Count; series: DayPoint[] } | null;
  emails: Count | null;
  bookings: Count | null;
  calendar: { week: number; month: EventRow[]; upcoming: EventRow[] };
  notifications: { unread: number; items: NoteItem[] } | null;
  messages: { unread: number } | null;
  alerts: BriefingItem[] | null;
  tasks: TaskCard[] | null;
  nextUp: (BriefingItem & { when: string }) | null;
  agents: { configured: boolean; approvals: { title: string; href: string }[]; issues: { title: string; href: string }[]; agents: { name: string; status: string }[] } | null;
  jobAlerts: ScheduleNeedingLook[] | null;
  files: { count: number; bytes: number; mine: number } | null;
  recentFiles: { id: string; name: string; created_at: string; mime_type: string | null; size_bytes: number | null }[] | null;
  jobs: { total: number; byStatus: { name: string; value: number }[] } | null;
  pipeline: { open: number; value: number; byStage: { name: string; value: number }[] } | null;
  precon: number | null;
  punch: number | null;
  dailyLogs: number | null;
  leads: Count | null;
  overview: OverviewData | null;
  whatsNew: WhatsNewItem[];
};

export type DashboardStaff = { id: string; email: string; role_slug: string; display_name: string | null };

const TZ = "America/Phoenix";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** Midnight (Arizona, UTC-7) at the start of this month and last month, as ISO. */
function monthBounds(now = new Date()) {
  const [y, m] = ymd(now).split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 7));
  const lastStart = new Date(Date.UTC(m === 1 ? y - 1 : y, m === 1 ? 11 : m - 2, 1, 7));
  return { start: start.toISOString(), lastStart: lastStart.toISOString() };
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

const pretty = (v: string) => v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ── Layout ─────────────────────────────────────────────────────────────────

export async function loadDashboardLayout(staff: DashboardStaff, flags: Record<string, boolean>): Promise<{ layout: Layout | null; stored: boolean; chooser: boolean }> {
  const allow = (t: CardType) => cardAllowed(t, staff.role_slug, flags);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("dashboard_layouts").select("layout").eq("staff_user_id", staff.id).maybeSingle();
  if (error) return { layout: null, stored: false, chooser: true };
  if (data?.layout) return { layout: normalize(data.layout, allow), stored: true, chooser: false };
  // Not set up yet: the company default (a Super Admin picks it).
  const { data: def } = await sb.from("dashboard_defaults").select("preset, layout").eq("id", true).maybeSingle();
  if (def?.layout) return { layout: normalize(def.layout, allow), stored: true, chooser: false };
  if (def?.preset === "standard") return { layout: normalize(STANDARD, allow), stored: true, chooser: false };
  if (def?.preset === "blank") return { layout: normalize(BLANK, allow), stored: true, chooser: false };
  return { layout: null, stored: true, chooser: true };
}

export async function saveDashboardLayout(staffId: string, layout: Layout): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("dashboard_layouts")
    .upsert({ staff_user_id: staffId, layout, updated_at: new Date().toISOString() }, { onConflict: "staff_user_id" });
  if (error) throw new Error(error.message);
}

// ── Data ───────────────────────────────────────────────────────────────────

/**
 * Data for the cards in `layout` (or Standard, for the chooser preview).
 * Everything is scoped to what this person may see.
 */
export async function loadDashboardData(staff: DashboardStaff, layout: Layout | null, flagsIn?: Record<string, boolean>): Promise<DashboardData> {
  const flags = flagsIn ?? (await loadFlags());
  const role = staff.role_slug;
  const want = typesIn(layout ?? STANDARD);
  const has = (...types: CardType[]) => types.some((t) => want.has(t) && cardAllowed(t, role, flags));
  const sb = getSupabaseAdmin();
  const now = new Date();
  const { start, lastStart } = monthBounds(now);
  const firstName = (staff.display_name ?? staff.email).trim().split(/[\s@]/)[0] ?? "";

  const count = async (table: string, build: (q: ReturnType<typeof sb.from>) => unknown) => {
    const { count: c } = (await (build(sb.from(table)) as any)) as { count: number | null };
    return c ?? 0;
  };
  const monthCount = async (table: string, column: string, extra?: (q: any) => any): Promise<Count> => {
    const base = (from: string, to?: string) => {
      let q = sb.from(table).select("id", { count: "exact", head: true }).gte(column, from);
      if (to) q = q.lt(column, to);
      return extra ? extra(q) : q;
    };
    const [a, b] = await Promise.all([base(start), base(lastStart, start)]);
    return { now: a.count ?? 0, last: b.count ?? 0 };
  };

  const needBriefing = has("my_tasks", "next_up", "stat_alerts");
  const briefing = needBriefing ? safe(() => buildBriefing({ id: staff.id, email: staff.email, display_name: staff.display_name, role_slug: role }, now)) : Promise.resolve(null);

  const [
    calls, texts, emails, bookings, calendar, notifications, messages, brief, agents, jobAlerts,
    files, recentFiles, jobs, pipeline, precon, punch, dailyLogs, leads, overview, whatsNew,
  ] = await Promise.all([
    has("stat_calls", "stat_outbound", "stat_inbound", "stat_missed", "chart_calls") ? safe(loadCallStats) : null,
    has("stat_sms", "chart_texts") ? safe(async () => {
      const sms = (dir: string) => monthCount("messages", "sent_at", (q) => q.eq("channel", "sms").eq("direction", dir));
      const [sent, received] = await Promise.all([sms("outbound"), sms("inbound")]);
      const since = new Date(now.getTime() - 29 * 86_400_000).toISOString();
      const { data } = await sb.from("messages").select("direction, sent_at").eq("channel", "sms").gte("sent_at", since).limit(5000);
      const days = new Map<string, DayPoint>();
      for (let i = 29; i >= 0; i--) { const d = ymd(new Date(now.getTime() - i * 86_400_000)); days.set(d, { day: d, a: 0, b: 0 }); }
      for (const r of data ?? []) { const p = days.get(ymd(new Date(r.sent_at as string))); if (p) { if (r.direction === "outbound") p.a++; else p.b++; } }
      return { sent, received, series: [...days.values()] };
    }) : null,
    has("stat_emails") ? safe(() => monthCount("messages", "sent_at", (q) => q.eq("channel", "email").eq("direction", "outbound"))) : null,
    has("stat_bookings") ? safe(() => monthCount("booking_appointments", "start_time", (q) => q.neq("status", "canceled"))) : null,
    has("mini_calendar", "upcoming", "stat_calendar", "next_up") ? safe(() => loadCalendar(staff, now)) : null,
    has("notifications", "stat_notifications") ? safe(async () => {
      const items = await loadStaffNotifications({ email: staff.email, staffId: staff.id, isAdmin: canReadFinancials(role), role });
      return { unread: items.length, items: items.slice(0, 6) };
    }) : null,
    has("stat_messages") ? safe(async () => ({ unread: await getUnreadCount(staff.id) })) : null,
    briefing,
    has("agent_alert", "paperclip_agents") ? safe(loadAgents) : null,
    has("job_alert", "schedules_look") ? safe(() => schedulesNeedingALook(6)) : null,
    has("stat_files") ? safe(async () => {
      const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
      const [all, bytes, mine] = await Promise.all([
        count("files", (q) => q.select("id", { count: "exact", head: true }).is("deleted_at", null)),
        storageUsedBytes(),
        count("files", (q) => q.select("id", { count: "exact", head: true }).is("deleted_at", null).eq("uploaded_by", staff.id).gte("created_at", weekAgo)),
      ]);
      return { count: all, bytes, mine };
    }) : null,
    has("recent_files") ? safe(async () => {
      const { data } = await sb.from("files").select("id, name, created_at, mime_type, size_bytes").is("deleted_at", null).order("created_at", { ascending: false }).limit(8);
      return (data ?? []) as DashboardData["recentFiles"];
    }) : null,
    has("stat_jobs", "chart_jobs") ? safe(async () => {
      const { data } = await sb.from("jobs").select("status").is("archived_at", null).or("is_template.is.null,is_template.eq.false");
      const by = new Map<string, number>();
      for (const j of data ?? []) by.set(String(j.status ?? "unknown"), (by.get(String(j.status ?? "unknown")) ?? 0) + 1);
      return { total: data?.length ?? 0, byStatus: [...by.entries()].map(([k, v]) => ({ name: pretty(k), value: v })).sort((a, b) => b.value - a.value) };
    }) : null,
    has("stat_pipeline", "chart_pipeline") ? safe(async () => {
      const { data } = await sb.from("deals").select("stage, estimated_value").is("archived_at", null);
      const by = new Map<string, number>();
      let open = 0, value = 0;
      for (const d of data ?? []) {
        const meta = DEAL_STAGE_META[d.stage as keyof typeof DEAL_STAGE_META];
        if (!meta?.open) continue;
        open++;
        value += Number(d.estimated_value) || 0;
        by.set(meta.label, (by.get(meta.label) ?? 0) + 1);
      }
      const order = Object.values(DEAL_STAGE_META).filter((m) => m.open).sort((a, b) => a.order - b.order).map((m) => m.label);
      return { open, value, byStage: order.map((name) => ({ name, value: by.get(name) ?? 0 })) };
    }) : null,
    has("stat_precon") ? safe(() => count("pipeline_opportunities", (q) => q.select("id", { count: "exact", head: true }).is("archived_at", null))) : null,
    has("stat_punch") ? safe(async () => (await loadAssignedOpenItems(staff.id)).length) : null,
    has("stat_daily_logs") ? safe(() => count("daily_logs", (q) => q.select("id", { count: "exact", head: true }).gte("log_date", ymd(new Date(now.getTime() - 6 * 86_400_000))))) : null,
    has("stat_contacts") ? safe(() => monthCount("contacts", "created_at", (q) => q.eq("type", "Lead"))) : null,
    has("company_counts", "recent_activity", "quick_actions", "upcoming") ? safe(loadOverviewData) : null,
    has("whats_new") ? safe(async () => {
      const { data } = await sb.from("whats_new").select("id, title, body, href, icon, tag, published_at").not("published_at", "is", null)
        .lte("published_at", now.toISOString()).order("published_at", { ascending: false }).limit(12);
      return (data ?? []) as WhatsNewItem[];
    }) : null,
  ]);

  const tasks: TaskCard[] | null = brief
    ? [
        ...brief.tasks.overdue.map((t) => ({ ...t, bucket: "overdue" as const })),
        ...brief.tasks.today.map((t) => ({ ...t, bucket: "today" as const })),
        ...brief.tasks.week.map((t) => ({ ...t, bucket: "week" as const })),
      ]
    : null;

  // Next up: the next meeting today, else the first task due.
  let nextUp: DashboardData["nextUp"] = null;
  const nextEvent = calendar?.upcoming.find((e) => new Date(e.startsAt) >= now);
  if (brief?.meetings[0]) nextUp = { ...brief.meetings[0], when: brief.meetings[0].tag ?? "Today" };
  else if (nextEvent) nextUp = { title: nextEvent.title, href: nextEvent.href, detail: nextEvent.location, when: whenLabel(nextEvent.startsAt) };
  else if (tasks?.[0]) nextUp = { ...tasks[0], when: tasks[0].tag ?? (tasks[0].bucket === "overdue" ? "Overdue" : "Due") };

  return {
    firstName,
    greeting: greetingFor(now),
    role,
    appUrl: publicAppUrl(),
    flags,
    canSetDefault: canSetDashboardDefault(role),
    canManageNews: canManageWhatsNew(role),
    calls,
    texts,
    emails,
    bookings,
    calendar: calendar ?? { week: 0, month: [], upcoming: [] },
    notifications,
    messages,
    alerts: brief ? brief.attention : null,
    tasks,
    nextUp,
    agents,
    jobAlerts,
    files,
    recentFiles,
    jobs,
    pipeline,
    precon,
    punch,
    dailyLogs,
    leads,
    overview,
    whatsNew: whatsNew ?? [],
  };
}

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const day = ymd(d) === ymd(new Date()) ? "Today" : d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" })}`;
}

/** Your bookings (and Google Calendar, when connected) for this month and the next two weeks. */
async function loadCalendar(staff: DashboardStaff, now: Date) {
  const sb = getSupabaseAdmin();
  const [y, m] = ymd(now).split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1, 7));
  const to = new Date(Math.max(Date.UTC(y, m, 1, 7), now.getTime() + 14 * 86_400_000));
  const { data } = await sb.from("booking_appointments")
    .select("id, title, start_time, location, status")
    .or(`staff_user_id.eq.${staff.id},assigned_staff_user_id.eq.${staff.id}`)
    .neq("status", "canceled").gte("start_time", from.toISOString()).lt("start_time", to.toISOString())
    .order("start_time").limit(200);
  const rows: EventRow[] = (data ?? []).map((b) => ({
    id: `b-${b.id}`, title: (b.title as string) || "Booking", startsAt: b.start_time as string, allDay: false, kind: "appointment",
    location: (b.location as string | null) ?? null, href: "/dashboard/bookings",
  }));
  const google = await safe(async () => (await calendarEvents(staff.email, from, to)).events as {
    id?: string; summary?: string; location?: string; start?: { dateTime?: string; date?: string };
  }[]);
  for (const e of google ?? []) {
    const startsAt = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T12:00:00-07:00` : null);
    if (!startsAt) continue;
    rows.push({ id: `g-${e.id}`, title: e.summary || "Event", startsAt: new Date(startsAt).toISOString(), allDay: !e.start?.dateTime, kind: "meeting", location: e.location ?? null, href: "/dashboard/today" });
  }
  rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const weekEnd = now.getTime() + 7 * 86_400_000;
  return {
    week: rows.filter((r) => { const t = Date.parse(r.startsAt); return t >= now.getTime() && t < weekEnd; }).length,
    month: rows,
    upcoming: rows.filter((r) => Date.parse(r.startsAt) >= now.getTime() - 3_600_000).slice(0, 8),
  };
}

async function loadAgents(): Promise<DashboardData["agents"]> {
  if (!paperclipConfigured()) return { configured: false, approvals: [], issues: [], agents: [] };
  const [ap, is, ag] = await Promise.all([listApprovals(), listIssues(), listAgents()]);
  const list = <T,>(r: { ok?: boolean; data?: T } | unknown): T | [] => ((r as { data?: T })?.data ?? []) as T | [];
  const approvals = (list(ap) as { id?: string; title?: string; summary?: string; status?: string }[])
    .filter((a) => !a.status || /pending|open|waiting/i.test(a.status)).slice(0, 5)
    .map((a) => ({ title: a.title ?? a.summary ?? "Approval needed", href: "/dashboard/agent" }));
  const issues = (list(is) as { id?: string; title?: string; status?: string }[])
    .filter((i) => !i.status || !/done|closed|resolved/i.test(i.status)).slice(0, 5)
    .map((i) => ({ title: i.title ?? "Issue", href: "/dashboard/agent" }));
  const agents = (list(ag) as { name?: string; status?: string }[]).slice(0, 8).map((a) => ({ name: a.name ?? "Agent", status: a.status ?? "" }));
  return { configured: true, approvals, issues, agents };
}
