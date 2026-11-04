// What-if sandbox (Spec R2 §6.3): try edits on a copy of the schedule's network
// in the browser, see the new finish and what moved, and save nothing until
// Apply. Mirrors the rules lib/schedules/grid-data.ts applies on save: a typed
// start is a Start No Earlier Than (refused if earlier than the links allow), a
// typed finish sets the length in working days. Pure.
import { runCpm, type CpmResult } from "./cpm.ts";
import { addW, CALENDAR_DAYS, dayNum, isoOf, spanW, workDiff } from "./calendar.ts";
import { buildInput, blockedMove, calendarFor, diffResult, wouldLoop, type Network, type NetItem } from "./engine-core.ts";
import type { GridOps } from "./grid.ts";

/** A sandbox step: grid edits, or "start the whole schedule N working days later/earlier". */
export type WhatIfOp = GridOps & { shift?: number };

const ENGINE_FIELDS = [
  "start_date", "end_date", "duration_days", "duration_unit", "kind", "constraint_type", "constraint_date",
  "is_locked", "actual_start", "actual_finish", "status",
] as const;

export type WhatIfState = { net: Network; result: CpmResult; refused: string[] };

/** Apply sandbox steps to the network for `scheduleId`, recalculating after each. */
export function applyWhatIf(base: Network, scheduleId: string, ops: WhatIfOp[]): WhatIfState {
  let net: Network = structuredClone(base);
  let result = settle(net);
  net = result.net;
  const refused: string[] = [];
  const sched = net.schedules.find((s) => s.id === scheduleId);
  if (!sched) return { net, result: result.cpm, refused };
  for (const op of ops) {
    const cal = calendarFor(net, sched);
    const byId = new Map(net.items.map((i) => [i.id, i]));

    if (op.shift) {
      const n = Math.round(op.shift);
      const move = (iso: string | null | undefined) => (iso ? isoOf(addW(cal, dayNum(iso), n)) : iso ?? null);
      for (const i of net.items) {
        // Same as Shift dates: locked, started and finished tasks stay put.
        if (i.schedule_id !== scheduleId || i.is_locked || i.actual_start || i.status === "complete" || i.status === "cancelled") continue;
        if (i.constraint_date) i.constraint_date = move(i.constraint_date);
        if (i.start_date) { const len = i.kind === "milestone" ? 0 : itemLen(i, cal); i.start_date = move(i.start_date); i.end_date = len > 1 ? isoOf(addW(i.duration_unit === "calendar" ? CALENDAR_DAYS : cal, dayNum(i.start_date!), len - 1)) : i.start_date; }
      }
      if (sched.start_date) sched.start_date = move(sched.start_date);
    }

    for (const u of op.updates ?? []) {
      const prev = byId.get(u.id);
      if (!prev) continue;
      const patch: Record<string, unknown> = {};
      for (const f of ENGINE_FIELDS) if (f in u.patch) patch[f] = (u.patch as Record<string, unknown>)[f];
      const kind = (patch.kind ?? prev.kind) as string;
      if (kind === "milestone" && patch.start_date) patch.end_date = patch.start_date;
      const startTyped = "start_date" in patch && patch.start_date && patch.start_date !== prev.start_date;
      const endTyped = "end_date" in patch && patch.end_date && patch.end_date !== prev.end_date;
      if (startTyped && !prev.is_locked && !("constraint_type" in patch) && sched.scheduling_mode === "auto") {
        const blocked = blockedMove(net, u.id, patch.start_date as string, result.cpm);
        if (blocked) {
          refused.push(`${prev.activity_id ?? ""} ${prev.title} can't start before ${blocked.earliest}: it waits for ${blocked.because.map((b) => `${b.activity_id ?? ""} ${b.title}`.trim()).join(", ")}.`.trim());
          delete patch.start_date;
          if (kind === "milestone") delete patch.end_date;
        } else { patch.constraint_type = "snet"; patch.constraint_date = patch.start_date; }
      }
      if (kind !== "milestone" && endTyped && !("duration_days" in patch)) {
        const s = (patch.start_date ?? prev.start_date) as string | null;
        const unit = (patch.duration_unit ?? prev.duration_unit) as string;
        if (s) patch.duration_days = Math.max(1, spanW(unit === "calendar" ? CALENDAR_DAYS : cal, dayNum(s), dayNum(patch.end_date as string)));
      }
      Object.assign(prev, patch);
    }

    for (const edit of op.predecessors ?? []) {
      const mine = new Set(net.items.filter((i) => i.schedule_id === scheduleId).map((i) => i.id));
      const kept = net.deps.filter((d) => !(d.target_item_id === edit.itemId && mine.has(d.source_item_id)));
      let loop = false;
      for (const l of edit.links) {
        if (wouldLoop(kept, l.sourceItemId, edit.itemId)) { loop = true; break; }
        kept.push({ source_item_id: l.sourceItemId, target_item_id: edit.itemId, dependency_type: l.type, lag_days: l.lag });
      }
      if (loop) refused.push("That link would make a loop: the task would end up waiting for itself.");
      else net.deps = kept;
    }

    const next = settle(net);
    net = next.net;
    result = next;
  }
  return { net, result: result.cpm, refused };

  function settle(n: Network): { net: Network; cpm: CpmResult } {
    const cpm = runCpm(buildInput(n));
    for (const c of diffResult(n, cpm)) {
      const it = n.items.find((i) => i.id === c.id);
      if (it) Object.assign(it, c.fields);
    }
    return { net: n, cpm };
  }
}

function itemLen(i: NetItem, cal: ReturnType<typeof calendarFor>): number {
  if (i.duration_days != null && i.duration_days > 0) return Math.round(i.duration_days);
  if (i.start_date && i.end_date) return Math.max(1, spanW(i.duration_unit === "calendar" ? CALENDAR_DAYS : cal, dayNum(i.start_date), dayNum(i.end_date)));
  return 1;
}

/** Latest finish of one schedule's tasks, and the gap in working days from `before`. */
export function scheduleFinish(net: Network, scheduleId: string, before?: string | null): { finish: string | null; delta: number | null } {
  const finish = net.items.filter((i) => i.schedule_id === scheduleId).reduce<string | null>((m, i) => {
    const e = i.end_date ?? i.start_date;
    return e && (!m || e > m) ? e : m;
  }, null);
  const sched = net.schedules.find((s) => s.id === scheduleId);
  if (!finish || !before || !sched) return { finish, delta: null };
  return { finish, delta: workDiff(calendarFor(net, sched), dayNum(before), dayNum(finish)) };
}

/** Working days a milestone is past (+) or ahead of (−) its contract date. */
export function contractVariance(net: Network, item: Pick<NetItem, "schedule_id" | "start_date" | "end_date" | "kind"> & { contract_date?: string | null }): number | null {
  const forecast = item.kind === "milestone" ? item.start_date : item.end_date ?? item.start_date;
  const sched = net.schedules.find((s) => s.id === item.schedule_id);
  if (!item.contract_date || !forecast || !sched) return null;
  return workDiff(calendarFor(net, sched), dayNum(item.contract_date), dayNum(forecast));
}
