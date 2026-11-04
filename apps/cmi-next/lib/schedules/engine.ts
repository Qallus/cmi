// Schedule engine, database side (Spec R2 Phase 1). Loads a schedule's whole
// network (every schedule on its job, or under its deal / Pre-Con / selection),
// runs the critical path, and saves dates and float. The math is in
// engine-core.ts and cpm.ts. Everything here is behind the schedule_engine
// flag; schedules in 'legacy' mode keep the old forward push.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import { runCpm } from "./cpm.ts";
import { CALENDAR_DAYS, dayNum, spanW, type CalendarLevel } from "./calendar.ts";
import { buildInput, calendarFor, diffResult, planSwitch, blockedMove, wouldLoop, type EngineChange, type Network, type NetItem, type NetDep, type NetSchedule } from "./engine-core.ts";
import { notifyScheduleEvent, assigneeStaffIds } from "./notify";
import { DEPENDENCY_ABBR, type Assignee, type SchedulingMode } from "./types";

type Actor = { id?: string | null; name?: string | null };

/** A schedule rule was broken (a move earlier than its links allow, a loop). */
export class ScheduleRuleError extends Error {
  status = 409;
}

export const ENGINE_FLAG = "schedule_engine";

const ITEM_COLS = "id, schedule_id, phase_id, title, kind, status, start_date, end_date, duration_days, duration_unit, is_locked, constraint_type, constraint_date, actual_start, actual_finish, percent_complete, remaining_duration, activity_id, early_start, early_finish, late_start, late_finish, total_float, free_float, is_critical, milestone_type, contract_date, assignees";
const SCHED_COLS = "id, job_id, name, scheduling_mode, workdays, start_date, target_completion, status_date, scope_type, scope_id, status";

/** Phase 2 progress: status date, remaining work and forecast finish. Off = Phase 1 behaviour. */
export const PROGRESS_FLAG = "schedule_progress";

/** The schedule's mode when the engine applies to it, else null (flag off or legacy). */
export async function engineModeFor(scheduleId: string): Promise<SchedulingMode | null> {
  if (!(await isFeatureEnabled(ENGINE_FLAG))) return null;
  const { data } = await getSupabaseAdmin().from("job_schedules").select("scheduling_mode").eq("id", scheduleId).maybeSingle();
  const mode = (data?.scheduling_mode ?? "legacy") as SchedulingMode;
  return mode === "legacy" ? null : mode;
}

/** Everything the schedule's tasks can link to. */
export async function loadNetwork(scheduleId: string): Promise<Network & { jobId: string | null }> {
  const sb = getSupabaseAdmin();
  const fail = (what: string, err: { message: string } | null) => { if (err) throw new Error(`Couldn't load the schedule (${what}): ${err.message}`); };
  const { data: me, error: e0 } = await sb.from("job_schedules").select(SCHED_COLS).eq("id", scheduleId).maybeSingle();
  fail("schedule", e0);
  if (!me) throw new Error("Schedule not found.");

  const schedQ = me.job_id
    ? sb.from("job_schedules").select(SCHED_COLS).eq("job_id", me.job_id)
    : sb.from("job_schedules").select(SCHED_COLS).eq("scope_type", me.scope_type).eq("scope_id", me.scope_id);
  const { data: scheds, error: e1 } = await schedQ.neq("status", "archived");
  fail("schedules", e1);
  const schedules = (scheds ?? []) as (NetSchedule & { scope_type: string; scope_id: string })[];
  if (!schedules.some((s) => s.id === me.id)) schedules.push(me as never);
  // Without the progress flag the status date is ignored, so dates work exactly as in Phase 1.
  if (!(await isFeatureEnabled(PROGRESS_FLAG))) for (const s of schedules) s.status_date = null;
  const ids = schedules.map((s) => s.id);

  const { data: items, error: e2 } = await sb.from("schedule_items").select(ITEM_COLS).in("schedule_id", ids);
  fail("tasks", e2);
  const itemIds = (items ?? []).map((i) => i.id as string);
  let deps: NetDep[] = [];
  if (itemIds.length) {
    const { data, error } = me.job_id
      ? await sb.from("schedule_dependencies").select("source_item_id, target_item_id, dependency_type, lag_days").eq("job_id", me.job_id)
      : await sb.from("schedule_dependencies").select("source_item_id, target_item_id, dependency_type, lag_days").in("target_item_id", itemIds);
    fail("links", error);
    const inNet = new Set(itemIds);
    deps = ((data ?? []) as NetDep[]).filter((d) => inNet.has(d.source_item_id) && inNet.has(d.target_item_id));
  }

  const { data: cals, error: e3 } = await sb.from("schedule_calendars").select("scope, scope_id, workdays, exceptions")
    .or(`scope.eq.company${me.job_id ? `,and(scope.eq.job,scope_id.eq.${me.job_id})` : ""},and(scope.eq.schedule,scope_id.in.(${ids.join(",")}))`);
  fail("calendars", e3);
  const level = (r: { workdays: unknown; exceptions: unknown }): CalendarLevel => ({ workdays: (r.workdays ?? null) as never, exceptions: (r.exceptions ?? []) as never });
  const scheduleCals: Record<string, CalendarLevel> = {};
  for (const c of cals ?? []) if (c.scope === "schedule" && c.scope_id) scheduleCals[c.scope_id] = level(c);
  const company = (cals ?? []).find((c) => c.scope === "company");
  const job = (cals ?? []).find((c) => c.scope === "job");

  return {
    jobId: me.job_id ?? null,
    schedules, items: (items ?? []) as NetItem[], deps,
    company: company ? level(company) : null, job: job ? level(job) : null, scheduleCals,
  };
}

