// Inspection milestones, Step 3: which library rows apply to a job, and how
// each one hooks into the schedule. Pure (no I/O): the API loads the rows,
// the schedule's items and links, then applies the plan in one batch.
//
// Brandon's rules (docs/features/schedule-builder/inspection-milestones-plan.md):
//   • every row is a zero-duration milestone (Inspection, Internal or Contract);
//   • it links Finish→Start (lag 0) from the work task before it, and the work
//     task it releases links Finish→Start from it, so a later inspection date
//     pushes everything behind it;
//   • filter by jurisdiction + scope (NEW / ADD / REN); "If …" rows follow the
//     job's conditions; rows marked as repeating are copied per pour / lift / …
import { scopeRule, scopeCell, type ConditionKey, type InspectionScope } from "./conditions.ts";
import type { InspectionLibraryRow } from "./data.ts";

export type ScheduleTaskRef = {
  id: string;
  title: string;
  kind: string;
  status?: string | null;
  phase_id?: string | null;
  start_date: string | null;
  end_date: string | null;
  inspection_step_id?: string | null;
};
export type TaskHook = { phase_id: string; hook: string; role: "predecessor" | "released"; match_kind: "task" | "add" | "milestone" | "unmapped"; template_task: string | null };
export type Link = { source_item_id: string; target_item_id: string };

export type CandidateState = "include" | "condition_on" | "condition_off" | "confirm";

export type Candidate = {
  row: InspectionLibraryRow;
  state: CandidateState;
  /** Why it's in or out, in plain words. */
  reason: string;
  /** Ticked in the list to start with. */
  selected: boolean;
  /** "Per pour", "Per grout lift"…: ask how many. */
  repeats: string | null;
  /** Copies already on this schedule (loaded before). */
  alreadyLoaded: number;
  /** Tasks the milestone would follow / release, by title; missing ones are listed. */
  follows: string[];
  releases: string[];
  missing: string[];
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const live = (t: ScheduleTaskRef) => t.status !== "cancelled";

/** Library rows for this job, with the state each starts in. Rows the scope leaves out ("—") are skipped. */
export function candidatesFor(
  rows: InspectionLibraryRow[], scope: InspectionScope, conditions: ConditionKey[],
  items: ScheduleTaskRef[], hooks: TaskHook[],
): Candidate[] {
  const have = new Set(conditions);
  const loaded = new Map<string, number>();
  for (const i of items) if (i.inspection_step_id) loaded.set(i.inspection_step_id, (loaded.get(i.inspection_step_id) ?? 0) + 1);
  const out: Candidate[] = [];
  for (const row of rows) {
    const cell = scopeCell(row, scope);
    const rule = scopeRule(cell);
    if (rule.kind === "exclude") continue;
    const state: CandidateState = rule.kind === "include" ? "include" : rule.kind === "confirm" ? "confirm" : have.has(rule.key) ? "condition_on" : "condition_off";
    const reason = rule.kind === "include" ? `Required for ${scope}`
      : rule.kind === "confirm" ? `${rule.text}: confirm for this job`
      : `${cell}${have.has(rule.key) ? " (job has it)" : " (not set on the job)"}`;
    const already = loaded.get(row.milestone_id) ?? 0;
    const pred = resolveTasks(row, "predecessor", items, hooks);
    const rel = resolveTasks(row, "released", items, hooks);
    out.push({
      row, state, reason,
      selected: already === 0 && (state === "include" || state === "condition_on"),
      repeats: row.repeats?.trim() || null,
      alreadyLoaded: already,
      follows: pred.tasks.map((t) => t.title),
      releases: rel.tasks.map((t) => t.title),
      missing: [...pred.missing, ...rel.missing],
    });
  }
  return out;
}

/** The hook row for a library milestone's predecessor or released task. */
function hookFor(row: InspectionLibraryRow, role: "predecessor" | "released", hooks: TaskHook[]): { text: string; hook: TaskHook | null } {
  const text = (role === "predecessor" ? row.predecessor_hook : row.released_hook)?.trim() ?? "";
  if (!text) return { text, hook: null };
  const same = hooks.find((h) => h.role === role && h.phase_id === row.phase_id && norm(h.hook) === norm(text));
  return { text, hook: same ?? hooks.find((h) => h.role === role && norm(h.hook) === norm(text)) ?? null };
}

/** Task titles a hook maps to: "A + B + C (all five)" → [A, B, C]. */
export function hookTaskTitles(templateTask: string | null | undefined): string[] {
  return (templateTask ?? "").replace(/\([^)]*\)\s*$/, "").split(/\s\+\s/).map((t) => t.trim()).filter(Boolean);
}

/**
 * The schedule tasks a milestone follows or releases. Tried in order: a task
 * named exactly like the library's hook ("Pour Footings"), then the CMI
 * template task(s) it was mapped to, then a task with the proposed name of a
 * task to add. A hook that points at another milestone is resolved later.
 */
