// Critical path method for CMI schedules (Spec R2 §6). Pure: the browser runs
// it on every edit (instant ripple, what-if) and the server runs the same code
// on save and stores the result.
//
// Conventions (match the existing cascade so dates don't jump on switch-over):
// - A task of duration D (working days of its own calendar) runs start..finish
//   inclusive: finish = start + (D − 1) working days. D = 0 is a milestone with
//   finish = start.
// - Lags count in the successor's calendar (P6's default).
//   FS: succ.start ≥ pred.finish + 1 + lag     SS: succ.start ≥ pred.start + lag
//   FF: succ.finish ≥ pred.finish + lag        SF: succ.finish ≥ pred.start + lag
// - Every task is bounded by the schedule start (forward) and the schedule
//   finish (backward), so a task with no links shows float to the finish.
import type { DependencyType } from "./types";
import { addW, CALENDAR_DAYS, dayNum, isoOf, latestFrom, nextW, prevW, workDiff, type DayCalendar } from "./calendar.ts";

export type ConstraintType = "snet" | "mfo" | "alap" | "locked";
export const CONSTRAINT_LABELS: Record<ConstraintType, string> = {
  snet: "Start No Earlier Than", mfo: "Must Finish On", alap: "As Late As Possible", locked: "Locked",
};

export type CpmTask = {
  id: string;
  /** Working days of the task's calendar; 0 = milestone. */
  duration: number;
  /** Key into CpmInput.calendars; "calendar_days" counts every day. */
  calendar?: string | null;
  /** Current dates. Used for locked tasks, manual mode and as the SNET a
   *  switch-over gives tasks that sit later than the engine would put them. */
  start?: string | null;
  end?: string | null;
  constraint?: ConstraintType | null;
  constraintDate?: string | null;
  actualStart?: string | null;
  actualFinish?: string | null;
  /** Keep this task's dates (its schedule is manual or not on the engine);
   *  it still drives its successors and gets float. */
  hold?: boolean;
};

export type CpmLink = { from: string; to: string; type: DependencyType; lag: number };

export type CpmInput = {
  /** Schedule (or job) start: nothing starts before it. */
  start: string;
  /** Must-finish target. Leave empty to finish at the latest early finish;
   *  set it earlier than that and float goes negative. */
  finish?: string | null;
  tasks: CpmTask[];
  links: CpmLink[];
  calendars: Record<string, DayCalendar>;
  /** Calendar used when a task names none (the job calendar). */
  defaultCalendar: string;
  /** manual: every dated task stays where it is; float is advisory. */
  mode?: "auto" | "manual";
  /** Float at or below this (but above 0) is near-critical. Default 3. */
  nearCritical?: number;
};

export type CpmTaskResult = {
  id: string;
  /** The dates the task is scheduled on (early dates, or late for ALAP). */
  start: string;
  finish: string;
  earlyStart: string;
  earlyFinish: string;
  lateStart: string;
  lateFinish: string;
  totalFloat: number;
  freeFloat: number;
  critical: boolean;
  nearCritical: boolean;
  /** A hard date (locked, actuals, Must Finish On, manual mode) held it. */
  fixed: boolean;
  /** Why the start moved off what was asked, e.g. a constraint on a closed day. */
  note?: string;
};

export type CpmResult = {
  tasks: Map<string, CpmTaskResult>;
  start: string;
  finish: string;
  /** Critical tasks in start order. */
  criticalPath: string[];
  /** Tasks floating free: no predecessor / no successor. */
  orphans: { noPredecessor: string[]; noSuccessor: string[] };
  /** Links ignored because they close a loop. */
  loops: CpmLink[];
  /** Links naming a task that isn't in the network. */
  danglingLinks: CpmLink[];
};

type Node = {
  t: CpmTask;
  cal: DayCalendar;
  dur: number;
  preds: CpmLink[];
  succs: CpmLink[];
  es: number; ef: number; ls: number; lf: number;
  /** Late dates from the network, before a hard date holds the task. */
  lsCalc: number; lfCalc: number;
  fixedStart: number | null;
  fixedFinish: number | null;
  note?: string;
};

const d = (iso?: string | null) => (iso ? dayNum(iso) : null);