export type RecalcResult = {
  finish: string;
  moved: { id: string; title: string; from: { start: string | null; end: string | null }; to: { start: string | null; end: string | null } }[];
  updated: number;
  critical: { id: string; title: string; activity_id: number | null }[];
  orphans: { noPredecessor: number; noSuccessor: number };
  loops: number;
};

/** Run the engine over the schedule's network and save what changed. */
export async function recalcSchedule(scheduleId: string, actor?: Actor, opts: { dryRun?: boolean } = {}): Promise<RecalcResult> {
  const net = await loadNetwork(scheduleId);
  const result = runCpm(buildInput(net));
  const changes = diffResult(net, result);
  if (!opts.dryRun) await persist(net, changes, actor, "engine_recalc");
  const byId = new Map(net.items.map((i) => [i.id, i]));
  return {
    finish: result.finish,
    moved: changes.filter((c) => c.moved).map(({ id, title, from, to }) => ({ id, title, from, to })),
    updated: changes.length,
    critical: result.criticalPath.map((id) => ({ id, title: byId.get(id)?.title ?? "", activity_id: byId.get(id)?.activity_id ?? null })),
    orphans: { noPredecessor: result.orphans.noPredecessor.length, noSuccessor: result.orphans.noSuccessor.length },
    loops: result.loops.length,
  };
}

export type SwitchResult = {
  mode: SchedulingMode;
  keepDates: boolean;
  finishBefore: string | null;
  finishAfter: string | null;
  pinned: number;
  moved: { id: string; title: string; from: { start: string | null; end: string | null }; to: { start: string | null; end: string | null } }[];
  earlier: number;
  later: number;
};

/** Put a schedule on the engine (auto or manual) or back to legacy. dryRun
 *  returns the preview. Going back to legacy changes no dates. */
