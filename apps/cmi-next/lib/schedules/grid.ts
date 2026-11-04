// The schedule grid (Spec R2 §4): row order shared with the Gantt, the
// columns, and turning what someone types or pastes into a cell into a change.
// Pure, so the grid, the Gantt and the tests agree.
import { parseLinks, parseDuration, formatLinks, type LinkRef } from "./predecessors.ts";
import type { ScheduleItem, SchedulePhase, DependencyType } from "./types";

// ---- rows -----------------------------------------------------------------

export type GridRow =
  | { kind: "group"; key: string; label: string; color?: string; phaseId?: string | null; scheduleId?: string }
  | { kind: "item"; item: ScheduleItem };

type RowItem = Pick<ScheduleItem, "id" | "schedule_id" | "phase_id" | "sort_order" | "start_date"> & Partial<ScheduleItem>;

export function sortItems(a: RowItem, b: RowItem): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return (a.start_date ?? "") < (b.start_date ?? "") ? -1 : 1;
}

/** Rows in display order: by schedule (overlay), by phase (one schedule), or
 *  flat. Phases listed in `collapsed` show their header but not their tasks. */
export function scheduleRows(items: ScheduleItem[], phases: SchedulePhase[] | undefined, opts: {
  groupBySchedule?: boolean; collapsed?: Set<string>; scheduleColor?: (id: string, color?: string | null) => string;
} = {}): GridRow[] {
  const out: GridRow[] = [];
  if (opts.groupBySchedule) {
    const groups = new Map<string, ScheduleItem[]>();
    for (const i of items) { if (!groups.has(i.schedule_id)) groups.set(i.schedule_id, []); groups.get(i.schedule_id)!.push(i); }
    for (const [sid, its] of groups) {
      out.push({ kind: "group", key: `s-${sid}`, label: its[0]?.schedule_name ?? "Schedule", color: opts.scheduleColor?.(sid, its[0]?.schedule_color), scheduleId: sid });
      its.sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
    }
  } else if (phases && phases.length) {
    const byPhase = new Map<string, ScheduleItem[]>();
    for (const i of items) { const k = i.phase_id ?? "none"; if (!byPhase.has(k)) byPhase.set(k, []); byPhase.get(k)!.push(i); }
    for (const ph of phases) {
      out.push({ kind: "group", key: `p-${ph.id}`, label: ph.name, color: ph.color ?? undefined, phaseId: ph.id });
      if (opts.collapsed?.has(ph.id)) continue;
      (byPhase.get(ph.id) ?? []).sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
    }
    const orphan = (byPhase.get("none") ?? []).concat(items.filter((i) => i.phase_id && !phases.some((p) => p.id === i.phase_id)));
    if (orphan.length) {
      out.push({ kind: "group", key: "p-none", label: "Unphased", phaseId: null });
      if (!opts.collapsed?.has("none")) orphan.sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
    }
  } else {
    items.slice().sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
  }
  return out;
}

// ---- columns --------------------------------------------------------------

export type ColumnKey =
  | "id" | "name" | "duration" | "start" | "finish" | "preds" | "succs" | "pct"
  | "float" | "constraint" | "cdate" | "calendar" | "assigned" | "status" | "cost_code" | "notes"
  | "mtype" | "contract" | "variance";

export type Column = { key: ColumnKey; label: string; width: number; editable: boolean; align?: "right"; aliases?: string[] };

export const GRID_COLUMNS: Column[] = [
  { key: "id", label: "ID", width: 56, editable: true, align: "right", aliases: ["activity id", "activity", "#"] },
  { key: "name", label: "Task name", width: 240, editable: true, aliases: ["task", "name", "title", "activity name", "description"] },
  { key: "duration", label: "Duration", width: 72, editable: true, align: "right", aliases: ["dur", "days", "duration (days)"] },
  { key: "start", label: "Start", width: 108, editable: true, aliases: ["start date"] },
  { key: "finish", label: "Finish", width: 92, editable: true, aliases: ["finish date", "end", "end date"] },
  { key: "preds", label: "Predecessors", width: 120, editable: true, aliases: ["predecessor", "pred", "preds"] },
  { key: "succs", label: "Successors", width: 120, editable: false, aliases: ["successor", "succ"] },
  { key: "pct", label: "%", width: 52, editable: true, align: "right", aliases: ["% complete", "percent complete", "complete", "pct"] },
  { key: "float", label: "Float", width: 56, editable: false, align: "right", aliases: ["total float", "tf"] },
  { key: "constraint", label: "Constraint", width: 92, editable: true },
  { key: "cdate", label: "Constraint date", width: 100, editable: true },
  { key: "calendar", label: "Calendar", width: 84, editable: true },
  { key: "assigned", label: "Assigned", width: 140, editable: false, aliases: ["assignees", "resource", "resources"] },
  { key: "status", label: "Status", width: 100, editable: false },
  { key: "cost_code", label: "Cost code", width: 84, editable: true, aliases: ["cost", "code"] },
  { key: "notes", label: "Notes", width: 200, editable: true, aliases: ["note", "internal notes", "comments"] },
  { key: "mtype", label: "Milestone type", width: 112, editable: true, aliases: ["milestone type", "type"] },
  { key: "contract", label: "Contract date", width: 100, editable: true, aliases: ["contract", "contract date"] },
  { key: "variance", label: "vs contract", width: 84, editable: false, align: "right", aliases: ["variance", "variance to contract"] },
];
export const COLUMN = Object.fromEntries(GRID_COLUMNS.map((c) => [c.key, c])) as Record<ColumnKey, Column>;

