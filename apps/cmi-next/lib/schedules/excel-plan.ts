// Excel round trip (Spec R2 §11): the columns a schedule exports, and turning
// an uploaded sheet back into grid changes for a preview. Pure, so the preview
// and the tests agree; lib/schedules/excel.ts reads and writes the workbook.
//
// Rows match on the hidden Task GUID column (the item id). Rows with no GUID
// are new tasks. Tasks whose GUID is missing from a file that has GUIDs are
// offered as deletions, never deleted silently.
import { cellText, columnForHeader, parseCell, type ColumnKey, type GridCtx, type GridOps, type PredEdit } from "./grid.ts";
import type { ScheduleItem, SchedulePhase } from "./types";

export const GUID_HEADER = "Task GUID";
export const PHASE_HEADER = "Phase";

/** Exported columns, in order (Task GUID is hidden in the sheet). */
export const EXPORT_COLUMNS: ColumnKey[] = [
  "id", "name", "duration", "start", "finish", "preds", "succs", "pct", "float",
  "constraint", "cdate", "calendar", "mtype", "contract", "variance", "cost_code", "wbs", "location", "lead", "orderby", "assigned", "notes",
];
/** What an upload may change (the rest is worked out or set elsewhere). */
const IMPORTABLE = new Set<ColumnKey>(["id", "name", "duration", "start", "finish", "preds", "pct", "constraint", "cdate", "calendar", "mtype", "contract", "cost_code", "wbs", "location", "lead", "notes"]);

export type ImportChange = { field: string; from: string; to: string };
export type ImportRow = {
  kind: "update" | "create";
  row: number;
  id?: string;
  title: string;
  activityId: number | null;
  changes: ImportChange[];
};
export type ImportPlan = {
  ops: GridOps;
  rows: ImportRow[];
  /** Tasks in the schedule that aren't in the file (only when it has GUIDs). */
  deletions: { id: string; title: string; activityId: number | null }[];
  errors: string[];
  ignoredColumns: string[];
  unchanged: number;
};

const LABEL: Partial<Record<ColumnKey, string>> = {
  id: "ID", name: "Task name", duration: "Duration", start: "Start", finish: "Finish", preds: "Predecessors",
  pct: "% complete", constraint: "Constraint", cdate: "Constraint date", calendar: "Calendar",
  mtype: "Milestone type", contract: "Contract date", cost_code: "Cost code", wbs: "WBS", location: "Location", lead: "Lead time", notes: "Notes",
};