export function runCpm(input: CpmInput): CpmResult {
  const calOf = (key?: string | null): DayCalendar => {
    if (key === "calendar_days") return CALENDAR_DAYS;
    return input.calendars[key ?? input.defaultCalendar] ?? input.calendars[input.defaultCalendar] ?? CALENDAR_DAYS;
  };
  const manual = input.mode === "manual";
  const nodes = new Map<string, Node>();
  for (const t of input.tasks) {
    nodes.set(t.id, {
      t, cal: calOf(t.calendar), dur: Math.max(0, Math.round(t.duration || 0)),
      preds: [], succs: [], es: 0, ef: 0, ls: 0, lf: 0, lsCalc: 0, lfCalc: 0, fixedStart: null, fixedFinish: null,
    });
  }

  const danglingLinks: CpmLink[] = [];
  const seen = new Set<string>();
  const links: CpmLink[] = [];
  for (const l of input.links) {
    if (!nodes.has(l.from) || !nodes.has(l.to) || l.from === l.to) { danglingLinks.push(l); continue; }
    const key = `${l.from}>${l.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(l);
  }

  const { order, loops } = topoOrder([...nodes.keys()], links);
  const loopSet = new Set(loops);
  for (const l of links) {
    if (loopSet.has(l)) continue;
    nodes.get(l.from)!.succs.push(l);
    nodes.get(l.to)!.preds.push(l);
  }

  const projectStart = dayNum(input.start);

  // Hard dates first.
  for (const n of nodes.values()) {
    const { t } = n;
    const as = d(t.actualStart), af = d(t.actualFinish);
    if (af != null) {
      n.fixedFinish = af;
      n.fixedStart = as ?? (n.dur > 1 ? addW(n.cal, af, -(n.dur - 1)) : af);
    } else if (as != null) {
      n.fixedStart = as;
    } else if (t.constraint === "locked" || ((manual || t.hold) && t.start)) {
      const s = d(t.start ?? t.constraintDate);
      if (s != null) {
        n.fixedStart = s;
        const e = d(t.end);
        n.fixedFinish = e != null && e >= s ? e : null;
      }
    } else if (t.constraint === "mfo" && t.constraintDate) {
      const want = dayNum(t.constraintDate);
      const f = nextW(n.cal, want);
      if (f !== want) n.note = "Must Finish On fell on a non-working day; moved to the next working day.";
      n.fixedFinish = f;
      n.fixedStart = n.dur > 1 ? addW(n.cal, f, -(n.dur - 1)) : f;
    }
  }

  // Forward pass.
  for (const id of order) {
    const n = nodes.get(id)!;
    const { cal, dur } = n;
    let es: number;
    if (n.fixedStart != null) {
      es = n.fixedStart;
    } else {
      es = projectStart;
      for (const l of n.preds) {
        const p = nodes.get(l.from)!;
        es = Math.max(es, requiredStart(l, p.es, p.ef, cal, dur));
      }
      if (n.t.constraint === "snet" && n.t.constraintDate) {
        const want = dayNum(n.t.constraintDate);
        if (want > es) {
          es = want;
          if (!cal.isWorking(want)) n.note = "Start No Earlier Than fell on a non-working day; moved to the next working day.";
        }
      }
      es = nextW(cal, es);
    }
    n.es = es;
    n.ef = n.fixedFinish ?? (dur > 1 ? addW(cal, es, dur - 1) : es);
  }

  let projectFinish = 0;
  for (const n of nodes.values()) projectFinish = Math.max(projectFinish, n.ef);
  if (!nodes.size) projectFinish = projectStart;
  if (input.finish) projectFinish = dayNum(input.finish);

  // Backward pass.
  for (let i = order.length - 1; i >= 0; i--) {
    const n = nodes.get(order[i])!;
    const { cal, dur } = n;
    let lf = prevW(cal, projectFinish);
    for (const l of n.succs) {
      const s = nodes.get(l.to)!;
      const sc = s.cal;
      const lag = Math.round(l.lag || 0);
      switch (l.type) {
        case "finish_to_start": lf = Math.min(lf, prevW(cal, latestFrom(sc, s.ls, 1 + lag))); break;
        case "finish_to_finish": lf = Math.min(lf, prevW(cal, latestFrom(sc, s.lf, lag))); break;
        case "start_to_start": lf = Math.min(lf, finishFor(cal, prevW(cal, latestFrom(sc, s.ls, lag)), dur)); break;
        case "start_to_finish": lf = Math.min(lf, finishFor(cal, prevW(cal, latestFrom(sc, s.lf, lag)), dur)); break;
      }
    }
    n.lfCalc = lf;
    n.lsCalc = dur > 1 ? addW(cal, lf, -(dur - 1)) : lf;
    // A hard date holds on the backward pass too: predecessors see it.
    const hard = n.fixedStart != null;
    n.ls = hard ? n.es : n.lsCalc;
    n.lf = hard ? n.ef : n.lfCalc;
  }

  // Float reads from the network's late dates, so a locked task that's
  // later than its successors allow shows negative float.
  const results = new Map<string, CpmTaskResult>();
  const near = input.nearCritical ?? 3;
  for (const n of nodes.values()) {
    const tf = Math.min(workDiff(n.cal, n.es, n.lsCalc), workDiff(n.cal, n.ef, n.lfCalc));
    let ff = n.succs.length ? Infinity : workDiff(n.cal, n.ef, prevW(n.cal, projectFinish));
    for (const l of n.succs) {
      const s = nodes.get(l.to)!;
      const lag = Math.round(l.lag || 0);
      const slack =
        l.type === "finish_to_start" ? workDiff(s.cal, addW(s.cal, n.ef, 1 + lag), s.es)
        : l.type === "start_to_start" ? workDiff(s.cal, addW(s.cal, n.es, lag), s.es)
        : l.type === "finish_to_finish" ? workDiff(s.cal, addW(s.cal, n.ef, lag), s.ef)
        : workDiff(s.cal, addW(s.cal, n.es, lag), s.ef);
      ff = Math.min(ff, slack);
    }
    ff = Math.max(0, Math.min(ff, tf));
    const done = n.t.actualFinish != null;
    const fixed = n.fixedStart != null;

    let start = n.es, finish = n.ef;
    if (n.t.constraint === "alap" && !fixed && ff > 0) {
      start = addW(n.cal, n.es, ff);
      finish = n.dur > 1 ? addW(n.cal, start, n.dur - 1) : start;
    }
    results.set(n.t.id, {
      id: n.t.id,
      start: isoOf(start), finish: isoOf(finish),
      earlyStart: isoOf(n.es), earlyFinish: isoOf(n.ef),
      lateStart: isoOf(n.lsCalc), lateFinish: isoOf(n.lfCalc),
      totalFloat: tf, freeFloat: ff,
      critical: !done && tf <= 0,
      nearCritical: !done && tf > 0 && tf <= near,
      fixed,
      ...(n.note ? { note: n.note } : {}),
    });
  }

  const criticalPath = [...results.values()]
    .filter((r) => r.critical)
    .sort((a, b) => a.earlyStart.localeCompare(b.earlyStart) || a.earlyFinish.localeCompare(b.earlyFinish))
    .map((r) => r.id);
  const orphans = {
    noPredecessor: [...nodes.values()].filter((n) => !n.preds.length).map((n) => n.t.id),
    noSuccessor: [...nodes.values()].filter((n) => !n.succs.length).map((n) => n.t.id),
  };
  return { tasks: results, start: input.start, finish: isoOf(projectFinish), criticalPath, orphans, loops, danglingLinks };
}

/** Earliest start a link allows its successor (day numbers, the successor's
 *  calendar and duration). Exported so a refused move can name its link. */
export function requiredStart(l: Pick<CpmLink, "type" | "lag">, predStart: number, predFinish: number, cal: DayCalendar, dur: number): number {
  const lag = Math.round(l.lag || 0);
  switch (l.type) {
    case "finish_to_start": return addW(cal, predFinish, 1 + lag);
    case "start_to_start": return addW(cal, predStart, lag);
    case "finish_to_finish": return startFor(cal, addW(cal, predFinish, lag), dur);
    case "start_to_finish": return startFor(cal, addW(cal, predStart, lag), dur);
  }
}

/** Start that gives the required finish (or later) for a task of `dur` days. */
function startFor(cal: DayCalendar, finishReq: number, dur: number): number {
  const f = nextW(cal, finishReq);
  return dur > 1 ? addW(cal, f, -(dur - 1)) : f;
}
/** Latest finish for a task that must start by `latestStart`. */
function finishFor(cal: DayCalendar, latestStart: number, dur: number): number {
  return dur > 1 ? addW(cal, latestStart, dur - 1) : latestStart;
}

/** Depth-first topological order. Links that close a loop are returned
 *  separately and left out of the network. */
export function topoOrder(ids: string[], links: CpmLink[]): { order: string[]; loops: CpmLink[] } {
  const out = new Map<string, CpmLink[]>();
  for (const id of ids) out.set(id, []);
  for (const l of links) out.get(l.from)?.push(l);
  const state = new Map<string, 0 | 1 | 2>(); // 0 new, 1 on stack, 2 done
  const post: string[] = [];
  const loops: CpmLink[] = [];
  for (const root of ids) {
    if (state.get(root)) continue;
    // Iterative DFS: stack of [node, next edge index].
    const stack: [string, number][] = [[root, 0]];
    state.set(root, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const edges = out.get(top[0])!;
      if (top[1] < edges.length) {
        const l = edges[top[1]++];
        const st = state.get(l.to) ?? 0;
        if (st === 1) loops.push(l);
        else if (st === 0) { state.set(l.to, 1); stack.push([l.to, 0]); }
      } else {
        state.set(top[0], 2);
        post.push(top[0]);
        stack.pop();
      }
    }
  }
  return { order: post.reverse(), loops };
}