export const GRID_LAYOUTS: Record<string, ColumnKey[]> = {
  "PM view": ["id", "name", "duration", "start", "finish", "preds", "succs", "pct", "float", "constraint", "assigned", "notes"],
  "Super view": ["id", "name", "duration", "start", "finish", "pct", "float", "assigned", "notes"],
  "Client print": ["name", "start", "finish", "pct"],
  "Milestones": ["id", "name", "start", "mtype", "contract", "variance", "float", "notes"],
};

// ---- reading cells ----------------------------------------------------------

export type GridCtx = {
  /** activity_id → item id, for this schedule. */
  idByActivity: Map<number, string>;
  /** item id → activity_id. */
  activityById: Map<string, number | null>;
  /** Links into each item from this schedule (same-schedule only). */
  predsOf: (itemId: string) => LinkRef[];
  succsOf: (itemId: string) => LinkRef[];
  /** Cross-schedule predecessors (shown, not edited here). */
  otherPredCount: (itemId: string) => number;
  /** Working days past (+) or ahead of (−) the contract date, when known. */
  varianceOf?: (itemId: string) => number | null | undefined;
};

export const CONSTRAINT_TEXT: Record<string, string> = { snet: "SNET", mfo: "MFO", alap: "ALAP", locked: "Locked" };

export function cellText(item: ScheduleItem, key: ColumnKey, ctx: GridCtx): string {
  switch (key) {
    case "id": return item.activity_id != null ? String(item.activity_id) : "";
    case "name": return item.title ?? "";
    case "duration": {
      if (item.kind === "milestone") return "0";
      const d = item.duration_days;
      if (d == null) return "";
      return item.duration_unit === "calendar" ? `${d}cd` : String(d);
    }
    case "start": return item.start_date ?? "";
    case "finish": return item.kind === "milestone" ? item.start_date ?? "" : item.end_date ?? "";
    case "preds": return formatLinks(ctx.predsOf(item.id));
    case "succs": return formatLinks(ctx.succsOf(item.id));
    case "pct": return String(item.percent_complete ?? 0);
    case "float": return item.total_float != null ? String(item.total_float) : "";
    case "constraint": return item.is_locked ? "Locked" : item.constraint_type ? CONSTRAINT_TEXT[item.constraint_type] : "";
    case "cdate": return item.is_locked ? item.start_date ?? "" : item.constraint_date ?? "";
    case "calendar": return item.duration_unit === "calendar" ? "Calendar days" : "Working days";
    case "assigned": return (item.assignees ?? []).map((a) => a.name).join(", ");
    case "status": return item.status ?? "";
    case "cost_code": return item.cost_code ?? "";
    case "notes": return item.internal_notes ?? "";
    case "mtype": return item.milestone_type ? MILESTONE_TEXT[item.milestone_type] ?? item.milestone_type : "";
    case "contract": return item.contract_date ?? "";
    case "variance": {
      const v = ctx.varianceOf?.(item.id);
      return v == null ? "" : v === 0 ? "on date" : `${v > 0 ? "+" : ""}${v} wd`;
    }
  }
}

export const MILESTONE_TEXT: Record<string, string> = { contract: "Contract", inspection: "Inspection", client_decision: "Client decision", internal: "Internal" };

// ---- writing cells ----------------------------------------------------------

export type PredEdit = { itemId: string; links: { sourceItemId: string; type: DependencyType; lag: number }[] };

/** A batch of grid edits (saved by lib/schedules/grid-data.ts, or tried out
 *  locally by lib/schedules/whatif.ts). */
export type GridOps = {
  updates?: { id: string; patch: Partial<ScheduleItem> }[];
  /** New rows. tempId lets predecessors in the same batch point at them. */
  creates?: { tempId: string; row: Partial<ScheduleItem> }[];
  deletes?: string[];
  /** Same-schedule predecessors for each item (replaces them; links from other schedules are kept). */
  predecessors?: PredEdit[];
  /** Renumber every activity ID by tens in display order. */
  renumber?: boolean;
};
export type CellChange = { patch?: Partial<ScheduleItem>; preds?: PredEdit; error?: string };