export async function switchMode(scheduleId: string, mode: SchedulingMode, keepDates: boolean, actor?: Actor, opts: { dryRun?: boolean } = {}): Promise<SwitchResult> {
  const sb = getSupabaseAdmin();
  if (mode === "legacy") {
    if (!opts.dryRun) {
      await sb.from("job_schedules").update({ scheduling_mode: "legacy", updated_at: new Date().toISOString() }).eq("id", scheduleId);
      await logActivity(scheduleId, null, "engine_mode_changed", { mode }, actor);
    }
    return { mode, keepDates, finishBefore: null, finishAfter: null, pinned: 0, moved: [], earlier: 0, later: 0 };
  }
  const net = await loadNetwork(scheduleId);
  const plan = planSwitch(net, scheduleId, mode, keepDates);
  const moved = plan.changes.filter((c) => c.moved);
  const out: SwitchResult = {
    mode, keepDates, finishBefore: plan.finishBefore, finishAfter: plan.finishAfter,
    pinned: Object.keys(plan.pins).length,
    moved: moved.map(({ id, title, from, to }) => ({ id, title, from, to })),
    earlier: moved.filter((c) => c.to.start && c.from.start && c.to.start < c.from.start).length,
    later: moved.filter((c) => c.to.start && c.from.start && c.to.start > c.from.start).length,
  };
  if (opts.dryRun) return out;

  // Freeze each task's length in working days before the mode flips, so a
  // holiday added later stretches the dates rather than shrinking the task.
  const s = net.schedules.find((x) => x.id === scheduleId)!;
  const cal = calendarFor(net, s);
  const lengths: EngineChange[] = [];
  for (const i of net.items.filter((x) => x.schedule_id === scheduleId && x.kind !== "milestone" && x.start_date && x.end_date)) {
    if (plan.changes.some((c) => c.id === i.id && "duration_days" in c.fields)) continue;
    const span = Math.max(1, spanW(i.duration_unit === "calendar" ? CALENDAR_DAYS : cal, dayNum(i.start_date!), dayNum(i.end_date!)));
    if (i.duration_days !== span) lengths.push({ id: i.id, title: i.title, schedule_id: scheduleId, from: { start: i.start_date, end: i.end_date }, to: { start: i.start_date, end: i.end_date }, moved: false, fields: { duration_days: span } });
  }
  await sb.from("job_schedules").update({ scheduling_mode: mode, updated_at: new Date().toISOString() }).eq("id", scheduleId);
  await persist(net, [...plan.changes, ...lengths], actor, "engine_switch");
  await logActivity(scheduleId, net.jobId, "engine_mode_changed", { mode, keep_dates: keepDates, pinned: out.pinned, moved: moved.length, finish: out.finishAfter }, actor);
  return out;
}

/** Refuse a move earlier than the task's links allow (auto schedules). */
export async function assertMoveAllowed(itemId: string, scheduleId: string, newStart: string): Promise<void> {
  const net = await loadNetwork(scheduleId);
  const result = runCpm(buildInput(net));
  const blocked = blockedMove(net, itemId, newStart, result);
  if (!blocked) return;
  const why = blocked.because.map((b) => `${b.activity_id ? `${b.activity_id} ` : ""}${b.title} (${DEPENDENCY_ABBR[b.type]}${b.lag ? `${b.lag > 0 ? "+" : ""}${b.lag}` : ""})`).join(", ");
  throw new ScheduleRuleError(`This task can't start before ${blocked.earliest}: it waits for ${why}. Change the link or its lag to move it earlier.`);
}

/** Refuse a link that would close a loop. */
export async function assertNoLoop(scheduleId: string, sourceId: string, targetId: string): Promise<void> {
  const net = await loadNetwork(scheduleId);
  if (wouldLoop(net.deps, sourceId, targetId)) throw new ScheduleRuleError("That link would make a loop: the task would end up waiting for itself.");
}

/** Working-day length of start..end on the schedule's calendar. */
export async function durationOnCalendar(scheduleId: string, start: string, end: string, unit: "workdays" | "calendar" = "workdays"): Promise<number> {
  if (unit === "calendar") return Math.max(1, spanW(CALENDAR_DAYS, dayNum(start), dayNum(end)));
  const net = await loadNetwork(scheduleId);
  const s = net.schedules.find((x) => x.id === scheduleId);
  return s ? Math.max(1, spanW(calendarFor(net, s), dayNum(start), dayNum(end))) : 1;
}

/** Next activity ID by tens for a new task at the end of the schedule. */
export async function nextActivityId(scheduleId: string, count = 1): Promise<number[]> {
  const { data } = await getSupabaseAdmin().from("schedule_items").select("activity_id").eq("schedule_id", scheduleId)
    .not("activity_id", "is", null).order("activity_id", { ascending: false }).limit(1);
  const top = (data?.[0]?.activity_id as number | undefined) ?? 0;
  const base = Math.floor(top / 10) * 10;
  return Array.from({ length: count }, (_, i) => base + (i + 1) * 10);
}

