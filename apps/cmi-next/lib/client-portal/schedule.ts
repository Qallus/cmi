import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadNetwork } from "@/lib/schedules/engine";
import { contractVariance } from "@/lib/schedules/whatif";
import { orderMilestones, type ClientMilestone } from "./milestones";

// Client-visible schedule milestones for a job. The job's PM board is
// board_id = job.id; we surface only client_visible items and use the
// client-facing dates (client_start_date/client_end_date) when set, falling
// back to the internal dates. This is the client side of per-role scheduling.
export type ClientScheduleItem = {
  id: string;
  title: string;
  phase: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  progress: number;
};

export async function loadClientScheduleItems(jobId: string): Promise<ClientScheduleItem[]> {
  const sb = getSupabaseAdmin();
  // Legacy PM board items (project_schedule_items) + the new Multi-Schedule
  // Builder items, both filtered to client-visible.
  const [{ data: legacy }, groups] = await Promise.all([
    sb.from("project_schedule_items")
      .select("id, title, phase, start_date, end_date, client_start_date, client_end_date, status, progress, type")
      .eq("board_id", jobId).eq("client_visible", true).neq("type", "project")
      .order("end_date", { ascending: true }).limit(100),
    loadClientScheduleGroups(jobId),
  ]);
  const out: ClientScheduleItem[] = (legacy ?? []).map((r) => ({
    id: r.id as string, title: r.title as string, phase: (r.phase as string | null) ?? null,
    start: (r.client_start_date as string | null) ?? (r.start_date as string | null),
    end: (r.client_end_date as string | null) ?? (r.end_date as string | null),
    status: (r.status as string | null) ?? null, progress: Number(r.progress) || 0,
  }));
  for (const g of groups) for (const it of g.items) out.push({ id: it.id, title: it.title, phase: g.schedule_name, start: it.start, end: it.end, status: it.status, progress: it.percent_complete });
  return out;
}

export type ClientScheduleGroup = {
  schedule_id: string;
  schedule_name: string;
  schedule_type: string;
  items: { id: string; title: string; kind: string; start: string | null; end: string | null; status: string | null; percent_complete: number; note: string | null }[];
};

// Client-visible schedules (schedule.visibility = client_visible) and their
// client-visible items only. Internal notes are never included.
export async function loadClientScheduleGroups(jobId: string): Promise<ClientScheduleGroup[]> {
  const sb = getSupabaseAdmin();
  const { data: scheds } = await sb
    .from("job_schedules")
    .select("id, name, type")
    .eq("job_id", jobId).eq("visibility", "client_visible").neq("status", "archived")
    .order("is_master", { ascending: false }).order("sort_order");
  if (!scheds?.length) return [];
  const ids = scheds.map((s) => s.id);
  const { data: items } = await sb
    .from("schedule_items")
    .select("id, schedule_id, title, kind, start_date, end_date, status, percent_complete, client_notes, client_visible")
    .in("schedule_id", ids).eq("client_visible", true)
    .order("start_date", { ascending: true, nullsFirst: false });
  return scheds.map((s) => ({
    schedule_id: s.id, schedule_name: s.name, schedule_type: s.type,
    items: (items ?? []).filter((i) => i.schedule_id === s.id).map((i) => ({
      id: i.id, title: i.title, kind: i.kind, start: i.start_date, end: i.end_date,
      status: i.status, percent_complete: Number(i.percent_complete) || 0, note: i.client_notes ?? null,
    })),
  })).filter((g) => g.items.length);
}

// Contract and client-decision milestones for the client's Milestones page:
// client-visible ones on client-visible schedules, with the contract date, the
// forecast and how far apart they are in working days on that schedule's calendar.
export async function loadClientMilestones(jobId: string): Promise<ClientMilestone[]> {
  const sb = getSupabaseAdmin();
  const { data: scheds } = await sb.from("job_schedules").select("id, name")
    .eq("job_id", jobId).eq("visibility", "client_visible").neq("status", "archived");
  if (!scheds?.length) return [];
  const { data: items } = await sb.from("schedule_items")
    .select("id, schedule_id, title, kind, start_date, end_date, status, percent_complete, actual_finish, milestone_type, contract_date, client_notes")
    .in("schedule_id", scheds.map((s) => s.id)).eq("client_visible", true).eq("kind", "milestone");
  const picked = (items ?? []).filter((i) => i.status !== "cancelled" && (i.milestone_type === "contract" || i.milestone_type === "client_decision" || i.contract_date));
  if (!picked.length) return [];
  // Working-day variance needs the job's calendar; fall back to none if it can't load.
  let net: Awaited<ReturnType<typeof loadNetwork>> | null = null;
  if (picked.some((i) => i.contract_date)) { try { net = await loadNetwork(picked[0].schedule_id); } catch { net = null; } }
  const name = new Map(scheds.map((s) => [s.id, s.name]));
  return orderMilestones(picked.map((i) => {
    const done = i.status === "complete" || Number(i.percent_complete) >= 100;
    return {
      id: i.id, title: i.title,
      type: i.milestone_type === "contract" ? "contract" : i.milestone_type === "client_decision" ? "client_decision" : "other",
      forecast: i.start_date, contract: i.contract_date, done, doneOn: done ? i.actual_finish ?? i.start_date : null,
      variance: net && i.contract_date ? contractVariance(net, { ...i, kind: "milestone" }) : null,
      schedule: name.get(i.schedule_id) ?? "Schedule", note: i.client_notes ?? null,
    } satisfies ClientMilestone;
  }));
}

export type ClientPhase = { id: string; name: string; state: "done" | "current" | "upcoming"; start: string | null; end: string | null; tasks: number; done: number };

// The job's phases for the Progress tab, from its main client-visible schedule
// (the master first). A phase is done when all its shared tasks are done; the
// first one that isn't is the current phase. Empty when there's no schedule.
export async function loadClientPhases(jobId: string): Promise<ClientPhase[]> {
  const sb = getSupabaseAdmin();
  const { data: scheds } = await sb.from("job_schedules").select("id")
    .eq("job_id", jobId).eq("visibility", "client_visible").neq("status", "archived")
    .order("is_master", { ascending: false }).order("sort_order").limit(1);
  const sid = scheds?.[0]?.id;
  if (!sid) return [];
  const [{ data: phases }, { data: items }] = await Promise.all([
    sb.from("schedule_phases").select("id, name, sort_order").eq("schedule_id", sid).order("sort_order"),
    sb.from("schedule_items").select("phase_id, status, percent_complete, start_date, end_date").eq("schedule_id", sid).eq("client_visible", true).neq("status", "cancelled"),
  ]);
  let currentSet = false;
  return (phases ?? []).map((p) => {
    const mine = (items ?? []).filter((i) => i.phase_id === p.id);
    const done = mine.filter((i) => i.status === "complete" || Number(i.percent_complete) >= 100).length;
    const starts = mine.map((i) => i.start_date).filter(Boolean).sort();
    const ends = mine.map((i) => i.end_date ?? i.start_date).filter(Boolean).sort();
    let state: ClientPhase["state"] = mine.length && done === mine.length ? "done" : "upcoming";
    if (state !== "done" && mine.length && !currentSet) { state = "current"; currentSet = true; }
    return { id: p.id, name: p.name, state, start: starts[0] ?? null, end: ends[ends.length - 1] ?? null, tasks: mine.length, done };
  }).filter((p) => p.tasks > 0);
}
