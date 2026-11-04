// Turns schedule rows into a critical-path network and back (Spec R2 Phase 1).
// Pure, like cpm.ts: engine.ts does the database work around it.
//
// The network is everything a job's schedules can link to (or, for deal /
// Pre-Con / selection schedules, everything under that record). Each schedule
// has a mode:
//   legacy  the old forward push; the engine leaves its tasks alone
//   manual  dates stay put; float is worked out as advice
//   auto    the engine sets the dates, moving tasks later and earlier
// Legacy and manual tasks still drive the auto tasks linked after them.
import { runCpm, requiredStart, type CpmInput, type CpmResult, type CpmTask } from "./cpm.ts";
import { CALENDAR_DAYS, dayNum, isoOf, makeCalendar, mergeCalendars, spanW, type CalendarLevel, type DayCalendar } from "./calendar.ts";
import type { DependencyType, SchedulingMode, Workdays } from "./types";

export type NetSchedule = {
  id: string; job_id: string | null; name: string; scheduling_mode: SchedulingMode;
  workdays: Workdays | null; start_date: string | null; target_completion?: string | null;
};
export type NetItem = {
  id: string; schedule_id: string; phase_id?: string | null; title: string; kind: "task" | "milestone"; status: string;
  start_date: string | null; end_date: string | null; duration_days: number | null; duration_unit?: "workdays" | "calendar" | null;
  is_locked: boolean; constraint_type?: "snet" | "mfo" | "alap" | null; constraint_date?: string | null;
  actual_start?: string | null; actual_finish?: string | null; activity_id?: number | null;
  early_start?: string | null; early_finish?: string | null; late_start?: string | null; late_finish?: string | null;
  total_float?: number | null; free_float?: number | null; is_critical?: boolean;
  milestone_type?: string | null; contract_date?: string | null;
  assignees?: unknown;
};
export type NetDep = { source_item_id: string; target_item_id: string; dependency_type: DependencyType; lag_days: number };

export type Network = {
  schedules: NetSchedule[];
  items: NetItem[];
  deps: NetDep[];
  company?: CalendarLevel | null;
  job?: CalendarLevel | null;
  /** Calendars set on single schedules (no job), by schedule id. */
  scheduleCals?: Record<string, CalendarLevel>;
};

export type ModeOverride = Record<string, SchedulingMode>;

const DONE = new Set(["complete", "cancelled"]);

/** Company → the schedule's own weekdays → job → schedule calendar. */
export function calendarFor(net: Network, s: NetSchedule): DayCalendar {
  return makeCalendar(mergeCalendars(net.company, { workdays: s.workdays }, net.job, net.scheduleCals?.[s.id]));
}

export function modeOf(s: NetSchedule, override?: ModeOverride): SchedulingMode {
  return override?.[s.id] ?? s.scheduling_mode ?? "legacy";
}

/** Working days (or calendar days) a task lasts. On the engine, duration_days is
 *  the source of truth; legacy rows fall back to the span of their dates. */
export function itemDuration(i: NetItem, cal: DayCalendar, onEngine: boolean): number {
  if (i.kind === "milestone") return 0;
  const calDays = i.duration_unit === "calendar";
  if (onEngine && i.duration_days != null && i.duration_days > 0) return Math.round(i.duration_days);
  if (i.start_date && i.end_date && i.end_date >= i.start_date) {
    return Math.max(1, spanW(calDays ? CALENDAR_DAYS : cal, dayNum(i.start_date), dayNum(i.end_date)));
  }
  return Math.max(1, Math.round(i.duration_days ?? 1));
}

export type BuildOptions = {
  modeOverride?: ModeOverride;
  /** Start No Earlier Than dates to add (switch-over pins), by item id. */
  pins?: Record<string, string>;
};