export function planImport(sheet: string[][], items: ScheduleItem[], phases: SchedulePhase[], ctx: GridCtx): ImportPlan {
  const plan: ImportPlan = { ops: { updates: [], creates: [], predecessors: [] }, rows: [], deletions: [], errors: [], ignoredColumns: [], unchanged: 0 };
  const header = sheet[0] ?? [];
  let guidCol = -1, phaseCol = -1;
  const cols: (ColumnKey | null)[] = header.map((h, i) => {
    const t = String(h ?? "").trim();
    if (t.toLowerCase() === GUID_HEADER.toLowerCase()) { guidCol = i; return null; }
    if (t.toLowerCase() === PHASE_HEADER.toLowerCase() || t.toLowerCase() === "wbs") { phaseCol = i; return null; }
    const k = t ? columnForHeader(t) : null;
    // Unknown headers are reported; known read-only ones (Successors, Float…) just aren't imported.
    if (t && !k) plan.ignoredColumns.push(t);
    return k && IMPORTABLE.has(k) ? k : null;
  });
  if (!cols.includes("name")) { plan.errors.push("The sheet needs a “Task name” column."); return plan; }

  const byId = new Map(items.map((i) => [i.id, i]));
  const phaseByName = new Map(phases.map((p) => [p.name.trim().toLowerCase(), p.id]));
  const phaseOf = (raw: string, rowNo: number): string | null | undefined => {
    const name = raw.trim();
    if (!name) return null;
    const id = phaseByName.get(name.toLowerCase());
    if (!id) { plan.errors.push(`Row ${rowNo}: there's no phase called “${name}”; the task goes in without a phase.`); return null; }
    return id;
  };

  // New rows get their IDs first so predecessors in the file can point at them.
  const ctx2: GridCtx = { ...ctx, idByActivity: new Map(ctx.idByActivity), activityById: new Map(ctx.activityById) };
  const seenGuids = new Set<string>();
  const idCol = cols.indexOf("id");
  const data = sheet.slice(1).map((r, i) => ({ cells: r.map((c) => String(c ?? "")), rowNo: i + 2 }))
    .filter(({ cells }) => cells.some((c, j) => c.trim() && j !== guidCol));
  const fresh: { tempId: string; cells: string[]; rowNo: number; stub: ScheduleItem }[] = [];
  let seq = 0;
  for (const { cells, rowNo } of data) {
    const guid = guidCol >= 0 ? cells[guidCol]?.trim() : "";
    if (guid && byId.has(guid)) { seenGuids.add(guid); continue; }
    if (guid) plan.errors.push(`Row ${rowNo}: Task GUID ${guid.slice(0, 8)}… isn't in this schedule; it's added as a new task.`);
    const tempId = `xl-${++seq}`;
    const n = idCol >= 0 && /^\d+$/.test(cells[idCol]?.trim() ?? "") ? Number(cells[idCol].trim()) : null;
    const id = n != null && !ctx2.idByActivity.has(n) ? n : null;
    if (n != null && id == null) plan.errors.push(`Row ${rowNo}: activity ${n} is already used; the new task gets the next free ID.`);
    if (id != null) ctx2.idByActivity.set(id, tempId);
    ctx2.activityById.set(tempId, id);
    const stub = { id: tempId, schedule_id: items[0]?.schedule_id ?? "", kind: "task", title: "", status: "not_started", start_date: null, end_date: null, duration_days: null, activity_id: id, assignees: [] } as unknown as ScheduleItem;
    fresh.push({ tempId, cells, rowNo, stub });
  }

  // Updates to existing tasks.
  for (const { cells, rowNo } of data) {
    const guid = guidCol >= 0 ? cells[guidCol]?.trim() : "";
    const item = guid ? byId.get(guid) : undefined;
    if (!item) continue;
    const patch: Partial<ScheduleItem> = {};
    const changes: ImportChange[] = [];
    let preds: PredEdit | null = null;
    cols.forEach((k, j) => {
      if (!k) return;
      const text = (cells[j] ?? "").trim();
      const was = cellText(item, k, ctx);
      if (text === was.trim()) return;
      // A blank name keeps the name; blank dates are left for the schedule to work out.
      if (!text && (k === "name" || k === "start" || k === "finish")) return;
      const ch = parseCell(item, k, text, ctx2);
      if (ch.error) { plan.errors.push(`Row ${rowNo} (${item.title}), ${LABEL[k] ?? k}: ${ch.error}`); return; }
      if (ch.patch) Object.assign(patch, ch.patch);
      if (ch.preds) preds = ch.preds;
      changes.push({ field: LABEL[k] ?? k, from: was || "—", to: text || "—" });
    });
    if (phaseCol >= 0) {
      const pid = phaseOf(cells[phaseCol] ?? "", rowNo);
      if (pid !== undefined && (pid ?? null) !== (item.phase_id ?? null)) {
        patch.phase_id = pid;
        changes.push({ field: "Phase", from: phases.find((p) => p.id === item.phase_id)?.name ?? "—", to: (cells[phaseCol] ?? "").trim() || "—" });
      }
    }
    if (!changes.length) { plan.unchanged++; continue; }
    if (Object.keys(patch).length) plan.ops.updates!.push({ id: item.id, patch });
    if (preds) plan.ops.predecessors!.push(preds);
    plan.rows.push({ kind: "update", row: rowNo, id: item.id, title: item.title, activityId: item.activity_id ?? null, changes });
  }

  // New tasks, in file order, after the existing ones.
  const base = items.length;
  fresh.forEach(({ tempId, cells, rowNo, stub }, i) => {
    const row: Partial<ScheduleItem> = { kind: "task", sort_order: base + i, activity_id: stub.activity_id ?? undefined };
    const changes: ImportChange[] = [];
    cols.forEach((k, j) => {
      const text = (cells[j] ?? "").trim();
      if (!k || k === "id" || !text) return;
      const ch = parseCell({ ...stub, ...row } as ScheduleItem, k, text, ctx2);
      if (ch.error) { plan.errors.push(`Row ${rowNo}, ${LABEL[k] ?? k}: ${ch.error}`); return; }
      if (ch.patch) Object.assign(row, ch.patch);
      if (ch.preds) plan.ops.predecessors!.push(ch.preds);
      changes.push({ field: LABEL[k] ?? k, from: "", to: text });
    });
    if (phaseCol >= 0) { const pid = phaseOf(cells[phaseCol] ?? "", rowNo); if (pid) row.phase_id = pid; }
    if (!row.title) { plan.errors.push(`Row ${rowNo}: no task name, so it was skipped.`); return; }
    if (row.start_date && !row.end_date) row.end_date = row.start_date;
    plan.ops.creates!.push({ tempId, row });
    plan.rows.push({ kind: "create", row: rowNo, title: row.title, activityId: row.activity_id ?? null, changes });
  });

  // Offer deletions only when the file carries GUIDs (it came from an export).
  if (guidCol >= 0 && seenGuids.size) {
    plan.deletions = items.filter((i) => !seenGuids.has(i.id)).map((i) => ({ id: i.id, title: i.title, activityId: i.activity_id ?? null }));
  }
  return plan;
}