async function persist(net: Network & { jobId: string | null }, changes: EngineChange[], actor: Actor | undefined, action: string): Promise<void> {
  if (!changes.length) return;
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  for (let i = 0; i < changes.length; i += 25) {
    const chunk = changes.slice(i, i + 25);
    const results = await Promise.all(chunk.map((c) => sb.from("schedule_items").update({ ...c.fields, updated_at: now }).eq("id", c.id)));
    const err = results.find((r) => r.error)?.error;
    if (err) throw new Error(`Couldn't save the recalculated dates: ${err.message}`);
  }

  // Phase ranges and each schedule's engine finish.
  const moved = changes.filter((c) => c.moved);
  const after = new Map(net.items.map((i) => [i.id, { ...i }]));
  for (const c of moved) { const it = after.get(c.id); if (it) { it.start_date = c.to.start; it.end_date = c.to.end; } }
  const touched = new Set(changes.map((c) => c.schedule_id));
  for (const sid of touched) {
    const rows = [...after.values()].filter((i) => i.schedule_id === sid && i.start_date);
    const finish = rows.reduce<string | null>((m, r) => ((r.end_date ?? r.start_date)! > (m ?? "") ? (r.end_date ?? r.start_date) : m), null);
    await sb.from("job_schedules").update({ engine_finish: finish, engine_ran_at: now }).eq("id", sid);
    const phases = new Set(rows.map((r) => r.phase_id).filter(Boolean) as string[]);
    await Promise.all([...phases].map((pid) => {
      const ph = rows.filter((r) => r.phase_id === pid);
      return sb.from("schedule_phases").update({
        start_date: ph.reduce((m, r) => (r.start_date! < m ? r.start_date! : m), ph[0].start_date!),
        end_date: ph.reduce((m, r) => ((r.end_date ?? r.start_date!) > m ? (r.end_date ?? r.start_date!) : m), ph[0].end_date ?? ph[0].start_date!),
      }).eq("id", pid);
    }));
  }

  if (moved.length) {
    await logActivity(moved[0].schedule_id, net.jobId, action, { moved: moved.length, updated: changes.length }, actor);
    // Each task the engine moved gets a history line ("moved by the schedule").
    try {
      await sb.from("schedule_activity").insert(moved.map((c) => ({
        job_id: net.jobId, schedule_id: c.schedule_id, item_id: c.id, actor_id: actor?.id ?? null, action: "engine_moved",
        detail: { title: c.title, changes: { start_date: [c.from.start, c.to.start], end_date: [c.from.end, c.to.end] }, via: action === "engine_switch" ? "switch to critical path" : "recalculation" },
      })));
    } catch { /* history must never block the save */ }
    // One heads-up per person, not one per task.
    const people = new Map<string, number>();
    for (const c of moved) for (const id of assigneeStaffIds((after.get(c.id)?.assignees ?? []) as Assignee[])) people.set(id, (people.get(id) ?? 0) + 1);
    for (const [id, n] of people) {
      if (id === actor?.id) continue;
      await notifyScheduleEvent({
        kind: "moved", recipientIds: [id], jobId: net.jobId, scheduleId: moved[0].schedule_id, itemId: moved[0].id,
        title: n === 1 ? `Rescheduled: ${moved.find((c) => assigneeStaffIds((after.get(c.id)?.assignees ?? []) as Assignee[]).includes(id))?.title}` : `${n} of your tasks were rescheduled`,
        subtitle: "Dates recalculated from the schedule's links", actorId: actor?.id,
      });
    }
  }
}

async function logActivity(scheduleId: string, jobId: string | null, action: string, detail: Record<string, unknown>, actor?: Actor) {
  try {
    await getSupabaseAdmin().from("schedule_activity").insert({
      job_id: jobId, schedule_id: scheduleId, actor_id: actor?.id ?? null, actor_name: actor?.name ?? null, action, detail,
    });
  } catch { /* never block the change */ }
}