export function buildInput(net: Network, opts: BuildOptions = {}): CpmInput {
  const cals: Record<string, DayCalendar> = {};
  const sched = new Map(net.schedules.map((s) => [s.id, s]));
  for (const s of net.schedules) cals[s.id] = calendarFor(net, s);

  const tasks: CpmTask[] = [];
  for (const i of net.items) {
    const s = sched.get(i.schedule_id);
    if (!s) continue;
    const mode = modeOf(s, opts.modeOverride);
    const onEngine = mode !== "legacy";
    const pin = opts.pins?.[i.id];
    let constraint: CpmTask["constraint"] = i.is_locked ? "locked" : i.constraint_type ?? null;
    let constraintDate = i.is_locked ? i.start_date : i.constraint_date ?? null;
    if (pin && !i.is_locked && constraint !== "mfo" && (constraint !== "snet" || !constraintDate || constraintDate < pin)) {
      constraint = "snet"; constraintDate = pin;
    }
    tasks.push({
      id: i.id,
      duration: itemDuration(i, cals[s.id], onEngine),
      calendar: i.duration_unit === "calendar" ? "calendar_days" : s.id,
      start: i.start_date, end: i.end_date,
      constraint, constraintDate,
      actualStart: i.actual_start ?? null,
      actualFinish: i.actual_finish ?? null,
      // Only auto schedules move; done tasks never do.
      hold: mode !== "auto" || DONE.has(i.status),
    });
  }
  const starts = [...net.schedules.map((s) => s.start_date), ...net.items.map((i) => i.start_date)].filter(Boolean) as string[];
  const start = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : new Date().toISOString().slice(0, 10);
  return {
    start, tasks,
    links: net.deps.map((d) => ({ from: d.source_item_id, to: d.target_item_id, type: d.dependency_type, lag: d.lag_days ?? 0 })),
    calendars: cals,
    defaultCalendar: net.schedules[0]?.id ?? "calendar_days",
  };
}

export type EngineChange = {
  id: string; title: string; schedule_id: string;
  from: { start: string | null; end: string | null };
  to: { start: string | null; end: string | null };
  /** The dates moved (not just float). */
  moved: boolean;
  /** Columns to write. */
  fields: Record<string, unknown>;
};

/** What to write back: dates for auto tasks, float etc. for every task on the
 *  engine. Legacy schedules are left untouched. Only rows that differ. */
export function diffResult(net: Network, result: CpmResult, opts: BuildOptions = {}): EngineChange[] {
  const sched = new Map(net.schedules.map((s) => [s.id, s]));
  const out: EngineChange[] = [];
  for (const i of net.items) {
    const s = sched.get(i.schedule_id);
    const r = result.tasks.get(i.id);
    if (!s || !r) continue;
    const mode = modeOf(s, opts.modeOverride);
    if (mode === "legacy") continue;
    const cal = calendarFor(net, s);
    const fields: Record<string, unknown> = {
      early_start: r.earlyStart, early_finish: r.earlyFinish, late_start: r.lateStart, late_finish: r.lateFinish,
      total_float: r.totalFloat, free_float: r.freeFloat, is_critical: r.critical,
    };
    if (i.duration_days == null && i.kind !== "milestone") fields.duration_days = itemDuration(i, cal, false);
    const pin = opts.pins?.[i.id];
    if (pin && !i.is_locked && i.constraint_type !== "mfo" && (i.constraint_type !== "snet" || !i.constraint_date || i.constraint_date < pin)) {
      fields.constraint_type = "snet"; fields.constraint_date = pin;
    }
    let moved = false;
    if (mode === "auto" && !DONE.has(i.status) && !i.is_locked && (r.start !== i.start_date || r.finish !== i.end_date)) {
      fields.start_date = r.start; fields.end_date = r.finish; moved = true;
    }
    const changed = Object.entries(fields).filter(([k, v]) => (i as Record<string, unknown>)[k] !== v);
    if (!changed.length) continue;
    out.push({
      id: i.id, title: i.title, schedule_id: i.schedule_id,
      from: { start: i.start_date, end: i.end_date },
      to: { start: moved ? r.start : i.start_date, end: moved ? r.finish : i.end_date },
      moved, fields: Object.fromEntries(changed),
    });
  }
  return out;
}

