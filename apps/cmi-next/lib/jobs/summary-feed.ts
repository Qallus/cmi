// The live cards on a job's Summary page: what's past due and due today,
// this week's agenda, recent team activity, daily logs / client updates, and
// the client's action items.
//
// Everything here already lives elsewhere — the job's schedules, its Projects
// & Tasks board, its punch lists, its activity logs. This gathers the open
// work into one shape so staff can act on a job without leaving the Summary.
// Each source is best-effort: one failing query thins a card, never breaks it.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assigneeStaffIds } from "@/lib/schedules/notify";
import type { Assignee } from "@/lib/schedules/types";
import { loadDailyLogs } from "@/lib/daily-logs/data";
import { loadJobActionItems } from "@/lib/action-items/data";
import type { ActionItem } from "@/lib/action-items/types";
import { BRIEFING_TZ } from "@/lib/briefing/build";
import type { JobWithRelations } from "./types";

export type SummaryViewer = { id: string; email: string; display_name: string | null };

/** schedule = Multi-Schedule item · task = Projects & Tasks board · punch = punch list item. */
export type SummaryTaskSource = "schedule" | "task" | "punch";

export type SummaryTask = {
  key: string;
  source: SummaryTaskSource;
  id: string;
  title: string;
  detail: string | null;
  /** YYYY-MM-DD */
  due: string | null;
  assignee: string | null;
  mine: boolean;
  href: string;
};

export type SummaryMeeting = { id: string; title: string; date: string; time: string | null; detail: string | null };

export type SummaryActivity = { key: string; at: string; actor: string | null; text: string };

export type SummaryLog = {
  key: string;
  kind: "log" | "update";
  at: string;
  date: string | null;
  title: string;
  snippet: string;
  author: string | null;
  clientVisible: boolean;
  href: string;
};

/** A job record that is waiting on the client — offered as a one-click action item. */
export type ActionCandidate = { type: "selection" | "change_order" | "invoice"; id: string; label: string; title: string };

export type JobSummaryFeed = {
  viewer: { id: string; name: string };
  today: string;
  weekEnd: string;
  tasks: SummaryTask[];
  meetings: SummaryMeeting[];
  activity: SummaryActivity[];
  logs: SummaryLog[];
  actionItems: ActionItem[];
  actionCandidates: ActionCandidate[];
};

const LIMIT = 12;