function resolveTasks(row: InspectionLibraryRow, role: "predecessor" | "released", items: ScheduleTaskRef[], hooks: TaskHook[]): { tasks: ScheduleTaskRef[]; missing: string[]; milestoneTarget: string | null } {
  const { text, hook } = hookFor(row, role, hooks);
  if (!text) return { tasks: [], missing: [], milestoneTarget: null };
  const tasks = items.filter((i) => i.kind !== "milestone" && live(i));
  const byTitle = (title: string) => tasks.find((t) => norm(t.title) === norm(title));
  const direct = byTitle(text);
  if (direct) return { tasks: [direct], missing: [], milestoneTarget: null };
  if (hook?.match_kind === "milestone") return { tasks: [], missing: [], milestoneTarget: hook.template_task };
  const names = hookTaskTitles(hook?.template_task);
  const found = names.map(byTitle).filter((t): t is ScheduleTaskRef => !!t);
  if (found.length) return { tasks: found, missing: [], milestoneTarget: null };
  const label = hook?.match_kind === "add" ? `${role === "predecessor" ? "Follows" : "Releases"} “${text}” (no “${names[0] ?? text}” task on this schedule)`
    : `${role === "predecessor" ? "Follows" : "Releases"} “${text}”${names.length ? ` (no “${names.join(" / ")}” task on this schedule)` : " (no matching task)"}`;
  return { tasks: [], missing: [label], milestoneTarget: null };
}

