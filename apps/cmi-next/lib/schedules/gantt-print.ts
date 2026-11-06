// 11×17 Gantt print (Phase 2 Step 8). Pure: which tasks each print option
// shows, grouped by phase, and the timeline scale (weeks or months) so the
// bars fit the sheet. The PDF only draws what this returns.
//   full        every task and milestone
//   lookahead   the three-week lookahead window (from this week's Monday)
//   milestones  milestones only
//   client      client-visible tasks only

export type GanttPrintView = "full" | "lookahead" | "milestones" | "client";
export const GANTT_PRINT_VIEWS: { key: GanttPrintView; label: string }[] = [
  { key: "full", label: "Full schedule" },
  { key: "lookahead", label: "Three-week lookahead" },
  { key: "milestones", label: "Milestones" },
  { key: "client", label: "Client" },
];

export type PrintItem = {
  id: string; title: string; kind: string; status: string | null; phase_id: string | null; sort_order?: number;
  start_date: string | null; end_date: string | null; percent_complete?: number | null; activity_id?: number | null;
  client_visible?: boolean; is_critical?: boolean | null; baseline_start?: string | null; baseline_end?: string | null;
};
export type PrintRow =
  | { kind: "phase"; name: string }
  | { kind: "task"; item: PrintItem };
export type Scale = { unit: "week" | "month"; from: string; to: string; ticks: { at: string; label: string; major?: string }[] };

const at = (s: string) => Date.parse(`${s}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86400000;

function monday(s: string) {
  const d = new Date(at(s)); const w = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (w === 0 ? 6 : w - 1));
  return iso(d.getTime());
}

export function printRows(items: PrintItem[], phases: { id: string; name: string; sort_order?: number }[], view: GanttPrintView, today: string): PrintRow[] {
  const winFrom = monday(today), winTo = iso(at(winFrom) + 18 * DAY);
  const keep = items.filter((i) => {
    if (i.status === "cancelled" || !i.start_date) return false;
    if (view === "milestones") return i.kind === "milestone";
    if (view === "client") return !!i.client_visible;
    if (view === "lookahead") return i.start_date <= winTo && (i.end_date ?? i.start_date) >= winFrom;
    return true;
  });
  const order = new Map(phases.map((p, n) => [p.id, p.sort_order ?? n]));
  const groups = new Map<string, PrintItem[]>();
  for (const i of keep) { const k = i.phase_id && order.has(i.phase_id) ? i.phase_id : ""; groups.set(k, [...(groups.get(k) ?? []), i]); }
  const out: PrintRow[] = [];
  const keys = [...groups.keys()].sort((a, b) => (a ? order.get(a)! : 1e9) - (b ? order.get(b)! : 1e9));
  for (const k of keys) {
    if (phases.length) out.push({ kind: "phase", name: k ? phases.find((p) => p.id === k)!.name : "Other" });
    for (const i of groups.get(k)!.sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "") || (a.sort_order ?? 0) - (b.sort_order ?? 0))) out.push({ kind: "task", item: i });
  }
  return out;
}

/** Weeks for spans up to ~9 months, months beyond, padded to whole units. */
export function printScale(rows: PrintRow[], view: GanttPrintView, today: string): Scale {
  const tasks = rows.flatMap((r) => (r.kind === "task" ? [r.item] : []));
  let from = tasks.reduce<string | null>((m, i) => (!m || i.start_date! < m ? i.start_date! : m), null) ?? today;
  let to = tasks.reduce<string | null>((m, i) => { const e = i.end_date ?? i.start_date!; return !m || e > m ? e : m; }, null) ?? today;
  if (view === "lookahead") { from = monday(today); to = iso(at(from) + 20 * DAY); }
  const weeks = (at(to) - at(from)) / DAY / 7;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  if (weeks <= 40) {
    const start = monday(from);
    const ticks: Scale["ticks"] = [];
    let lastMonth = -1;
    for (let t = at(start); t <= at(to); t += 7 * DAY) {
      const d = new Date(t);
      const m = d.getUTCMonth();
      ticks.push({ at: iso(t), label: String(d.getUTCDate()), major: m !== lastMonth ? `${MON[m]} ${String(d.getUTCFullYear()).slice(2)}` : undefined });
      lastMonth = m;
    }
    return { unit: "week", from: start, to: iso(at(ticks[ticks.length - 1].at) + 7 * DAY), ticks };
  }
  const s = new Date(at(from)); s.setUTCDate(1);
  const ticks: Scale["ticks"] = [];
  let lastYear = -1;
  for (const d = new Date(s); d.getTime() <= at(to); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const y = d.getUTCFullYear();
    ticks.push({ at: iso(d.getTime()), label: MON[d.getUTCMonth()], major: y !== lastYear ? String(y) : undefined });
    lastYear = y;
  }
  const end = new Date(at(ticks[ticks.length - 1].at)); end.setUTCMonth(end.getUTCMonth() + 1);
  return { unit: "month", from: ticks[0].at, to: iso(end.getTime()), ticks };
}

/** 0–1 position of a date on the scale. */
export function xOf(scale: Pick<Scale, "from" | "to">, date: string): number {
  const span = at(scale.to) - at(scale.from);
  return span ? Math.max(0, Math.min(1, (at(date) - at(scale.from)) / span)) : 0;
}
/** Inclusive end: a task ending on a day covers that whole day. */
export const endX = (scale: Pick<Scale, "from" | "to">, date: string) => xOf(scale, iso(at(date) + DAY));