export type SwitchPlan = {
  mode: SchedulingMode;
  keepDates: boolean;
  result: CpmResult;
  pins: Record<string, string>;
  changes: EngineChange[];
  finishBefore: string | null;
  finishAfter: string | null;
};

/** Plan putting one schedule on the engine. keepDates: tasks sitting later than
 *  their links need get a Start No Earlier Than at their current date, so
 *  nothing moves earlier; only tasks the links push later move. */
export function planSwitch(net: Network, scheduleId: string, mode: SchedulingMode, keepDates: boolean): SwitchPlan {
  const modeOverride: ModeOverride = { [scheduleId]: mode };
  const mine = net.items.filter((i) => i.schedule_id === scheduleId);
  const pins: Record<string, string> = {};
  let result = runCpm(buildInput(net, { modeOverride }));
  if (mode === "auto" && keepDates) {
    // Pinning a task can only push others later, so this settles in a few rounds.
    for (let round = 0; round < 25; round++) {
      let added = 0;
      for (const i of mine) {
        if (!i.start_date || pins[i.id] || i.is_locked || DONE.has(i.status) || i.constraint_type === "mfo") continue;
        const r = result.tasks.get(i.id);
        if (r && r.start < i.start_date) { pins[i.id] = i.start_date; added++; }
      }
      if (!added) break;
      result = runCpm(buildInput(net, { modeOverride, pins }));
    }
  }
  const finishOf = (rows: { end: string | null }[]) => rows.reduce<string | null>((m, r) => (r.end && (!m || r.end > m) ? r.end : m), null);
  return {
    mode, keepDates, result, pins,
    changes: diffResult(net, result, { modeOverride, pins }),
    finishBefore: finishOf(mine.map((i) => ({ end: i.end_date }))),
    finishAfter: finishOf(mine.map((i) => ({ end: result.tasks.get(i.id)?.finish ?? i.end_date }))),
  };
}

export type BlockedMove = {
  earliest: string;
  because: { id: string; title: string; activity_id: number | null; type: DependencyType; lag: number }[];
};

/** On an auto schedule, a task can't be moved earlier than its links allow.
 *  Returns the earliest start and the links holding it, or null if it's fine. */
export function blockedMove(net: Network, itemId: string, requestedStart: string, result: CpmResult): BlockedMove | null {
  const item = net.items.find((i) => i.id === itemId);
  const s = item && net.schedules.find((x) => x.id === item.schedule_id);
  if (!item || !s || modeOf(s) !== "auto") return null;
  const cal = item.duration_unit === "calendar" ? CALENDAR_DAYS : calendarFor(net, s);
  const dur = itemDuration(item, cal, true);
  const byId = new Map(net.items.map((i) => [i.id, i]));
  const reqs = net.deps
    .filter((d) => d.target_item_id === itemId)
    .map((d) => {
      const p = result.tasks.get(d.source_item_id);
      if (!p) return null;
      const day = requiredStart({ type: d.dependency_type, lag: d.lag_days ?? 0 }, dayNum(p.earlyStart), dayNum(p.earlyFinish), cal, dur);
      return { d, day };
    })
    .filter((x): x is { d: NetDep; day: number } => !!x);
  if (!reqs.length) return null;
  const earliest = Math.max(...reqs.map((r) => r.day));
  if (dayNum(requestedStart) >= earliest) return null;
  return {
    earliest: isoOf(earliest),
    because: reqs.filter((r) => r.day === earliest).map(({ d }) => {
      const p = byId.get(d.source_item_id);
      return { id: d.source_item_id, title: p?.title ?? "another task", activity_id: p?.activity_id ?? null, type: d.dependency_type, lag: d.lag_days ?? 0 };
    }),
  };
}

/** Would linking source → target close a loop? */
export function wouldLoop(deps: NetDep[], sourceId: string, targetId: string): boolean {
  if (sourceId === targetId) return true;
  const out = new Map<string, string[]>();
  for (const d of deps) out.set(d.source_item_id, [...(out.get(d.source_item_id) ?? []), d.target_item_id]);
  const stack = [targetId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === sourceId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(out.get(id) ?? []));
  }
  return false;
}
