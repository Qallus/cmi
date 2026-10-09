// The morning briefing: one person's day, gathered from everywhere it lives.
//
// Meetings, tasks, overnight changes on their jobs and deals, and anything
// waiting on a reply all already exist in the dashboard, spread across a dozen
// tables. This pulls them into one shape that both the Today page and the
// 6 AM email render. Every source is best-effort: one failing query makes the
// briefing thinner, never empty.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadStaffNotifications } from "@/lib/notifications/staff";
import { assigneeStaffIds } from "@/lib/schedules/notify";
import type { Assignee } from "@/lib/schedules/types";

/** The team works in Scottsdale. Arizona has no DST, so this is always UTC-7. */
export const BRIEFING_TZ = "America/Phoenix";

export type BriefingStaff = { id: string; email: string; display_name: string | null; role_slug: string };

export type BriefingItem = {
  title: string;
  detail?: string | null;
  href: string;
  /** Short label on the right: a time, a due date, a source. */
  tag?: string | null;
  tone?: "danger" | "warn" | "default";
};

export type BriefingUpdate = { title: string; subtitle?: string | null; href: string; lines: string[] };

export type Briefing = {
  staff: { id: string; name: string; firstName: string; email: string };
  /** "Thursday, October 8" in Phoenix time. */
  dateLabel: string;
  generatedAt: string;
  meetings: BriefingItem[];
  tasks: { overdue: BriefingItem[]; today: BriefingItem[]; week: BriefingItem[]; undated: number };
  updates: BriefingUpdate[];
  attention: BriefingItem[];
};

const MAX_PER_LIST = 8;

/** YYYY-MM-DD for an instant, in Phoenix. */
function ymd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: BRIEFING_TZ });
}

function addDays(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The UTC instant at which a Phoenix calendar day starts. */
function phoenixMidnight(dateYmd: string): Date {
  return new Date(`${dateYmd}T07:00:00Z`);
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: BRIEFING_TZ, hour: "numeric", minute: "2-digit" });
}