/** Strips the Gantt prefix and code: "INSP · Final drainage (970 (legacy))" → "final drainage". */
export function milestoneKey(name: string): string {
  return norm(name).replace(/^(insp|ms|chk)\s*·\s*/, "").replace(/\s*\(.*$/, "").replace(/\s+inspection$/, "").trim();
}

/** Planned or loaded milestones a "MILESTONE:" hook points at, by name. */
function milestoneTargets(target: string, pool: { key: string; name: string; phase_id: string; type: string }[]): string[] {
  const t = norm(target);
  if (t.startsWith("trade, site and drainage finals")) {
    return pool.filter((m) => (m.phase_id === "P11" || m.phase_id === "P12") && m.type === "inspection").map((m) => m.key);
  }
  for (const want of [milestoneKey(t), ...t.split(" / ").map(milestoneKey)]) {
    if (!want) continue;
    const hits = pool.filter((m) => milestoneKey(m.name) === want || milestoneKey(m.name).startsWith(want));
    if (hits.length) return hits.map((m) => m.key);
  }
  return [];
}

export type PlannedMilestone = {
  key: string;
  step_id: string;
  copy: number;
  copies: number;
  title: string;
  milestone_type: "inspection" | "internal" | "contract";
  phase_id: string;
  code: string | null;
  date: string;
  schedule_phase_id: string | null;
  internal_notes: string;
  hold_point: boolean;
};
export type PlannedLink = { source: string; target: string; lag: number; why: string };
export type Plan = {
  milestones: PlannedMilestone[];
  /** source / target are item ids, or "new:<key>" for a milestone in this plan. */
  links: PlannedLink[];
  /** Hooks that couldn't be linked, per milestone. */
  unlinked: { step_id: string; note: string }[];
  /** Links left out because they would loop back on themselves. */
  skipped: { step_id: string; note: string }[];
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Turn the picked rows (with copy counts) into milestones and Finish→Start
 * links. Dates sit at the predecessor's finish (or the released task's start)
 * so they're sensible before the engine re-forecasts; links that would form a
 * loop with the schedule's existing links are skipped and reported.
 */
export function buildPlan(
  picks: { row: InspectionLibraryRow; count: number }[],
  items: ScheduleTaskRef[], hooks: TaskHook[], existingLinks: Link[],
  opts: { today?: string } = {},
): Plan {
  const today = opts.today ?? isoDay(new Date());
  const milestones: PlannedMilestone[] = [];
  const pending: { m: PlannedMilestone; row: InspectionLibraryRow; pred: ReturnType<typeof resolveTasks>; rel: ReturnType<typeof resolveTasks> }[] = [];
  const dated = new Set<PlannedMilestone>();
  const unlinked: Plan["unlinked"] = [];

  for (const { row, count } of picks) {
    const n = Math.max(1, Math.min(50, Math.floor(count) || 1));
    const pred = resolveTasks(row, "predecessor", items, hooks);
    const rel = resolveTasks(row, "released", items, hooks);
    const ends = pred.tasks.map((t) => t.end_date).filter(Boolean) as string[];
    const starts = rel.tasks.map((t) => t.start_date).filter(Boolean) as string[];
    const fromTasks = ends.length ? ends.sort().at(-1)! : starts.length ? starts.sort()[0] : null;
    const date = fromTasks ?? today;
    const notes = [
      row.jurisdiction_name ? `Jurisdiction: ${row.jurisdiction_name}` : null,
      row.code ? `Code: ${row.code}${row.code_basis ? ` (${row.code_basis})` : ""}` : null,
      row.request_rule ? `Request: ${row.request_rule}` : null,
      row.ready_checklist ? `Ready to call: ${row.ready_checklist}` : null,
      row.include_when ? `Applies when: ${row.include_when}` : null,
      row.notes ? `Notes: ${row.notes}` : null,
      `Library: ${row.milestone_id} · ${row.phase_id}${row.doc_step ? ` · ${row.doc_step}` : ""}`,
    ].filter(Boolean).join("\n");
    for (let c = 1; c <= n; c++) {
      const m: PlannedMilestone = {
        key: n > 1 ? `${row.milestone_id}#${c}` : row.milestone_id,
        step_id: row.milestone_id, copy: c, copies: n,
        title: n > 1 ? `${row.gantt_name} (${c} of ${n})` : row.gantt_name,
        milestone_type: row.milestone_type, phase_id: row.phase_id, code: row.code,
        date, schedule_phase_id: pred.tasks[0]?.phase_id ?? rel.tasks[0]?.phase_id ?? null,
        internal_notes: notes, hold_point: row.hold_point,
      };
      milestones.push(m);
      if (fromTasks) dated.add(m);
      pending.push({ m, row, pred, rel });
    }
    for (const note of [...pred.missing, ...rel.missing]) unlinked.push({ step_id: row.milestone_id, note });
  }

  // A milestone with no task to date it from sits with its neighbours: the nearest dated one
  // before it in library order (phase, then the workbook's order), else the nearest after it.
  const order = milestones.map((m, n) => ({ m, n, k: `${m.phase_id}|${String(picks.find((p) => p.row.milestone_id === m.step_id)?.row.sort_order ?? 0).padStart(6, "0")}` }))
    .sort((a, b) => a.k.localeCompare(b.k) || a.n - b.n).map((x) => x.m);
  order.forEach((m, i) => {
    if (dated.has(m)) return;
    const before = order.slice(0, i).reverse().find((x) => dated.has(x));
    const after = order.slice(i + 1).find((x) => dated.has(x));
    const near = before ?? after;
    if (near) { m.date = near.date; m.schedule_phase_id ??= near.schedule_phase_id; }
  });

  // Milestones a "MILESTONE:" hook can point at: this plan's, and ones already on the schedule.
  const pool = [
    ...milestones.map((m) => ({ key: `new:${m.key}`, name: m.title, phase_id: m.phase_id, type: m.milestone_type, step: m.step_id })),
    ...items.filter((i) => i.kind === "milestone" && i.inspection_step_id && live(i)).map((i) => ({ key: i.id, name: i.title, phase_id: "", type: "inspection", step: i.inspection_step_id! })),
  ];

  const proposed: PlannedLink[] = [];
  for (const { m, row, pred, rel } of pending) {
    const self = `new:${m.key}`;
    for (const t of pred.tasks) proposed.push({ source: t.id, target: self, lag: 0, why: `${t.title} → ${m.title}` });
    for (const t of rel.tasks) proposed.push({ source: self, target: t.id, lag: 0, why: `${m.title} → ${t.title}` });
    if (pred.milestoneTarget) {
      const hits = milestoneTargets(pred.milestoneTarget, pool.filter((p) => p.key !== self));
      if (hits.length) for (const h of hits) proposed.push({ source: h, target: self, lag: 0, why: `${pool.find((p) => p.key === h)?.name} → ${m.title}` });
      else unlinked.push({ step_id: row.milestone_id, note: `Follows “${pred.milestoneTarget}” (not on this schedule)` });
    }
    if (rel.milestoneTarget) {
      // "Final building (next day or later)": Maricopa County won't do both the same day.
      const lag = /next day/i.test(row.released_hook ?? "") ? 1 : 0;
      const hits = milestoneTargets(rel.milestoneTarget, pool.filter((p) => p.key !== self));
      if (hits.length) for (const h of hits) proposed.push({ source: self, target: h, lag, why: `${m.title} → ${pool.find((p) => p.key === h)?.name}${lag ? " (next working day or later)" : ""}` });
      else unlinked.push({ step_id: row.milestone_id, note: `Releases “${rel.milestoneTarget}” (not on this schedule)` });
    }
  }

  // Drop self-links, duplicates and anything that would close a loop.
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => { if (!adj.has(a)) adj.set(a, new Set()); adj.get(a)!.add(b); };
  for (const l of existingLinks) add(l.source_item_id, l.target_item_id);
  const reaches = (from: string, to: string) => {
    const seen = new Set<string>(); const stack = [from];
    while (stack.length) { const n = stack.pop()!; if (n === to) return true; if (seen.has(n)) continue; seen.add(n); for (const x of adj.get(n) ?? []) stack.push(x); }
    return false;
  };
  const links: PlannedLink[] = [];
  const skipped: Plan["skipped"] = [];
  const seen = new Set<string>();
  for (const l of proposed) {
    const id = `${l.source}>${l.target}`;
    if (l.source === l.target || seen.has(id)) continue;
    seen.add(id);
    if (reaches(l.target, l.source)) {
      skipped.push({ step_id: (l.source.startsWith("new:") ? l.source : l.target).replace(/^new:/, "").replace(/#\d+$/, ""), note: `Left out ${l.why}: it would loop back through the schedule's existing links` });
      continue;
    }
    add(l.source, l.target);
    links.push(l);
  }
  return { milestones, links, unlinked, skipped };
}