function ymd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: BRIEFING_TZ });
}
function addDays(dateYmd: string, days: number): string {
  const d = new Date(`${dateYmd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function plain(html: string | null | undefined, max = 140): string {
  const t = (html ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
function humanize(s: string): string {
  const t = s.replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
async function safe<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}
/** Staff display names by id (daily logs store the author's email, not their name). */
async function staffNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  const out = new Map<string, string>();
  if (!unique.length) return out;
  const { data } = await getSupabaseAdmin().from("staff_users").select("id, display_name, email").in("id", unique);
  for (const s of (data ?? []) as { id: string; display_name: string | null; email: string | null }[]) out.set(s.id, s.display_name || s.email || "Staff");
  return out;
}

/** Does a free-text board assignee ("Jane Doe" or "Jane Doe - Staff") name this viewer? */
function namesViewer(assignee: string | null, viewer: SummaryViewer): boolean {
  if (!assignee) return false;
  const a = assignee.split(" - ")[0].trim().toLowerCase();
  const name = (viewer.display_name ?? "").trim().toLowerCase();
  return (!!name && a === name) || a === viewer.email.toLowerCase();
}

export async function loadJobSummaryFeed(job: JobWithRelations, viewer: SummaryViewer, now = new Date()): Promise<JobSummaryFeed> {
  const today = ymd(now);
  const weekEnd = addDays(today, 6);
  const clientIds = job.contacts.map((c) => c.contact_id).filter(Boolean) as string[];

  const [schedule, board, punch, meetings, activity, logs, actionItems, candidates] = await Promise.all([
    safe([], () => loadScheduleTasks(job.id, viewer)),
    safe([], () => loadBoardTasks(job.id, viewer)),
    safe([], () => loadPunchTasks(job.id, viewer)),
    safe([], () => loadMeetings(clientIds, today, weekEnd)),
    safe([], () => loadActivity(job.id)),
    safe([], () => loadLogs(job.id, viewer.id)),
    safe([], () => loadJobActionItems(job.id)),
    safe([], () => loadActionCandidates(job.id)),
  ]);

  const tasks = [...schedule, ...board, ...punch].sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  const linked = new Set(actionItems.filter((a) => a.status === "open" || a.status === "in_progress").map((a) => a.related_entity_id).filter(Boolean));

  return {
    viewer: { id: viewer.id, name: (viewer.display_name ?? "").trim() || viewer.email },
    today,
    weekEnd,
    tasks,
    meetings,
    activity,
    logs,
    actionItems,
    actionCandidates: candidates.filter((c) => !linked.has(c.id)),
  };
}

// ─── Open work ────────────────────────────────────────────────────
async function loadScheduleTasks(jobId: string, viewer: SummaryViewer): Promise<SummaryTask[]> {
  const sb = getSupabaseAdmin();
  const { data: schedules } = await sb.from("job_schedules").select("id, name").eq("job_id", jobId).neq("status", "archived");
  const live = new Map(((schedules ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));
  if (!live.size) return [];
  const { data } = await sb.from("schedule_items")
    .select("id, schedule_id, title, end_date, start_date, status, assignees")
    .in("schedule_id", [...live.keys()])
    .not("status", "in", "(complete,cancelled)");
  return ((data ?? []) as { id: string; schedule_id: string; title: string; end_date: string | null; start_date: string | null; assignees: Assignee[] | null }[]).map((i) => ({
    key: `schedule:${i.id}`,
    source: "schedule" as const,
    id: i.id,
    title: i.title,
    detail: live.get(i.schedule_id) ?? "Schedule",
    due: i.end_date ?? i.start_date,
    assignee: (i.assignees ?? []).map((a) => a.name).filter(Boolean).join(", ") || null,
    mine: assigneeStaffIds(i.assignees).includes(viewer.id),
    href: `/dashboard/jobs/${jobId}/schedule`,
  }));
}

async function loadBoardTasks(jobId: string, viewer: SummaryViewer): Promise<SummaryTask[]> {
  const { data } = await getSupabaseAdmin().from("project_schedule_items")
    .select("id, title, project_title, end_date, assignee, status, type")
    .eq("board_id", jobId)
    .in("type", ["task", "milestone"])
    .not("status", "in", "(complete,canceled)");
  return ((data ?? []) as { id: string; title: string; project_title: string | null; end_date: string | null; assignee: string | null }[]).map((t) => ({
    key: `task:${t.id}`,
    source: "task" as const,
    id: t.id,
    title: t.title,
    detail: t.project_title ? `Projects & Tasks · ${t.project_title}` : "Projects & Tasks",
    due: t.end_date,
    assignee: t.assignee ? t.assignee.split(" - ")[0] : null,
    mine: namesViewer(t.assignee, viewer),
    href: `/dashboard/jobs/${jobId}/projects`,
  }));
}

async function loadPunchTasks(jobId: string, viewer: SummaryViewer): Promise<SummaryTask[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("punch_items")
    .select("id, title, location, due_date, assigned_to, list:punch_lists!inner(id, title, job_id, archived_at)")
    .eq("list.job_id", jobId).is("list.archived_at", null).is("completed_at", null)
    .limit(300);
  type Row = { id: string; title: string; location: string | null; due_date: string | null; assigned_to: string | null; list: { title: string } };
  const rows = (data ?? []) as unknown as Row[];
  const staffIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean) as string[])];
  const names = new Map<string, string>();
  if (staffIds.length) {
    const { data: staff } = await sb.from("staff_users").select("id, display_name, email").in("id", staffIds);
    for (const s of (staff ?? []) as { id: string; display_name: string | null; email: string | null }[]) names.set(s.id, s.display_name || s.email || "Staff");
  }
  return rows.map((r) => ({
    key: `punch:${r.id}`,
    source: "punch" as const,
    id: r.id,
    title: r.location ? `${r.location}: ${r.title}` : r.title,
    detail: `Punch list · ${r.list.title}`,
    due: r.due_date,
    assignee: r.assigned_to ? names.get(r.assigned_to) ?? null : null,
    mine: r.assigned_to === viewer.id,
    href: `/dashboard/jobs/${jobId}/punch-list`,
  }));
}

// Meetings with this job's clients in the coming week.
async function loadMeetings(clientIds: string[], today: string, weekEnd: string): Promise<SummaryMeeting[]> {
  if (!clientIds.length) return [];
  const { data } = await getSupabaseAdmin().from("booking_appointments")
    .select("id, title, start_time, location, meeting_url, status, customer_first_name, customer_last_name")
    .in("contact_id", clientIds)
    .gte("start_time", `${today}T07:00:00Z`)
    .lt("start_time", `${addDays(weekEnd, 1)}T07:00:00Z`)
    .is("canceled_at", null)
    .neq("status", "canceled")
    .order("start_time", { ascending: true });
  return ((data ?? []) as Record<string, string | null>[]).map((b) => {
    const start = new Date(b.start_time as string);
    const who = [b.customer_first_name, b.customer_last_name].filter(Boolean).join(" ");
    return {
      id: b.id as string,
      title: b.title || (who ? `Meeting with ${who}` : "Meeting"),
      date: ymd(start),
      time: start.toLocaleTimeString("en-US", { timeZone: BRIEFING_TZ, hour: "numeric", minute: "2-digit" }),
      detail: b.meeting_url ? "Video call" : b.location,
    };
  });
}

// ─── Recent activity ──────────────────────────────────────────────
const SCHEDULE_VERBS: Record<string, string> = {
  item_created: "Added schedule item", item_updated: "Updated schedule item", item_deleted: "Removed schedule item",
  schedule_created: "Created schedule", schedule_updated: "Updated schedule", schedule_archived: "Archived schedule",
};

async function loadActivity(jobId: string): Promise<SummaryActivity[]> {
  const sb = getSupabaseAdmin();
  const [jobLogs, sched, punchDone, logs, updates] = await Promise.all([
    sb.from("job_activity_logs").select("id, actor, action, detail, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(LIMIT),
    sb.from("schedule_activity").select("id, actor_name, action, detail, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(LIMIT),
    sb.from("punch_items").select("id, title, completed_at, completed_by_name, list:punch_lists!inner(job_id)").eq("list.job_id", jobId).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(LIMIT),
    sb.from("daily_logs").select("id, created_by, created_by_id, created_at, visibility").eq("job_id", jobId).order("created_at", { ascending: false }).limit(LIMIT),
    sb.from("job_updates").select("id, title, posted_by, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(LIMIT),
  ]);

  const out: SummaryActivity[] = [];
  for (const l of (jobLogs.data ?? []) as { id: string; actor: string | null; action: string; detail: string | null; created_at: string }[]) {
    out.push({ key: `job:${l.id}`, at: l.created_at, actor: l.actor, text: plain(l.detail, 120) || humanize(l.action) });
  }
  for (const a of (sched.data ?? []) as { id: string; actor_name: string | null; action: string; detail: Record<string, unknown> | null; created_at: string }[]) {
    const title = typeof a.detail?.title === "string" ? ` “${a.detail.title}”` : "";
    out.push({ key: `sched:${a.id}`, at: a.created_at, actor: a.actor_name, text: `${SCHEDULE_VERBS[a.action] ?? humanize(a.action)}${title}` });
  }
  for (const p of (punchDone.data ?? []) as unknown as { id: string; title: string; completed_at: string; completed_by_name: string | null }[]) {
    out.push({ key: `punch:${p.id}`, at: p.completed_at, actor: p.completed_by_name, text: `Completed punch item “${p.title}”` });
  }
  const logRows = (logs.data ?? []) as { id: string; created_by: string | null; created_by_id: string | null; created_at: string; visibility: string | null }[];
  const authors = await staffNames(logRows.map((d) => d.created_by_id));
  for (const d of logRows) {
    if (d.visibility === "private") continue;
    out.push({ key: `log:${d.id}`, at: d.created_at, actor: (d.created_by_id && authors.get(d.created_by_id)) || d.created_by, text: "Posted a daily log" });
  }
  for (const u of (updates.data ?? []) as { id: string; title: string; posted_by: string | null; created_at: string }[]) {
    out.push({ key: `update:${u.id}`, at: u.created_at, actor: u.posted_by, text: `Posted a client update “${u.title}”` });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
}

// ─── Daily logs + client updates ──────────────────────────────────
async function loadLogs(jobId: string, viewerId: string): Promise<SummaryLog[]> {
  const [logs, updates] = await Promise.all([
    safe([], () => loadDailyLogs(jobId, viewerId)),
    safe([] as { id: string; title: string; body: string | null; posted_by: string | null; visibility: string | null; created_at: string }[], async () => {
      const { data } = await getSupabaseAdmin().from("job_updates").select("id, title, body, posted_by, visibility, created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(LIMIT);
      return (data ?? []) as { id: string; title: string; body: string | null; posted_by: string | null; visibility: string | null; created_at: string }[];
    }),
  ]);
  const authors = await staffNames(logs.slice(0, LIMIT).map((l) => l.created_by_id));
  const out: SummaryLog[] = [
    ...logs.slice(0, LIMIT).map((l) => ({
      key: `log:${l.id}`, kind: "log" as const, at: l.created_at, date: l.log_date,
      title: l.title || "Daily log", snippet: plain(l.notes), author: (l.created_by_id && authors.get(l.created_by_id)) || l.created_by, clientVisible: !!l.client_visible,
      href: `/dashboard/jobs/${jobId}/daily-logs`,
    })),
    ...updates.map((u) => ({
      key: `update:${u.id}`, kind: "update" as const, at: u.created_at, date: u.created_at.slice(0, 10),
      title: u.title, snippet: plain(u.body), author: u.posted_by, clientVisible: u.visibility === "client_visible",
      href: `/dashboard/jobs/${jobId}/client-portal`,
    })),
  ];
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

// ─── Records waiting on the client ────────────────────────────────
async function loadActionCandidates(jobId: string): Promise<ActionCandidate[]> {
  const sb = getSupabaseAdmin();
  const [sels, assoc, cos, invs] = await Promise.all([
    sb.from("project_selections").select("id, name, approval_status").eq("job_id", jobId).in("approval_status", ["pending", "revision_requested"]),
    sb.from("selection_associations").select("selection:project_selections!inner(id, name, approval_status)").eq("job_id", jobId),
    sb.from("change_orders").select("id, co_number, title, status").eq("job_id", jobId).in("status", ["submitted", "pending_approval"]),
    sb.from("invoices").select("id, invoice_number, title, status").eq("job_id", jobId).in("status", ["sent", "partial", "overdue"]),
  ]);
  const out: ActionCandidate[] = [];
  const seen = new Set<string>();
  const selRows = [
    ...((sels.data ?? []) as { id: string; name: string; approval_status: string }[]),
    ...((assoc.data ?? []) as unknown as { selection: { id: string; name: string; approval_status: string } }[]).map((a) => a.selection)
      .filter((s) => s && ["pending", "revision_requested"].includes(s.approval_status)),
  ];
  for (const s of selRows) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ type: "selection", id: s.id, label: `Selection · ${s.name}`, title: `Review and approve selection: ${s.name}` });
  }
  for (const c of (cos.data ?? []) as { id: string; co_number: string | null; title: string }[]) {
    const name = [c.co_number, c.title].filter(Boolean).join(" ");
    out.push({ type: "change_order", id: c.id, label: `Change order · ${name}`, title: `Review and sign change order ${name}` });
  }
  for (const i of (invs.data ?? []) as { id: string; invoice_number: string | null; title: string | null; status: string }[]) {
    const name = [i.invoice_number, i.title].filter(Boolean).join(" ") || "invoice";
    out.push({ type: "invoice", id: i.id, label: `Invoice · ${name} (${i.status})`, title: `Pay invoice ${name}` });
  }
  return out;
}
