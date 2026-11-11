// Three-week lookahead (Spec R2 §7.6, Phase 2 Step 3). Pure, so the dashboard
// view and the PDF show the same rows. The window is this week, next week and
// the week after (Monday to Friday, from the Monday of the given day). Rows are
// the tasks active in the window, grouped by phase, with who does the work and
// the selection a task waits on. The client version keeps client-visible tasks
// only, drops the trade and internal flags, and shows only client selections.

import { requestBy, inspectionStatusLabel, CLEARS_HOLD } from "../inspections/status.ts";

export type LookaheadAudience = "internal" | "client";

export type LookaheadItem = {
  id: string; title: string; kind: string; status: string | null; phase_id: string | null;
  start_date: string | null; end_date: string | null; percent_complete?: number | null;
  actual_start?: string | null; actual_finish?: string | null; client_visible?: boolean;
  responsible_company?: string | null; assignees?: { name: string; type?: string }[];
  link_type?: string | null; link_id?: string | null; link_label?: string | null; sort_order?: number;
  inspection_step_id?: string | null; inspection_status?: string | null;
};
export type LookaheadSelection = { id: string; name: string; status: string | null; target_decision_date: string | null; client_visible?: boolean };
export type LookaheadPhase = { id: string; name: string; sort_order?: number };

export type LookaheadStatus = "done" | "in_progress" | "late" | "not_started";
export type LookaheadRow = {
  id: string; title: string; milestone: boolean; trade: string | null;
  start: string | null; finish: string | null; status: LookaheadStatus; pct: number;
  /** Day indexes (0–14) in the window the task is planned on. */
  days: number[];
  waitsOn: { name: string; decided: boolean; due: string | null; late: boolean } | null;
  /** Inspection milestones (internal only): status and when to request it; `callNow` = request by today or overdue. */
  inspection?: { status: string; requestBy: string | null; callNow: boolean } | null;
};
/** The job's jurisdiction cutoff, for request-by dates on inspection milestones. */
export type LookaheadCutoff = { minutes: number | null; method: string | null } | null;
export type LookaheadGroup = { phase: string; rows: LookaheadRow[] };
export type Lookahead = { from: string; to: string; days: string[]; weeks: { label: string; start: string }[]; groups: LookaheadGroup[]; count: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (s: string) => new Date(`${s}T12:00:00Z`);

/** The 15 weekdays from the Monday of `today`'s week. */
export function lookaheadDays(today: string): string[] {
  const d = at(today);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  const out: string[] = [];
  while (out.length < 15) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const DECIDED = new Set(["approved", "selected", "ordered", "delivered", "installed", "complete", "completed", "decided"]);

function statusOf(i: LookaheadItem, today: string): LookaheadStatus {
  const pct = i.percent_complete ?? 0;
  if (i.status === "complete" || pct >= 100) return "done";
  if (pct > 0 || i.actual_start || i.status === "in_progress") return "in_progress";
  if (i.start_date && i.start_date < today) return "late";
  return "not_started";
}

function tradeOf(i: LookaheadItem): string | null {
  if (i.responsible_company?.trim()) return i.responsible_company.trim();
  const a = i.assignees ?? [];
  const outside = a.filter((x) => x.type === "vendor" || x.type === "contractor").map((x) => x.name);
  const names = (outside.length ? outside : a.map((x) => x.name)).filter(Boolean);
  return names.length ? names.join(", ") : null;
}

export function buildLookahead(items: LookaheadItem[], phases: LookaheadPhase[], selections: LookaheadSelection[], today: string, audience: LookaheadAudience = "internal", cutoff: LookaheadCutoff = null): Lookahead {
  const days = lookaheadDays(today);
  const from = days[0], to = days[days.length - 1];
  const sel = new Map(selections.map((s) => [s.id, s]));
  const phaseOrder = new Map(phases.map((p, n) => [p.id, { name: p.name, n: p.sort_order ?? n }]));
  const groups = new Map<string, { n: number; rows: (LookaheadRow & { sort: number })[] }>();
  let count = 0;
  for (const i of items) {
    if (i.status === "cancelled" || !i.start_date) continue;
    if (audience === "client" && !i.client_visible) continue;
    const start = i.start_date, finish = i.end_date ?? i.start_date;
    // Active in the window, or late and still open (it belongs in this week's list).
    const status = statusOf(i, today);
    const overlaps = start <= to && finish >= from;
    if (!overlaps && !(status === "late" || (status === "in_progress" && start <= to))) continue;
    if (status === "done" && !overlaps) continue;
    const s = i.link_type === "selection" && i.link_id ? sel.get(i.link_id) : undefined;
    const showSel = s && (audience === "internal" || s.client_visible);
    const decided = !!s && DECIDED.has((s.status ?? "").toLowerCase());
    const row: LookaheadRow & { sort: number } = {
      id: i.id, title: i.title, milestone: i.kind === "milestone",
      trade: audience === "client" ? null : tradeOf(i),
      start, finish, status: audience === "client" && status === "late" ? "not_started" : status,
      pct: Math.max(0, Math.min(100, Math.round(status === "done" ? 100 : i.percent_complete ?? 0))),
      days: days.map((d, n) => (d >= start && d <= finish ? n : -1)).filter((n) => n >= 0),
      waitsOn: showSel ? { name: s!.name, decided, due: s!.target_decision_date, // Late: not decided, and due after the task starts or already overdue.
      late: !decided && !!s!.target_decision_date && (s!.target_decision_date > start || s!.target_decision_date < today) } : null,
      inspection: audience === "internal" && i.inspection_step_id ? (() => {
        const st = i.inspection_status ?? "not_ready";
        const by = CLEARS_HOLD.has(st) || st === "scheduled" ? null : requestBy(start, cutoff?.minutes ?? null, cutoff?.method ?? null);
        return { status: inspectionStatusLabel(st), requestBy: by?.label ?? null, callNow: !!by && by.date <= today && (st === "not_ready" || st === "ready_to_call") };
      })() : null,
      sort: i.sort_order ?? 0,
    };
    const key = i.phase_id && phaseOrder.has(i.phase_id) ? i.phase_id : "";
    const g = groups.get(key) ?? { n: key ? phaseOrder.get(key)!.n : 1e9, rows: [] };
    g.rows.push(row); groups.set(key, g); count++;
  }
  const out = [...groups.entries()].sort((a, b) => a[1].n - b[1].n).map(([key, g]) => ({
    phase: key ? phaseOrder.get(key)!.name : "Other",
    rows: g.rows.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.sort - b.sort).map(({ sort: _sort, ...r }) => r),
  }));
  const weekLabel = ["This week", "Next week", "Week after"];
  return { from, to, days, weeks: [0, 5, 10].map((n, w) => ({ label: weekLabel[w], start: days[n] })), groups: out, count };
}

export const LOOKAHEAD_STATUS_LABELS: Record<LookaheadStatus, string> = { done: "Done", in_progress: "In progress", late: "Late start", not_started: "Not started" };