function shortDate(dateYmd: string): string {
  return new Date(`${dateYmd}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

function snippet(text: string | null | undefined, max = 110): string {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

/**
 * Staff who get a briefing: everyone on the team, including people who were
 * invited but haven't signed in yet (the email is often what brings them in).
 * Never client logins.
 */
export async function loadBriefingStaff(): Promise<BriefingStaff[]> {
  const { data } = await getSupabaseAdmin()
    .from("staff_users")
    .select("id, email, display_name, role_slug, status")
    .in("status", ["active", "invited"])
    .neq("role_slug", "client");
  return ((data ?? []) as BriefingStaff[]).filter((s) => !!s.email);
}

export async function buildBriefing(staff: BriefingStaff, now = new Date()): Promise<Briefing> {
  const today = ymd(now);
  const weekEnd = addDays(today, 6);
  const dayStart = phoenixMidnight(today);
  const dayEnd = phoenixMidnight(addDays(today, 1));
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const name = (staff.display_name ?? "").trim() || staff.email;

  const [meetings, tasks, updates, attention] = await Promise.all([
    safe([], () => loadMeetings(staff.id, dayStart, dayEnd)),
    safe({ overdue: [], today: [], week: [], undated: 0 }, () => loadTasks(staff.id, today, weekEnd)),
    safe([], () => loadUpdates(staff.id, since)),
    safe([], () => loadAttention(staff)),
  ]);

  return {
    staff: { id: staff.id, name, firstName: name.split(/\s+/)[0] || name, email: staff.email },
    dateLabel: now.toLocaleDateString("en-US", { timeZone: BRIEFING_TZ, weekday: "long", month: "long", day: "numeric" }),
    generatedAt: now.toISOString(),
    meetings,
    tasks,
    updates,
    attention,
  };
}

// ─── Meetings ─────────────────────────────────────────────────────
async function loadMeetings(staffId: string, dayStart: Date, dayEnd: Date): Promise<BriefingItem[]> {
  const { data } = await getSupabaseAdmin()
    .from("booking_appointments")
    .select("id, title, start_time, end_time, status, location, meeting_url, project_name, customer_first_name, customer_last_name, company_name")
    .or(`staff_user_id.eq.${staffId},assigned_staff_user_id.eq.${staffId}`)
    .gte("start_time", dayStart.toISOString())
    .lt("start_time", dayEnd.toISOString())
    .is("canceled_at", null)
    .neq("status", "canceled")
    .order("start_time", { ascending: true });

  return ((data ?? []) as Record<string, string | null>[]).map((b) => {
    const who = [b.customer_first_name, b.customer_last_name].filter(Boolean).join(" ") || b.company_name || null;
    const where = b.meeting_url ? "Video call" : b.location;
    return {
      title: b.title || (who ? `Meeting with ${who}` : "Meeting"),
      detail: [who, b.project_name, where].filter(Boolean).join(" · ") || null,
      href: "/dashboard/bookings",
      tag: b.start_time ? `${timeLabel(b.start_time)}${b.end_time ? `–${timeLabel(b.end_time)}` : ""}` : null,
      tone: b.status === "pending" ? "warn" : "default",
    } satisfies BriefingItem;
  });
}

// ─── Tasks ────────────────────────────────────────────────────────
type DatedTask = BriefingItem & { due: string | null; sortKey: string };

async function loadTasks(staffId: string, today: string, weekEnd: string): Promise<Briefing["tasks"]> {
  const supabase = getSupabaseAdmin();
  const all: DatedTask[] = [];

  // Pipeline / interview tasks.
  await safe(null, async () => {
    const { data } = await supabase.from("deal_tasks")
      .select("id, title, description, due_at, deal_id, interview_id")
      .eq("assigned_to", staffId).is("completed_at", null);
    const rows = (data ?? []) as { id: string; title: string; description: string | null; due_at: string | null; deal_id: string | null; interview_id: string | null }[];
    const dealIds = [...new Set(rows.map((r) => r.deal_id).filter((x): x is string => !!x))];
    const deals = new Map<string, { title: string | null; job_number: string | null }>();
    if (dealIds.length) {
      const { data: d } = await supabase.from("deals").select("id, title, job_number").in("id", dealIds);
      for (const row of (d ?? []) as { id: string; title: string | null; job_number: string | null }[]) deals.set(row.id, row);
    }
    for (const t of rows) {
      const deal = t.deal_id ? deals.get(t.deal_id) : null;
      all.push({
        title: t.title,
        detail: [deal?.job_number, deal?.title].filter(Boolean).join(" · ") || snippet(t.description) || null,
        href: t.deal_id ? `/dashboard/pipeline/${t.deal_id}?task=${t.id}` : t.interview_id ? `/dashboard/interviews/${t.interview_id}` : "/dashboard/pipeline",
        due: t.due_at ? ymd(new Date(t.due_at)) : null,
        sortKey: t.due_at ?? "9999",
      });
    }
    return null;
  });

  // Job schedule items. Assignees are JSON, which PostgREST can't filter
  // reliably, so open items due within the week are narrowed here.
  await safe(null, async () => {
    const { data } = await supabase.from("schedule_items")
      .select("id, title, end_date, status, job_id, assignees")
      .not("status", "in", "(complete,cancelled)")
      .lte("end_date", weekEnd)
      .limit(2000);
    const mine = ((data ?? []) as { id: string; title: string; end_date: string | null; job_id: string | null; assignees: Assignee[] | null }[])
      .filter((i) => assigneeStaffIds(i.assignees).includes(staffId));
    const jobIds = [...new Set(mine.map((i) => i.job_id).filter((x): x is string => !!x))];
    const jobs = await jobLabels(jobIds);
    for (const i of mine) {
      all.push({
        title: i.title,
        detail: i.job_id ? jobs.get(i.job_id) ?? "Schedule" : "Schedule",
        href: i.job_id ? `/dashboard/jobs/${i.job_id}/schedule` : "/dashboard/schedules",
        due: i.end_date,
        sortKey: i.end_date ?? "9999",
      });
    }
    return null;
  });

  // Action items from the weekly workload meeting.
  await safe(null, async () => {
    const { data } = await supabase.from("report_action_items")
      .select("id, body, due_date")
      .eq("owner_staff_id", staffId).is("completed_at", null);
    for (const a of (data ?? []) as { id: string; body: string; due_date: string | null }[]) {
      all.push({ title: snippet(a.body, 90), detail: "Workload meeting", href: "/dashboard/reporting", due: a.due_date, sortKey: a.due_date ?? "9999" });
    }
    return null;
  });

  all.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const strip = ({ due, sortKey: _s, ...item }: DatedTask, tone: BriefingItem["tone"], tag: string | null): BriefingItem => {
    void due; void _s;
    return { ...item, tone, tag };
  };
  return {
    overdue: all.filter((t) => t.due && t.due < today).slice(0, MAX_PER_LIST)
      .map((t) => strip(t, "danger", `Was due ${shortDate(t.due as string)}`)),
    today: all.filter((t) => t.due === today).slice(0, MAX_PER_LIST)
      .map((t) => strip(t, "warn", "Due today")),
    week: all.filter((t) => t.due && t.due > today && t.due <= weekEnd).slice(0, MAX_PER_LIST)
      .map((t) => strip(t, "default", shortDate(t.due as string))),
    undated: all.filter((t) => !t.due).length,
  };
}

async function jobLabels(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const { data } = await getSupabaseAdmin().from("jobs").select("id, job_name, job_number").in("id", ids);
  for (const j of (data ?? []) as { id: string; job_name: string | null; job_number: string | null }[]) {
    out.set(j.id, j.job_number || j.job_name || "Job");
  }
  return out;
}

// ─── Overnight updates on their jobs and deals ───────────────────
async function loadUpdates(staffId: string, since: string): Promise<BriefingUpdate[]> {
  const supabase = getSupabaseAdmin();
  const out: BriefingUpdate[] = [];

  // Deals they own: logged touches and stage moves by anyone but them.
  await safe(null, async () => {
    const { data: deals } = await supabase.from("deals")
      .select("id, title, job_number").eq("owner_id", staffId).is("archived_at", null);
    const owned = (deals ?? []) as { id: string; title: string | null; job_number: string | null }[];
    if (!owned.length) return null;
    const ids = owned.map((d) => d.id);
    const [acts, moves] = await Promise.all([
      supabase.from("activities").select("deal_id, type, summary, created_by, created_by_name, occurred_at")
        .in("deal_id", ids).gte("created_at", since).order("occurred_at", { ascending: false }),
      supabase.from("deal_stage_history").select("deal_id, to_stage, changed_by, changed_by_id, changed_at")
        .in("deal_id", ids).gte("changed_at", since).order("changed_at", { ascending: false }),
    ]);
    const lines = new Map<string, string[]>();
    const push = (id: string, line: string) => lines.set(id, [...(lines.get(id) ?? []), line]);
    for (const m of (moves.data ?? []) as { deal_id: string; to_stage: string; changed_by: string | null; changed_by_id: string | null }[]) {
      if (m.changed_by_id === staffId) continue;
      push(m.deal_id, `Moved to ${m.to_stage.replace(/_/g, " ")}${m.changed_by ? ` by ${m.changed_by}` : ""}`);
    }
    for (const a of (acts.data ?? []) as { deal_id: string; type: string; summary: string | null; created_by: string | null; created_by_name: string | null }[]) {
      if (a.created_by === staffId) continue;
      const what = a.type.replace(/_/g, " ");
      push(a.deal_id, `${what[0]?.toUpperCase()}${what.slice(1)}${a.created_by_name ? ` by ${a.created_by_name}` : ""}${a.summary ? `: ${snippet(a.summary, 80)}` : ""}`);
    }
    for (const d of owned) {
      const l = lines.get(d.id);
      if (!l?.length) continue;
      out.push({ title: (d.title ?? "").trim() || "Untitled deal", subtitle: d.job_number ? `Deal · ${d.job_number}` : "Deal", href: `/dashboard/pipeline/${d.id}`, lines: l.slice(0, 4) });
    }
    return null;
  });

  // Jobs they're on the team for.
  await safe(null, async () => {
    const { data: team } = await supabase.from("job_internal_users").select("job_id").eq("staff_user_id", staffId);
    const jobIds = [...new Set(((team ?? []) as { job_id: string }[]).map((t) => t.job_id))];
    if (!jobIds.length) return null;
    const [{ data: logs }, { data: jobs }] = await Promise.all([
      supabase.from("job_activity_logs").select("job_id, actor, actor_id, action, detail, created_at")
        .in("job_id", jobIds).gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("jobs").select("id, job_name, job_number").in("id", jobIds).is("archived_at", null),
    ]);
    const lines = new Map<string, string[]>();
    for (const l of (logs ?? []) as { job_id: string; actor: string | null; actor_id: string | null; action: string; detail: string | null }[]) {
      if (l.actor_id === staffId) continue;
      const line = `${snippet(l.detail || l.action.replace(/_/g, " "), 90)}${l.actor ? ` — ${l.actor}` : ""}`;
      lines.set(l.job_id, [...(lines.get(l.job_id) ?? []), line]);
    }
    for (const j of (jobs ?? []) as { id: string; job_name: string | null; job_number: string | null }[]) {
      const l = lines.get(j.id);
      if (!l?.length) continue;
      out.push({ title: j.job_name || "Job", subtitle: j.job_number ? `Job · ${j.job_number}` : "Job", href: `/dashboard/jobs/${j.id}`, lines: l.slice(0, 4) });
    }
    return null;
  });

  return out.slice(0, MAX_PER_LIST);
}

// ─── Waiting on a response ────────────────────────────────────────
async function loadAttention(staff: BriefingStaff): Promise<BriefingItem[]> {
  const items: BriefingItem[] = [];

  // Unread bell items, minus the kinds the meetings and tasks cards already show.
  await safe(null, async () => {
    const bell = await loadStaffNotifications({
      email: staff.email,
      staffId: staff.id,
      isAdmin: ["super_admin", "admin"].includes(staff.role_slug),
      role: staff.role_slug,
    });
    const relevant = bell.filter((b) => b.kind !== "booking" && b.kind !== "schedule" && !b.title.startsWith("New task:"));
    // Website form submissions arrive in bulk (much of it solicitation), so
    // they share one line rather than crowding out messages from people.
    const forms = relevant.filter((b) => b.kind === "submission");
    for (const n of relevant) {
      if (n.kind === "submission" && forms.length > 1) continue;
      items.push({ title: n.title, detail: n.subtitle || null, href: n.href, tag: relativeAge(n.time) });
    }
    if (forms.length > 1) {
      const names = forms.map((f) => f.subtitle.split(/\s—\s|:\s/)[0].trim()).filter(Boolean).slice(0, 3);
      items.unshift({
        title: `${forms.length} new contact form submissions`,
        detail: `${names.join(", ")}${forms.length > names.length ? ` and ${forms.length - names.length} more` : ""}`,
        href: forms[0].href,
        tag: relativeAge(forms[0].time),
      });
    }
    return null;
  });

  // Their meeting recordings from the last two weeks with action items still open.
  await safe(null, async () => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await getSupabaseAdmin().from("meetings")
      .select("id, title, meeting_date, action_items")
      .or(`staff_user_id.eq.${staff.id},created_by.eq.${staff.id}`)
      .gte("meeting_date", since)
      .order("meeting_date", { ascending: false });
    for (const m of (data ?? []) as { id: string; title: string | null; meeting_date: string | null; action_items: { done?: boolean }[] | null }[]) {
      const open = (m.action_items ?? []).filter((a) => !a.done).length;
      if (!open) continue;
      items.unshift({
        title: `${open} open action item${open === 1 ? "" : "s"} from ${m.title || "a meeting"}`,
        detail: "Meeting notes",
        href: "/dashboard/recording-studio",
        tag: m.meeting_date ? relativeAge(m.meeting_date) : null,
        tone: "warn",
      });
    }
    return null;
  });

  return items.slice(0, MAX_PER_LIST);
}

function relativeAge(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

/** Totals for the stat row and the summary. */
export function briefingCounts(b: Briefing) {
  return {
    meetings: b.meetings.length,
    overdue: b.tasks.overdue.length,
    dueToday: b.tasks.today.length,
    dueWeek: b.tasks.week.length,
    updates: b.updates.length,
    attention: b.attention.length,
  };
}