/** "2026-11-04", "11/4/2026", "11/4/26", "Nov 4, 2026", or an Excel serial day. */
export function parseDateCell(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return iso(y, +m[1], +m[2]); }
  if (/^\d{5}$/.test(t)) { // Excel serial (1900 date system)
    const d = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(`${t} UTC`);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const CONSTRAINT_IN: Record<string, ScheduleItem["constraint_type"] | "locked" | ""> = {
  "": "", none: "", snet: "snet", "start no earlier than": "snet", mfo: "mfo", "must finish on": "mfo",
  alap: "alap", "as late as possible": "alap", locked: "locked", lock: "locked",
};

/** Turn typed or pasted text into a change for one cell. */
export function parseCell(item: ScheduleItem, key: ColumnKey, text: string, ctx: GridCtx): CellChange {
  const t = text.trim();
  switch (key) {
    case "id": {
      if (!t) return { error: "Every task needs an activity ID." };
      if (!/^\d+$/.test(t)) return { error: `"${t}" isn't an activity ID (a whole number).` };
      const n = Number(t);
      const other = ctx.idByActivity.get(n);
      if (other && other !== item.id) return { error: `Activity ${n} is already used in this schedule.` };
      return { patch: { activity_id: n } };
    }
    case "name": return t ? { patch: { title: t } } : { error: "A task needs a name." };
    case "duration": {
      if (!t) return { patch: { duration_days: null } };
      const d = parseDuration(t);
      if (!d) return { error: `"${t}" isn't a duration. Use working days (8) or calendar days (7cd).` };
      if (d.days === 0) return { patch: { kind: "milestone", duration_days: null } };
      return { patch: { kind: "task", duration_days: d.days, duration_unit: d.unit } };
    }
    case "start": case "finish": case "cdate": {
      if (!t) return key === "cdate" ? { patch: { constraint_date: null } } : { error: "Dates can't be blank." };
      const d = parseDateCell(t);
      if (!d) return { error: `"${t}" isn't a date.` };
      if (key === "start") return { patch: item.kind === "milestone" ? { start_date: d, end_date: d } : { start_date: d } };
      if (key === "cdate") return { patch: { constraint_date: d } };
      if (item.kind === "milestone") return { patch: { start_date: d, end_date: d } };
      if (item.start_date && d < item.start_date) return { error: "The finish can't be before the start." };
      return { patch: { end_date: d } };
    }
    case "preds": {
      const { links, errors } = parseLinks(t);
      if (errors.length) return { error: errors[0] };
      const self = ctx.activityById.get(item.id);
      const out: PredEdit["links"] = [];
      for (const l of links) {
        if (l.id === self) return { error: `A task can't depend on itself (${l.id}).` };
        const src = ctx.idByActivity.get(l.id);
        if (!src) return { error: `No activity ${l.id} in this schedule.` };
        out.push({ sourceItemId: src, type: l.type, lag: l.lag });
      }
      return { preds: { itemId: item.id, links: out } };
    }
    case "pct": {
      const n = Number(t.replace("%", "") || 0);
      if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "% complete is 0 to 100." };
      return { patch: { percent_complete: Math.round(n) } };
    }
    case "constraint": {
      const c = CONSTRAINT_IN[t.toLowerCase()];
      if (c === undefined) return { error: "Constraint is None, SNET, MFO, ALAP or Locked." };
      if (c === "locked") return { patch: { is_locked: true, constraint_type: null } };
      return { patch: { is_locked: false, constraint_type: c || null, ...(c ? { constraint_date: item.constraint_date ?? item.start_date } : { constraint_date: null }) } };
    }
    case "calendar": {
      const l = t.toLowerCase();
      if (!l || l.startsWith("work") || l === "inherit" || l === "wd") return { patch: { duration_unit: "workdays" } };
      if (l.startsWith("cal") || l === "cd") return { patch: { duration_unit: "calendar" } };
      return { error: "Calendar is Working days or Calendar days." };
    }
    case "cost_code": return { patch: { cost_code: t || null } };
    case "mtype": {
      if (!t) return { patch: { milestone_type: null } };
      const hit = Object.entries(MILESTONE_TEXT).find(([k, v]) => k === t.toLowerCase().replace(/\s+/g, "_") || v.toLowerCase() === t.toLowerCase());
      return hit ? { patch: { milestone_type: hit[0] as ScheduleItem["milestone_type"] } } : { error: "Milestone type is Contract, Inspection, Client decision or Internal." };
    }
    case "contract": {
      if (!t) return { patch: { contract_date: null } };
      const d = parseDateCell(t);
      return d ? { patch: { contract_date: d } } : { error: `"${t}" isn't a date.` };
    }
    case "notes": return { patch: { internal_notes: t || null } };
    default: return { error: "That column is worked out for you." };
  }
}

// ---- paste --------------------------------------------------------------------

/** Tab-separated rows as Excel and Sheets put them on the clipboard (quoted
 *  cells may hold tabs, newlines and doubled quotes). */
export function parseClipboard(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** If the first pasted row is a header row, the column for each pasted column
 *  (null = ignore). Otherwise null, and the paste maps by position. */
export function headerMap(first: string[]): { columns: (ColumnKey | null)[]; unknown: string[] } | null {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const find = (h: string) => GRID_COLUMNS.find((c) => norm(c.label) === h || c.key === h || c.aliases?.includes(h))?.key ?? null;
  const columns = first.map((h) => find(norm(h)));
  const hits = columns.filter(Boolean).length;
  if (hits < Math.max(1, Math.ceil(first.length / 2))) return null;
  return { columns, unknown: first.filter((_, i) => !columns[i] && first[i].trim()) };
}
