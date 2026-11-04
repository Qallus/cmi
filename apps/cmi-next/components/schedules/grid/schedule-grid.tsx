"use client";

// The schedule grid (Spec R2 §4): a spreadsheet beside the Gantt. Type to edit,
// Enter/Tab to move, paste from Excel, Ctrl+D to fill down, Ctrl+Z to undo.
// Every change goes to /api/schedules/[id]/grid as one batch; the engine
// recalculates and the cells it moved flash.
import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, ChevronLeft, GripVertical, Maximize2, Undo2, Redo2, Columns3, ListOrdered, Plus, History, Loader2, FlaskConical, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, AutoTooltip } from "@/components/ui/tooltip";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, type ImperativePanelHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { GanttView, ROW_H, HEAD_H } from "../views/gantt-view";
import {
  GRID_COLUMNS, COLUMN, GRID_LAYOUTS, scheduleRows, cellText, parseCell, parseClipboard, headerMap,
  type ColumnKey, type GridCtx, type GridOps, type PredEdit, type CellChange,
} from "@/lib/schedules/grid";
import { idBetween, type LinkRef } from "@/lib/schedules/predecessors";
import { applyWhatIf, scheduleFinish, contractVariance, type WhatIfOp } from "@/lib/schedules/whatif";
import { calendarFor, type Network } from "@/lib/schedules/engine-core";
import { addW, dayNum, isoOf } from "@/lib/schedules/calendar";
import { fmtDate } from "../shared";
import type { JobSchedule, ScheduleItem, SchedulePhase, ScheduleDependency, SchedulingMode } from "@/lib/schedules/types";

type Cell = { id: string; col: ColumnKey };
type Entry = { label: string; undo: GridOps | null; redo: GridOps | null };
type Slot = { id: string; phaseId: string | null };
type WhatIf = { base: Network; ops: WhatIfOp[] };

// What the sandbox can change, and what Apply sends (outputs like early dates
// and float come back from the server's own recalculation).
const SANDBOX_FIELDS = ["start_date", "end_date", "duration_days", "duration_unit", "kind", "constraint_type", "constraint_date", "is_locked", "actual_start", "actual_finish", "status"] as const;
const INPUT_FIELDS = ["duration_days", "duration_unit", "kind", "constraint_type", "constraint_date", "is_locked", "actual_start", "actual_finish", "status"] as const;
const SHOWN_FIELDS = [...SANDBOX_FIELDS, "early_start", "early_finish", "late_start", "late_finish", "total_float", "free_float", "is_critical"] as const;

const GUTTER_W = 34;
const MAX_HISTORY = 50;
const SELECT_OPTIONS: Partial<Record<ColumnKey, string[]>> = {
  constraint: ["", "SNET", "MFO", "ALAP", "Locked"],
  mtype: ["", "Contract", "Inspection", "Client decision", "Internal"],
  calendar: ["Working days", "Calendar days"],
};

function stored<T>(key: string, fallback: T): T {
  try { const v = window.localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function store(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* private window */ }
}

export function ScheduleGrid({
  schedule, items: allItems, phases, dependencies: realDeps, canEdit, zoom, showBaseline, linkMode,
  onOpenItem, onReload, onBanner, onDatesChange, onLink, mode = "legacy", contractVariances,
}: {
  schedule: JobSchedule;
  items: ScheduleItem[];
  phases: SchedulePhase[];
  dependencies: ScheduleDependency[];
  canEdit: boolean;
  zoom: "day" | "week" | "month";
  showBaseline?: boolean;
  linkMode?: boolean;
  onOpenItem: (item: ScheduleItem) => void;
  /** Reload this schedule; resolves with its fresh items. */
  onReload: () => Promise<ScheduleItem[] | null>;
  onBanner: (message: string) => void;
  onDatesChange?: (id: string, start: string, end: string, gesture: "move" | "resize") => void;
  onLink?: (sourceId: string, targetId: string) => void;
  /** How this schedule's dates are worked out; what-if needs "auto". */
  mode?: SchedulingMode;
  /** Working days past (+) / ahead of (−) contract, by item id (from the server). */
  contractVariances?: Map<string, number | null>;
}) {
  const realItems = React.useMemo(() => allItems.filter((i) => i.schedule_id === schedule.id), [allItems, schedule.id]);
  // ---- what-if sandbox ----
  const [whatIf, setWhatIf] = React.useState<WhatIf | null>(null);
  const [wiLoading, setWiLoading] = React.useState(false);
  const [wiShift, setWiShift] = React.useState("10");
  const wiBase = React.useMemo(() => (whatIf ? applyWhatIf(whatIf.base, schedule.id, []) : null), [whatIf, schedule.id]);
  const wi = React.useMemo(() => (whatIf ? applyWhatIf(whatIf.base, schedule.id, whatIf.ops) : null), [whatIf, schedule.id]);
  const items = React.useMemo(() => {
    if (!wi) return realItems;
    const net = new Map(wi.net.items.map((i) => [i.id, i as unknown as Record<string, unknown>]));
    return realItems.map((it) => {
      const n = net.get(it.id);
      if (!n) return it;
      const over: Record<string, unknown> = {};
      for (const f of SHOWN_FIELDS) if (f in n) over[f] = n[f];
      return { ...it, ...over } as ScheduleItem;
    });
  }, [wi, realItems]);
  const dependencies = React.useMemo<ScheduleDependency[]>(() => (wi
    ? wi.net.deps.map((d, i) => ({ id: `wi-${i}`, job_id: null, source_item_id: d.source_item_id, target_item_id: d.target_item_id, dependency_type: d.dependency_type, lag_days: d.lag_days, is_cross_schedule: false, auto_cascade: true, is_locked: false, notes: null }))
    : realDeps), [wi, realDeps]);
  // Grid | Gantt split (shadcn Resizable). Either side collapses to nothing.
  const gridPanel = React.useRef<ImperativePanelHandle>(null);
  const ganttPanel = React.useRef<ImperativePanelHandle>(null);
  const [hidden, setHidden] = React.useState<"grid" | "gantt" | null>(null);
  const [layout, setLayout] = React.useState<string>(() => stored("cmi.schedgrid.layout", "PM view"));
  const [cols, setCols] = React.useState<ColumnKey[]>(() => stored("cmi.schedgrid.columns", GRID_LAYOUTS["PM view"]));
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState<Cell | null>(null);
  const [anchor, setAnchor] = React.useState<Cell | null>(null);
  const [editing, setEditing] = React.useState<{ cell: Cell; value: string } | null>(null);
  const [pending, setPending] = React.useState<Map<string, string>>(new Map());
  const [errors, setErrors] = React.useState<Map<string, string>>(new Map());
  const [flash, setFlash] = React.useState<Set<string>>(new Set());
  const [past, setPast] = React.useState<Entry[]>([]);
  const [future, setFuture] = React.useState<Entry[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [menu, setMenu] = React.useState<{ x: number; y: number; id: string } | null>(null);
  const [colMenu, setColMenu] = React.useState(false);
  const [histMenu, setHistMenu] = React.useState(false);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);
  // The open edit, readable synchronously so a blur after Enter doesn't save twice.
  const editRef = React.useRef<{ cell: Cell; value: string } | null>(null);
  const setEdit = (v: { cell: Cell; value: string } | null) => { editRef.current = v; setEditing(v); };
  const queue = React.useRef<Promise<unknown>>(Promise.resolve());
  const tempSeq = React.useRef(0);
  const itemsRef = React.useRef(items);
  React.useEffect(() => { itemsRef.current = items; }, [items]);

  // ---- derived ----
  const ctx = React.useMemo<GridCtx>(() => {
    const mine = new Set(items.map((i) => i.id));
    const act = new Map(items.map((i) => [i.id, i.activity_id ?? null]));
    const idByActivity = new Map<number, string>();
    for (const i of items) if (i.activity_id != null) idByActivity.set(i.activity_id, i.id);
    const preds = new Map<string, LinkRef[]>(), succs = new Map<string, LinkRef[]>(), other = new Map<string, number>();
    for (const d of dependencies) {
      if (!mine.has(d.target_item_id) && !mine.has(d.source_item_id)) continue;
      if (mine.has(d.source_item_id) && mine.has(d.target_item_id)) {
        const sa = act.get(d.source_item_id), ta = act.get(d.target_item_id);
        if (sa != null) preds.set(d.target_item_id, [...(preds.get(d.target_item_id) ?? []), { id: sa, type: d.dependency_type, lag: d.lag_days }]);
        if (ta != null) succs.set(d.source_item_id, [...(succs.get(d.source_item_id) ?? []), { id: ta, type: d.dependency_type, lag: d.lag_days }]);
      } else if (mine.has(d.target_item_id)) other.set(d.target_item_id, (other.get(d.target_item_id) ?? 0) + 1);
    }
    return {
      idByActivity, activityById: act,
      predsOf: (id) => preds.get(id) ?? [], succsOf: (id) => succs.get(id) ?? [], otherPredCount: (id) => other.get(id) ?? 0,
      varianceOf: (id) => {
        if (wi) { const it = wi.net.items.find((i) => i.id === id); return it ? contractVariance(wi.net, it) : null; }
        return contractVariances?.get(id);
      },
    };
  }, [items, dependencies, wi, contractVariances]);

  const rows = React.useMemo(() => scheduleRows(items, phases, { collapsed }), [items, phases, collapsed]);
  const itemRows = React.useMemo(() => rows.flatMap((r) => (r.kind === "item" ? [r.item] : [])), [rows]);
  const rowIndex = React.useMemo(() => new Map(itemRows.map((it, i) => [it.id, i])), [itemRows]);
  // Every task in display order with its phase, collapsed or not (for moves and inserts).
  const slots = React.useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    let phase: string | null = null;
    for (const r of scheduleRows(items, phases)) {
      if (r.kind === "group") phase = r.phaseId ?? null;
      else out.push({ id: r.item.id, phaseId: phases.length ? phase : r.item.phase_id });
    }
    return out;
  }, [items, phases]);
  const byId = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const width = GUTTER_W + cols.reduce((w, k) => w + COLUMN[k].width, 0);

  const range = React.useMemo(() => {
    if (!active) return null;
    const a = anchor ?? active;
    const r0 = rowIndex.get(a.id), r1 = rowIndex.get(active.id);
    const c0 = cols.indexOf(a.col), c1 = cols.indexOf(active.col);
    if (r0 == null || r1 == null || c0 < 0 || c1 < 0) return null;
    return { top: Math.min(r0, r1), bottom: Math.max(r0, r1), left: Math.min(c0, c1), right: Math.max(c0, c1) };
  }, [active, anchor, rowIndex, cols]);
  const inRange = (r: number, c: number) => !!range && r >= range.top && r <= range.bottom && c >= range.left && c <= range.right;

  // ---- saving ----
  const sig = (i: ScheduleItem) => ({ start: i.start_date, end: i.end_date, float: i.total_float ?? null });
  function run(ops: GridOps, entry?: Entry): Promise<{ created?: Record<string, string> } | null> {
    if (whatIf) { tryOps(ops); return Promise.resolve(null); }
    if (entry) { setPast((p) => [...p.slice(-(MAX_HISTORY - 1)), entry]); setFuture([]); }
    const next = queue.current.then(async () => {
      const before = new Map(itemsRef.current.map((i) => [i.id, sig(i)]));
      setBusy(true);
      try {
        const res = await fetch(`/api/schedules/${schedule.id}/grid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ops) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) onBanner(d.error ?? "Could not save the grid.");
        else if (d.refused?.length) onBanner(`${d.refused[0].message}${d.refused.length > 1 ? ` (and ${d.refused.length - 1} more)` : ""}`);
        else if (d.moved) onBanner(`${d.moved} task${d.moved === 1 ? "" : "s"} moved.`);
        const fresh = await onReload();
        setPending(new Map());
        if (fresh) {
          const cells = new Set<string>();
          for (const i of fresh) {
            const b = before.get(i.id); if (!b) continue;
            if (b.start !== i.start_date) cells.add(`${i.id}:start`);
            if (b.end !== i.end_date) cells.add(`${i.id}:finish`);
            if (b.float !== (i.total_float ?? null)) cells.add(`${i.id}:float`);
          }
          if (cells.size) { setFlash(cells); window.setTimeout(() => setFlash(new Set()), 1800); }
        }
        return res.ok ? d : null;
      } finally { setBusy(false); }
    });
    queue.current = next.catch(() => null);
    return next;
  }

  /** What-if: apply edits to the sandbox only. */
  function tryOps(ops: WhatIfOp) {
    if (!whatIf) return;
    if (ops.creates?.length || ops.deletes?.length || ops.renumber) {
      onBanner("Adding, deleting or renumbering tasks waits until you Apply or Discard the what-if.");
      return;
    }
    const dropped = new Set<string>();
    const updates = (ops.updates ?? []).map((u) => {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(u.patch)) {
        if ((SANDBOX_FIELDS as readonly string[]).includes(k)) patch[k] = v;
        else if (k !== "sort_order" && k !== "phase_id") dropped.add(k);
      }
      return { id: u.id, patch: patch as Partial<ScheduleItem> };
    }).filter((u) => Object.keys(u.patch).length);
    const step: WhatIfOp = { updates, predecessors: ops.predecessors, shift: ops.shift };
    if (!updates.length && !step.predecessors?.length && !step.shift) {
      if (dropped.size) onBanner("What-if tries dates, durations, constraints and links. Names, notes and IDs change after you leave it.");
      return;
    }
    const nextOps = [...whatIf.ops, step];
    const next = applyWhatIf(whatIf.base, schedule.id, nextOps);
    const before = new Map(items.map((i) => [i.id, sig(i)]));
    const cells = new Set<string>();
    for (const n of next.net.items) {
      const b = before.get(n.id); if (!b) continue;
      if (b.start !== n.start_date) cells.add(`${n.id}:start`);
      if (b.end !== n.end_date) cells.add(`${n.id}:finish`);
      if (b.float !== (n.total_float ?? null)) cells.add(`${n.id}:float`);
    }
    if (cells.size) { setFlash(cells); window.setTimeout(() => setFlash(new Set()), 1800); }
    const newRefusals = next.refused.slice(wi?.refused.length ?? 0);
    if (newRefusals.length) onBanner(newRefusals[0]);
    setPending(new Map());
    setWhatIf({ ...whatIf, ops: nextOps });
  }

  async function startWhatIf() {
    setWiLoading(true);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}/network`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.network) { onBanner(d.error ?? "Couldn't load the schedule for What-if."); return; }
      setWhatIf({ base: d.network as Network, ops: [] });
      setEdit(null); setErrors(new Map());
    } finally { setWiLoading(false); }
  }

  /** Save the sandbox: a "start later" runs the real Shift dates first, then
   *  everything else goes as one normal grid batch (the server recalculates). */
  async function applyWhatIfToSchedule() {
    if (!whatIf || !wi) return;
    const totalShift = whatIf.ops.reduce((n, o) => n + (o.shift ?? 0), 0);
    // Compare against the base with only the shift applied, so Apply sends
    // just what the shift doesn't already do.
    const ref = applyWhatIf(whatIf.base, schedule.id, totalShift ? [{ shift: totalShift }] : []);
    const was = new Map(ref.net.items.map((i) => [i.id, i as unknown as Record<string, unknown>]));
    const updates: { id: string; patch: Partial<ScheduleItem> }[] = [];
    for (const n of wi.net.items) {
      if (n.schedule_id !== schedule.id) continue;
      const b = was.get(n.id); if (!b) continue;
      const now = n as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const f of INPUT_FIELDS) if (now[f] !== b[f]) patch[f] = now[f];
      if (Object.keys(patch).length) {
        // Sending the constraint keeps the server from treating dates as typed.
        patch.constraint_type = n.constraint_type ?? null; patch.constraint_date = n.constraint_date ?? null;
        updates.push({ id: n.id, patch: patch as Partial<ScheduleItem> });
      }
    }
    const mine = new Set(wi.net.items.filter((i) => i.schedule_id === schedule.id).map((i) => i.id));
    const linksOf = (net: Network, id: string) => net.deps.filter((d) => d.target_item_id === id && mine.has(d.source_item_id))
      .map((d) => `${d.source_item_id}|${d.dependency_type}|${d.lag_days}`).sort().join(",");
    const predecessors: PredEdit[] = [...mine].filter((id) => linksOf(wi.net, id) !== linksOf(ref.net, id)).map((id) => ({
      itemId: id,
      links: wi.net.deps.filter((d) => d.target_item_id === id && mine.has(d.source_item_id)).map((d) => ({ sourceItemId: d.source_item_id, type: d.dependency_type, lag: d.lag_days })),
    }));
    setWhatIf(null);
    if (totalShift) {
      const starts = realItems.map((i) => i.start_date).filter(Boolean) as string[];
      const anchor = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
      const sched = whatIf.base.schedules.find((s) => s.id === schedule.id);
      if (anchor && sched) {
        const to = isoOf(addW(calendarFor(whatIf.base, sched), dayNum(anchor), totalShift));
        const res = await fetch(`/api/schedules/${schedule.id}/shift`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: to }) });
        if (!res.ok) { const d = await res.json().catch(() => ({})); onBanner(d.error ?? "Couldn't shift the schedule."); return; }
      }
    }
    if (!updates.length && !predecessors.length) { await onReload(); onBanner(totalShift ? `Schedule moved ${totalShift} working days.` : "Nothing to apply."); return; }
    await run({ updates, predecessors }, { label: `Apply what-if (${updates.length + predecessors.length} change${updates.length + predecessors.length === 1 ? "" : "s"})`, undo: null, redo: null });
  }

  const beforePatch = (item: ScheduleItem, patch: Partial<ScheduleItem>): Partial<ScheduleItem> => {
    const keys = new Set(Object.keys(patch));
    if (keys.has("start_date")) { keys.add("constraint_type"); keys.add("constraint_date"); }
    if (keys.has("end_date")) keys.add("duration_days");
    if (keys.has("kind")) { keys.add("duration_days"); keys.add("end_date"); }
    return Object.fromEntries([...keys].map((k) => [k, (item as Record<string, unknown>)[k] ?? null])) as Partial<ScheduleItem>;
  };
  const currentPreds = (id: string): PredEdit => ({
    itemId: id,
    links: ctx.predsOf(id).flatMap((l) => { const src = ctx.idByActivity.get(l.id); return src ? [{ sourceItemId: src, type: l.type, lag: l.lag }] : []; }),
  });

  /** Apply parsed cell changes for many cells as one undoable step. */
  function applyChanges(changes: { item: ScheduleItem; key: ColumnKey; text: string; change: CellChange }[], label: string) {
    const patches = new Map<string, Partial<ScheduleItem>>();
    const preds: PredEdit[] = [];
    const errs = new Map(errors);
    for (const { item, key, text, change } of changes) {
      const cellKey = `${item.id}:${key}`;
      if (change.error) { errs.set(cellKey, change.error); continue; }
      errs.delete(cellKey);
      if (change.patch) patches.set(item.id, { ...(patches.get(item.id) ?? {}), ...change.patch });
      if (change.preds) preds.push(change.preds);
      setPending((p) => new Map(p).set(cellKey, text));
    }
    setErrors(errs);
    const bad = changes.filter((c) => c.change.error);
    if (bad.length) onBanner(bad.length === 1 ? bad[0].change.error! : `${bad.length} cells couldn't be read. First: ${bad[0].change.error}`);
    if (!patches.size && !preds.length) return;
    const updates = [...patches].map(([id, patch]) => ({ id, patch }));
    const undo: GridOps = {
      updates: updates.map((u) => ({ id: u.id, patch: beforePatch(byId.get(u.id)!, u.patch) })),
      predecessors: preds.map((p) => currentPreds(p.itemId)),
    };
    const ops: GridOps = { updates, predecessors: preds };
    // A new activity ID parks the row where that number sorts (Spec R2 §4.3).
    const idEdit = changes.length === 1 && changes[0].key === "id" && changes[0].change.patch?.activity_id != null ? changes[0] : null;
    if (idEdit) {
      const n = idEdit.change.patch!.activity_id!;
      const rest = slots.filter((s) => s.id !== idEdit.item.id);
      let at = rest.findIndex((s) => (byId.get(s.id)?.activity_id ?? Infinity) > n);
      if (at < 0) at = rest.length;
      const phaseId = (rest[at - 1] ?? rest[at])?.phaseId ?? idEdit.item.phase_id ?? null;
      const order = [...rest.slice(0, at), { id: idEdit.item.id, phaseId }, ...rest.slice(at)];
      ops.updates = mergeUpdates(ops.updates!, orderUpdates(order));
      undo.updates = mergeUpdates(undo.updates!, restoreOrder());
    }
    void run(ops, { label, undo, redo: ops });
  }

  /** sort_order / phase_id updates that put rows in `order` (rows not yet saved are skipped). */
  function orderUpdates(order: Slot[]): { id: string; patch: Partial<ScheduleItem> }[] {
    return order.flatMap((s, i) => {
      const it = byId.get(s.id);
      if (!it) return [];
      const patch: Partial<ScheduleItem> = {};
      if (it.sort_order !== i) patch.sort_order = i;
      if ((it.phase_id ?? null) !== (s.phaseId ?? null)) patch.phase_id = s.phaseId;
      return Object.keys(patch).length ? [{ id: s.id, patch }] : [];
    });
  }
  /** Updates that put every row back where it is now (for undo). */
  function restoreOrder(): { id: string; patch: Partial<ScheduleItem> }[] {
    return items.map((it) => ({ id: it.id, patch: { sort_order: it.sort_order, phase_id: it.phase_id } }));
  }

  function commitCell(cell: Cell, text: string) {
    const item = byId.get(cell.id);
    if (!item || !canEdit || !COLUMN[cell.col].editable) return;
    if (text === cellText(item, cell.col, ctx)) { setErrors((e) => { const n = new Map(e); n.delete(`${cell.id}:${cell.col}`); return n; }); return; }
    applyChanges([{ item, key: cell.col, text, change: parseCell(item, cell.col, text, ctx) }], `${COLUMN[cell.col].label}: ${item.title}`);
  }

  // ---- selection + keys ----
  function move(dr: number, dc: number, extend = false) {
    if (!active) { if (itemRows[0]) setActive({ id: itemRows[0].id, col: cols[0] }); return; }
    const r = Math.min(itemRows.length - 1, Math.max(0, (rowIndex.get(active.id) ?? 0) + dr));
    const c = Math.min(cols.length - 1, Math.max(0, cols.indexOf(active.col) + dc));
    const next = { id: itemRows[r].id, col: cols[c] };
    if (extend) { if (!anchor) setAnchor(active); } else setAnchor(null);
    setActive(next);
    document.getElementById(`cell-${next.id}-${next.col}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function startEdit(value?: string) {
    if (!active || !canEdit || !COLUMN[active.col].editable) return;
    const item = byId.get(active.id); if (!item) return;
    setEdit({ cell: active, value: value ?? pending.get(`${active.id}:${active.col}`) ?? cellText(item, active.col, ctx) });
  }
  function finishEdit(commit: boolean, then?: [number, number]) {
    const ed = editRef.current;
    if (!ed) return;
    setEdit(null);
    if (commit) commitCell(ed.cell, ed.value);
    if (then) move(then[0], then[1]);
    gridRef.current?.focus();
  }

  function rangeCells(): { item: ScheduleItem; key: ColumnKey }[] {
    if (!range) return [];
    const out: { item: ScheduleItem; key: ColumnKey }[] = [];
    for (let r = range.top; r <= range.bottom; r++) for (let c = range.left; c <= range.right; c++) out.push({ item: itemRows[r], key: cols[c] });
    return out;
  }
  function fillDown() {
    if (!range || range.top === range.bottom) { onBanner("Select a range of rows first (Shift+↓), then Ctrl+D copies the top cell down."); return; }
    const changes = [];
    for (let c = range.left; c <= range.right; c++) {
      const key = cols[c];
      if (!COLUMN[key].editable || key === "id") continue;
      const text = cellText(itemRows[range.top], key, ctx);
      for (let r = range.top + 1; r <= range.bottom; r++) changes.push({ item: itemRows[r], key, text, change: parseCell(itemRows[r], key, text, ctx) });
    }
    applyChanges(changes, `Fill down ${range.bottom - range.top} row${range.bottom - range.top === 1 ? "" : "s"}`);
  }
  function clearRange() {
    const clearable: ColumnKey[] = ["notes", "cost_code", "constraint", "cdate", "preds", "duration"];
    const changes = rangeCells().filter((c) => clearable.includes(c.key)).map((c) => ({ ...c, text: "", change: parseCell(c.item, c.key, "", ctx) }));
    if (changes.length) applyChanges(changes, "Clear cells");
  }
  function copy() {
    if (!range) return;
    const lines = [];
    for (let r = range.top; r <= range.bottom; r++) {
      const cells = [];
      for (let c = range.left; c <= range.right; c++) cells.push(cellText(itemRows[r], cols[c], ctx));
      lines.push(cells.join("\t"));
    }
    void navigator.clipboard?.writeText(lines.join("\n"));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (editRef.current) return; // the cell's own input handles keys while editing
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    // Moving around and copying work for everyone.
    if (mod && k.toLowerCase() === "c") { copy(); return; }
    if (k === "ArrowUp" && !e.altKey) { e.preventDefault(); move(-1, 0, e.shiftKey); return; }
    if (k === "ArrowDown" && !e.altKey) { e.preventDefault(); move(1, 0, e.shiftKey); return; }
    if (k === "ArrowLeft") { e.preventDefault(); move(0, -1, e.shiftKey); return; }
    if (k === "ArrowRight") { e.preventDefault(); move(0, 1, e.shiftKey); return; }
    if (k === "Tab") { e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return; }
    if (k === "Enter") { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); return; }
    if (k === "Escape") { setAnchor(null); return; }
    if (!canEdit) return;
    if (mod && k.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (mod && k.toLowerCase() === "d") { e.preventDefault(); fillDown(); return; }
    if (e.altKey && e.shiftKey && (k === "ArrowUp" || k === "ArrowDown")) { e.preventDefault(); if (active) moveRow(active.id, k === "ArrowUp" ? -1 : 1); return; }
    if (k === "F2") { e.preventDefault(); startEdit(); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); clearRange(); return; }
    if (k.length === 1 && !mod && !e.altKey) { e.preventDefault(); startEdit(k); }
  }

  // ---- paste ----
  function onPaste(e: React.ClipboardEvent) {
    if (editRef.current || !canEdit) return;
    e.preventDefault();
    paste(e.clipboardData.getData("text/plain"));
  }
  /** Paste rows. Without a header they overwrite from the selected cell down
   *  (like Excel). With a header that has an ID column, rows match by ID:
   *  known IDs update, new IDs become new tasks. `below` pastes them all as new
   *  tasks under that row. */
  function paste(text: string, below?: string) {
    let data = parseClipboard(text).filter((r) => r.some((c) => c.trim()));
    if (!data.length) return;
    const notes: string[] = [];
    let colsFor: (ColumnKey | null)[];
    const hm = headerMap(data[0]);
    if (hm) {
      colsFor = hm.columns; data = data.slice(1);
      if (hm.unknown.length) notes.push(`Ignored column${hm.unknown.length === 1 ? "" : "s"}: ${hm.unknown.join(", ")}.`);
    } else {
      const start = active ? cols.indexOf(active.col) : 0;
      colsFor = data[0].map((_, j) => cols[start + j] ?? null);
    }
    const r0 = active ? rowIndex.get(active.id) ?? itemRows.length : itemRows.length;
    const idCol = colsFor.indexOf("id");
    const byActivity = (cells: string[]) => {
      const v = idCol >= 0 ? cells[idCol]?.trim() : "";
      return v && /^\d+$/.test(v) ? byId.get(ctx.idByActivity.get(Number(v)) ?? "") ?? null : null;
    };
    const targets: (ScheduleItem | null)[] = data.map((cells, k) =>
      below ? null : hm && idCol >= 0 ? byActivity(cells) : itemRows[r0 + k] ?? null);
    // New rows first get their IDs, so pasted predecessors can point at each other.
    const ctx2: GridCtx = { ...ctx, idByActivity: new Map(ctx.idByActivity), activityById: new Map(ctx.activityById) };
    const anchorId = below ?? active?.id ?? null;
    const phaseId = anchorId ? slots.find((s) => s.id === anchorId)?.phaseId ?? null : null;
    const fresh: { tempId: string; stub: ScheduleItem; cells: string[] }[] = [];
    const used = new Set(ctx.idByActivity.keys());
    data.forEach((cells, k) => {
      if (targets[k]) return;
      const tempId = `new-${++tempSeq.current}`;
      const n = idCol >= 0 && /^\d+$/.test(cells[idCol]?.trim() ?? "") ? Number(cells[idCol].trim()) : null;
      const id = n != null && !used.has(n) ? n : null;
      if (id != null) { used.add(id); ctx2.idByActivity.set(id, tempId); }
      ctx2.activityById.set(tempId, id);
      const stub = { id: tempId, schedule_id: schedule.id, kind: "task", title: "", status: "not_started", start_date: null, end_date: null, duration_days: null, activity_id: id, assignees: [] } as unknown as ScheduleItem;
      fresh.push({ tempId, stub, cells });
    });
    const changes: { item: ScheduleItem; key: ColumnKey; text: string; change: CellChange }[] = [];
    data.forEach((cells, k) => {
      const target = targets[k];
      if (!target) return;
      cells.forEach((text, j) => {
        const key = colsFor[j];
        if (!key || !COLUMN[key].editable) return;
        if (text.trim() === cellText(target, key, ctx)) return;
        changes.push({ item: target, key, text, change: parseCell(target, key, text, ctx2) });
      });
    });
    const creates: NonNullable<GridOps["creates"]> = [];
    const createPreds: PredEdit[] = [];
    const errs: string[] = [];
    // New rows go under `below`, or at the end.
    const at = below ? slots.findIndex((s) => s.id === below) + 1 : slots.length;
    const order = [...slots.slice(0, at), ...fresh.map((f) => ({ id: f.tempId, phaseId })), ...slots.slice(at)];
    fresh.forEach(({ tempId, stub, cells }, k) => {
      const row: Partial<ScheduleItem> = { kind: "task", phase_id: phaseId, sort_order: at + k, activity_id: stub.activity_id };
      cells.forEach((text, j) => {
        const key = colsFor[j];
        if (!key || key === "id" || !COLUMN[key].editable || !text.trim()) return;
        const ch = parseCell({ ...stub, ...row } as ScheduleItem, key, text, ctx2);
        if (ch.error) errs.push(`New row ${k + 1}: ${ch.error}`);
        if (ch.patch) Object.assign(row, ch.patch);
        if (ch.preds) createPreds.push(ch.preds);
      });
      if (!row.title) row.title = "New Task";
      if (row.start_date && !row.end_date) row.end_date = row.start_date;
      creates.push({ tempId, row });
    });
    if (errs.length) notes.push(`${errs.length} new-row cell${errs.length === 1 ? "" : "s"} skipped: ${errs[0]}`);
    if (notes.length) onBanner(notes.join(" "));
    if (!changes.length && !creates.length) return;
    // Existing rows go through the normal cell path (one undo step), new rows after.
    if (changes.length && !creates.length) { applyChanges(changes, `Paste ${data.length} row${data.length === 1 ? "" : "s"}`); return; }
    const patches = new Map<string, Partial<ScheduleItem>>();
    const preds: PredEdit[] = [...createPreds];
    for (const c of changes) {
      if (c.change.patch) patches.set(c.item.id, { ...(patches.get(c.item.id) ?? {}), ...c.change.patch });
      if (c.change.preds) preds.push(c.change.preds);
    }
    const updates = [...patches].map(([id, patch]) => ({ id, patch }));
    const ops: GridOps = { updates: below ? mergeUpdates(updates, orderUpdates(order)) : updates, creates, predecessors: preds };
    const entry: Entry = {
      label: `Paste ${data.length} row${data.length === 1 ? "" : "s"} (${creates.length} new)`,
      undo: {
        updates: mergeUpdates(updates.map((u) => ({ id: u.id, patch: beforePatch(byId.get(u.id)!, u.patch) })), below ? restoreOrder() : []),
        predecessors: preds.filter((p) => byId.has(p.itemId)).map((p) => currentPreds(p.itemId)),
      },
      redo: null,
    };
    void run(ops, entry).then((d) => { if (d?.created) entry.undo!.deletes = Object.values(d.created); });
  }

  // ---- rows ----
  function insertRow(id: string, where: "above" | "below", copyOf?: ScheduleItem) {
    const at = slots.findIndex((s) => s.id === id);
    if (at < 0) return;
    const pos = where === "above" ? at : at + 1;
    const prev = slots[pos - 1] ? byId.get(slots[pos - 1].id) : null;
    const next = slots[pos] ? byId.get(slots[pos].id) : null;
    const newId = idBetween(prev?.activity_id ?? null, next?.activity_id ?? null, new Set(ctx.idByActivity.keys()));
    if (newId == null) onBanner(`No activity ID free between ${prev?.activity_id} and ${next?.activity_id}; it goes at the end of the numbering. Renumber by tens to tidy up.`);
    const tempId = `new-${++tempSeq.current}`;
    const phaseId = slots[at].phaseId;
    const order = [...slots.slice(0, pos), { id: tempId, phaseId }, ...slots.slice(pos)];
    const ref = byId.get(id)!;
    const row: Partial<ScheduleItem> = copyOf
      ? { title: `${copyOf.title} (copy)`, kind: copyOf.kind, start_date: copyOf.start_date, end_date: copyOf.end_date, duration_days: copyOf.duration_days, duration_unit: copyOf.duration_unit, internal_notes: copyOf.internal_notes, cost_code: copyOf.cost_code }
      : { title: "New Task", kind: "task", start_date: ref.start_date, end_date: ref.start_date, duration_days: 1 };
    const ops: GridOps = {
      creates: [{ tempId, row: { ...row, phase_id: phaseId, sort_order: pos, activity_id: newId ?? undefined } }],
      updates: orderUpdates(order),
    };
    const entry: Entry = { label: copyOf ? `Duplicate ${copyOf.title}` : "Insert task", undo: { updates: restoreOrder() }, redo: null };
    void run(ops, entry).then((d) => {
      const made = d?.created?.[tempId];
      if (!made) return;
      entry.undo!.deletes = [made];
      setActive({ id: made, col: "name" }); setAnchor(null);
      setEdit({ cell: { id: made, col: "name" }, value: copyOf ? `${copyOf.title} (copy)` : "" });
    });
  }
  function moveRow(id: string, dir: -1 | 1) {
    const at = slots.findIndex((s) => s.id === id);
    const to = at + dir;
    if (at < 0 || to < 0 || to >= slots.length) return;
    const order = slots.slice();
    const [moved] = order.splice(at, 1);
    order.splice(to, 0, { id: moved.id, phaseId: slots[to].phaseId });
    void run({ updates: orderUpdates(order) }, { label: `Move ${byId.get(id)?.title}`, undo: { updates: restoreOrder() }, redo: { updates: orderUpdates(order) } });
  }
  function dropOn(targetId: string | null, phaseId: string | null) {
    const src = dragId; setDragId(null);
    if (!src || src === targetId) return;
    const order = slots.filter((s) => s.id !== src);
    let at = targetId ? order.findIndex((s) => s.id === targetId) : order.findIndex((s) => s.phaseId === phaseId);
    if (at < 0) at = order.length;
    order.splice(at, 0, { id: src, phaseId: targetId ? slots.find((s) => s.id === targetId)?.phaseId ?? null : phaseId });
    void run({ updates: orderUpdates(order) }, { label: `Move ${byId.get(src)?.title}`, undo: { updates: restoreOrder() }, redo: { updates: orderUpdates(order) } });
  }
  function deleteRows(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length === 1 ? `"${byId.get(ids[0])?.title}"` : `${ids.length} tasks`} and their links? This can't be undone.`)) return;
    void run({ deletes: ids }, { label: `Delete ${ids.length} task${ids.length === 1 ? "" : "s"}`, undo: null, redo: null });
    setActive(null); setAnchor(null);
  }
  function renumber() {
    if (!window.confirm("Renumber every activity ID by tens in the order shown (10, 20, 30…)? Predecessors follow automatically.")) return;
    void run({ renumber: true }, { label: "Renumber by tens", undo: null, redo: null });
  }

  // ---- history ----
  function undo() {
    if (whatIf) { if (whatIf.ops.length) setWhatIf({ ...whatIf, ops: whatIf.ops.slice(0, -1) }); return; }
    const e = past[past.length - 1];
    if (!e) return;
    if (!e.undo) { onBanner(`"${e.label}" can't be undone.`); return; }
    setPast((p) => p.slice(0, -1)); setFuture((f) => [...f, e]);
    void run(e.undo);
  }
  function redo() {
    if (whatIf) return;
    const e = future[future.length - 1];
    if (!e) return;
    if (!e.redo) { onBanner(`"${e.label}" can't be redone.`); return; }
    setFuture((f) => f.slice(0, -1)); setPast((p) => [...p, e]);
    void run(e.redo);
  }

  // ---- layout ----
  const showPanes = (which: "both" | "grid" | "gantt") => {
    if (which === "grid") { gridPanel.current?.expand(); ganttPanel.current?.collapse(); }
    else if (which === "gantt") { ganttPanel.current?.expand(); gridPanel.current?.collapse(); }
    else { gridPanel.current?.expand(); ganttPanel.current?.expand(); }
  };
  const chooseLayout = (name: string) => { setLayout(name); store("cmi.schedgrid.layout", name); if (GRID_LAYOUTS[name]) { setCols(GRID_LAYOUTS[name]); store("cmi.schedgrid.columns", GRID_LAYOUTS[name]); } };
  const toggleCol = (k: ColumnKey) => {
    const next = cols.includes(k) ? cols.filter((c) => c !== k) : GRID_COLUMNS.map((c) => c.key).filter((c) => c === k || cols.includes(c));
    if (!next.length) return;
    setCols(next); setLayout("Custom"); store("cmi.schedgrid.columns", next); store("cmi.schedgrid.layout", "Custom");
  };
  const togglePhase = (key: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const menuItem = menu ? byId.get(menu.id) : null;
  const selectedIds = range ? itemRows.slice(range.top, range.bottom + 1).map((i) => i.id) : active ? [active.id] : [];

  return (
    <div className="space-y-2">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          {([["both", "Grid + Gantt", !hidden], ["grid", "Grid", hidden === "gantt"], ["gantt", "Gantt", hidden === "grid"]] as const).map(([k, label, on]) => (
            <button key={k} type="button" onClick={() => showPanes(k)} className={cn("rounded px-2 py-1 text-xs font-medium", on ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}>{label}</button>
          ))}
        </div>
        <div className="relative">
          <Button size="sm" variant="ghost" onClick={() => setColMenu((o) => !o)}><Columns3 className="h-3.5 w-3.5" /> {layout}</Button>
          {colMenu ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setColMenu(false)} />
              <div className="absolute left-0 z-50 mt-1 w-56 rounded-lg border border-border bg-card p-1 shadow-lg">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Layouts</div>
                {Object.keys(GRID_LAYOUTS).map((n) => <button key={n} type="button" onClick={() => chooseLayout(n)} className={cn("block w-full rounded px-2 py-1 text-left text-sm hover:bg-muted/50", layout === n && "text-accent")}>{n}</button>)}
                <div className="mt-1 border-t border-border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Columns</div>
                {GRID_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                    <input type="checkbox" checked={cols.includes(c.key)} onChange={() => toggleCol(c.key)} className="h-3.5 w-3.5 accent-[var(--accent)]" />{c.label}
                  </label>
                ))}
              </div>
            </>
          ) : null}
        </div>
        {canEdit ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => { const last = active?.id ?? slots[slots.length - 1]?.id; if (last) insertRow(last, "below"); }} disabled={!slots.length}><Plus className="h-3.5 w-3.5" /> Task</Button>
            <Tooltip label="Renumber activity IDs 10, 20, 30… in the order shown" side="bottom" className="inline-block"><Button size="sm" variant="ghost" onClick={renumber}><ListOrdered className="h-3.5 w-3.5" /> Renumber by tens</Button></Tooltip>
            <Tooltip label="Undo (Ctrl+Z)" side="bottom" className="inline-block"><Button size="sm" variant="ghost" onClick={undo} disabled={!past.length} aria-label="Undo"><Undo2 className="h-3.5 w-3.5" /></Button></Tooltip>
            <Tooltip label="Redo (Ctrl+Y)" side="bottom" className="inline-block"><Button size="sm" variant="ghost" onClick={redo} disabled={!future.length} aria-label="Redo"><Redo2 className="h-3.5 w-3.5" /></Button></Tooltip>
            <div className="relative">
              <Tooltip label="Recent changes" side="bottom" className="inline-block"><Button size="sm" variant="ghost" onClick={() => setHistMenu((o) => !o)} disabled={!past.length} aria-label="Recent changes"><History className="h-3.5 w-3.5" /> {past.length || ""}</Button></Tooltip>
              {histMenu ? (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHistMenu(false)} />
                  <div className="absolute left-0 z-50 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Last {past.length} changes (newest first)</div>
                    {past.slice().reverse().map((e, i) => <div key={i} className="truncate px-2 py-1 text-xs">{e.label}{e.undo ? "" : <span className="text-muted-foreground"> · can&apos;t undo</span>}</div>)}
                  </div>
                </>
              ) : null}
            </div>
          </>
        ) : null}
        {canEdit && mode === "auto" && !whatIf ? (
          <Tooltip label="Try changes without saving them" side="bottom" className="inline-block"><Button size="sm" variant="ghost" onClick={() => void startWhatIf()} disabled={wiLoading}><FlaskConical className="h-3.5 w-3.5" /> {wiLoading ? "Loading…" : "What-if"}</Button></Tooltip>
        ) : null}
        {busy ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span> : null}
        {errors.size ? <span className="text-xs text-destructive">{errors.size} cell{errors.size === 1 ? "" : "s"} need fixing</span> : null}
        <div className="flex-1" />
        <span className="hidden text-[11px] text-muted-foreground xl:inline">Type to edit · Enter / Tab move · Ctrl+D fill down · Ctrl+Z undo · paste from Excel · Alt+Shift+↑↓ move rows · right-click for more · double-click opens the task</span>
      </div>

      {whatIf && wi && wiBase ? (() => {
        const before = scheduleFinish(wiBase.net, schedule.id).finish;
        const now = scheduleFinish(wi.net, schedule.id, before);
        const realById = new Map(realItems.map((i) => [i.id, i]));
        const moved = wi.net.items.filter((n) => n.schedule_id === schedule.id && (realById.get(n.id)?.start_date !== n.start_date || realById.get(n.id)?.end_date !== n.end_date)).length;
        return (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-700 dark:bg-amber-950/40">
            <FlaskConical className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <span className="font-medium">What-if</span>
            <span className="text-muted-foreground">nothing is saved until you Apply.</span>
            <span>Finish <strong>{fmtDate(before)}</strong> → <strong>{fmtDate(now.finish)}</strong>{now.delta ? <span className={now.delta > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}> ({now.delta > 0 ? "+" : ""}{now.delta} wd)</span> : null}</span>
            <span className="text-muted-foreground">· {moved} task{moved === 1 ? "" : "s"} differ · {whatIf.ops.length} step{whatIf.ops.length === 1 ? "" : "s"}</span>
            <span className="flex items-center gap-1 text-xs">Start
              <Input type="number" value={wiShift} onChange={(e) => setWiShift(e.target.value)} className="h-7 w-16 px-1.5 text-right" aria-label="Working days later" />
              working days later
              <Button size="sm" variant="outline" onClick={() => { const n = Math.round(Number(wiShift)); if (n) tryOps({ shift: n }); }}>Try</Button>
            </span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={undo} disabled={!whatIf.ops.length}><Undo2 className="h-3.5 w-3.5" /> Step back</Button>
            <Button size="sm" variant="outline" onClick={() => setWhatIf(null)}>Discard</Button>
            <Button size="sm" variant="accent" onClick={() => void applyWhatIfToSchedule()} disabled={!whatIf.ops.length}>Apply</Button>
          </div>
        );
      })() : null}

      {/* Height follows the rows so the page scrolls grid and Gantt together. */}
      <ResizablePanelGroup direction="horizontal" autoSaveId="cmi.schedgrid.panels" style={{ height: "auto", overflow: "visible" }} className="items-stretch">
        <ResizablePanel ref={gridPanel} id="grid" order={1} defaultSize={58} minSize={20} collapsible collapsedSize={0}
          onCollapse={() => setHidden("grid")} onExpand={() => setHidden((h) => (h === "grid" ? null : h))} className="pr-1.5">
        {/* grid */}
        <div
          ref={gridRef} tabIndex={0} onKeyDown={onKeyDown} onPaste={onPaste}
          className="w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-card outline-none focus-visible:ring-1 focus-visible:ring-accent/40"
        >
          <div style={{ width }}>
            <div className="flex border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground" style={{ height: HEAD_H }}>
              <div className="shrink-0 border-r border-border/60" style={{ width: GUTTER_W }} />
              {cols.map((k) => <div key={k} className={cn("flex shrink-0 items-end border-r border-border/60 px-1.5 pb-1.5", COLUMN[k].align === "right" && "justify-end")} style={{ width: COLUMN[k].width }}>{COLUMN[k].label}</div>)}
            </div>
            {rows.map((r) => r.kind === "group" ? (
              <div key={r.key} className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ height: ROW_H }}
                onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={() => dropOn(null, r.phaseId ?? null)}>
                {r.phaseId !== undefined ? (
                  <button type="button" onClick={() => togglePhase(r.phaseId ?? "none")} className="text-muted-foreground hover:text-foreground">{collapsed.has(r.phaseId ?? "none") ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</button>
                ) : null}
                {r.color ? <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} /> : null}
                <span className="truncate">{r.label}</span>
              </div>
            ) : (
              <GridRowView
                key={r.item.id} item={r.item} cols={cols} ctx={ctx} canEdit={canEdit}
                rowIdx={rowIndex.get(r.item.id) ?? -1} active={active} inRange={inRange} editing={editing} pending={pending} errors={errors} flash={flash}
                dragging={dragId === r.item.id}
                onCellDown={(cell, shift) => { finishEdit(true); if (shift && active) { if (!anchor) setAnchor(active); } else setAnchor(null); setActive(cell); gridRef.current?.focus(); }}
                onOpen={() => onOpenItem(r.item)}
                onMenu={(x, y) => {
                  // Right-click inside the selection keeps it (delete several rows); outside it starts over on this row.
                  const idx = rowIndex.get(r.item.id) ?? -1;
                  if (!range || idx < range.top || idx > range.bottom) { setAnchor(null); setActive({ id: r.item.id, col: cols[0] }); }
                  setMenu({ x, y, id: r.item.id });
                }}
                onEditChange={(value) => { if (editRef.current) setEdit({ ...editRef.current, value }); }}
                onEditKey={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); finishEdit(true, [e.shiftKey ? -1 : 1, 0]); }
                  else if (e.key === "Tab") { e.preventDefault(); finishEdit(true, [0, e.shiftKey ? -1 : 1]); }
                  else if (e.key === "Escape") { e.preventDefault(); finishEdit(false); }
                }}
                onEditCommit={(value) => { const ed = editRef.current; if (!ed) return; setEdit(null); commitCell(ed.cell, value ?? ed.value); gridRef.current?.focus(); }}
                onDragStart={() => setDragId(r.item.id)} onDragEnd={() => setDragId(null)} onDrop={() => dropOn(r.item.id, null)}
              />
            ))}
            {!items.length ? <div className="p-6 text-center text-sm text-muted-foreground">No tasks yet. Use + Item above, or paste rows from Excel here.</div> : null}
          </div>
        </div>

        </ResizablePanel>

        <ResizableHandle withHandle className="mx-0.5">
          {/* Collapse / reopen either side; stays in view while the rows scroll. */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-5 -translate-x-1/2">
          <div className="pointer-events-auto sticky top-16 mt-14 flex flex-col gap-1">
            <Tooltip label={hidden === "gantt" ? "Show the Gantt" : "Hide the grid"} side="right">
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => showPanes(hidden === "gantt" ? "both" : "gantt")}
                className="flex h-5 w-5 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-xs hover:text-foreground" aria-label={hidden === "gantt" ? "Show the Gantt" : "Hide the grid"}>
                <ChevronLeft className="h-3 w-3" />
              </button>
            </Tooltip>
            <Tooltip label={hidden === "grid" ? "Show the grid" : "Hide the Gantt"} side="right">
              <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={() => showPanes(hidden === "grid" ? "both" : "grid")}
                className="flex h-5 w-5 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-xs hover:text-foreground" aria-label={hidden === "grid" ? "Show the grid" : "Hide the Gantt"}>
                <ChevronRight className="h-3 w-3" />
              </button>
            </Tooltip>
          </div>
          </div>
        </ResizableHandle>

        <ResizablePanel ref={ganttPanel} id="gantt" order={2} defaultSize={42} minSize={20} collapsible collapsedSize={0}
          onCollapse={() => setHidden("gantt")} onExpand={() => setHidden((h) => (h === "gantt" ? null : h))} className="pl-1.5">
          <GanttView items={items} dependencies={dependencies} phases={phases} zoom={zoom} showBaseline={showBaseline} canEdit={canEdit} linkMode={linkMode}
            onOpenItem={onOpenItem} onLink={whatIf ? undefined : onLink}
            onDatesChange={whatIf ? (id, start, end, gesture) => tryOps({ updates: [{ id, patch: gesture === "move" ? { start_date: start } : { end_date: end } }] }) : onDatesChange}
            hideLabels={hidden !== "grid"} collapsed={collapsed} selectedId={active?.id ?? null} flashIds={new Set([...flash].map((c) => c.split(":")[0]))} />
        </ResizablePanel>
      </ResizablePanelGroup>

      {menu && menuItem ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <div className="fixed z-50 w-48 rounded-lg border border-border bg-card p-1 text-sm shadow-lg" style={{ left: menu.x, top: menu.y }}>
            <MenuButton onClick={() => { setMenu(null); onOpenItem(menuItem); }}><Maximize2 className="h-3.5 w-3.5" /> Open details</MenuButton>
            {canEdit ? (
              <>
                <MenuButton onClick={() => { setMenu(null); insertRow(menuItem.id, "above"); }}>Insert task above</MenuButton>
                <MenuButton onClick={() => { setMenu(null); insertRow(menuItem.id, "below"); }}>Insert task below</MenuButton>
                <MenuButton onClick={() => { setMenu(null); insertRow(menuItem.id, "below", menuItem); }}>Duplicate</MenuButton>
                <MenuButton onClick={() => {
                  setMenu(null);
                  const id = menuItem.id;
                  navigator.clipboard?.readText().then((text) => paste(text, id)).catch(() => onBanner("The browser didn't allow reading the clipboard. Select the row and press Ctrl+V instead."));
                }}>Paste as new tasks below</MenuButton>
                <MenuButton onClick={() => { setMenu(null); moveRow(menuItem.id, -1); }}>Move up</MenuButton>
                <MenuButton onClick={() => { setMenu(null); moveRow(menuItem.id, 1); }}>Move down</MenuButton>
                <MenuButton danger onClick={() => { setMenu(null); deleteRows(selectedIds.includes(menuItem.id) ? selectedIds : [menuItem.id]); }}>Delete{selectedIds.length > 1 && selectedIds.includes(menuItem.id) ? ` ${selectedIds.length} tasks` : ""}</MenuButton>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

function mergeUpdates(a: { id: string; patch: Partial<ScheduleItem> }[], b: { id: string; patch: Partial<ScheduleItem> }[]) {
  const m = new Map(a.map((u) => [u.id, { ...u.patch }]));
  for (const u of b) m.set(u.id, { ...(m.get(u.id) ?? {}), ...u.patch });
  return [...m].map(([id, patch]) => ({ id, patch }));
}

function MenuButton({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50", danger && "text-destructive")}>{children}</button>;
}

const GridRowView = React.memo(function GridRowView({
  item, cols, ctx, canEdit, rowIdx, active, inRange, editing, pending, errors, flash, dragging,
  onCellDown, onOpen, onMenu, onEditChange, onEditKey, onEditCommit, onDragStart, onDragEnd, onDrop,
}: {
  item: ScheduleItem; cols: ColumnKey[]; ctx: GridCtx; canEdit: boolean; rowIdx: number;
  active: Cell | null; inRange: (r: number, c: number) => boolean;
  editing: { cell: Cell; value: string } | null; pending: Map<string, string>; errors: Map<string, string>; flash: Set<string>; dragging: boolean;
  onCellDown: (cell: Cell, shift: boolean) => void; onOpen: () => void; onMenu: (x: number, y: number) => void;
  onEditChange: (v: string) => void; onEditKey: (e: React.KeyboardEvent) => void; onEditCommit: (value?: string) => void;
  onDragStart: () => void; onDragEnd: () => void; onDrop: () => void;
}) {
  const critical = item.total_float != null && item.total_float <= 0 && item.status !== "complete";
  const near = item.total_float != null && item.total_float > 0 && item.total_float <= 3;
  return (
    <div className={cn("flex border-b border-border/60 text-sm", dragging && "opacity-40")} style={{ height: ROW_H }}
      onDoubleClick={onOpen} onContextMenu={(e) => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
      onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <div className="flex shrink-0 items-center justify-center border-r border-border/60 text-muted-foreground" style={{ width: GUTTER_W }}>
        {canEdit ? <Tooltip label="Drag to reorder" side="right"><span draggable onDragStart={onDragStart} onDragEnd={onDragEnd} className="cursor-grab" aria-label="Drag to reorder"><GripVertical className="h-3.5 w-3.5" /></span></Tooltip> : null}
      </div>
      {cols.map((k, c) => {
        const key = `${item.id}:${k}`;
        const isActive = active?.id === item.id && active.col === k;
        const isEditing = editing?.cell.id === item.id && editing.cell.col === k;
        const err = errors.get(key);
        let text = pending.get(key) ?? cellText(item, k, ctx);
        if (k === "preds" && ctx.otherPredCount(item.id)) text = `${text}${text ? " " : ""}(+${ctx.otherPredCount(item.id)} other)`;
        const tip = err ?? (k === "start" && item.constraint_type === "snet" ? `Start No Earlier Than ${item.constraint_date}` : null);
        const cell = (
          <div key={k} id={`cell-${item.id}-${k}`}
            onMouseDown={(e) => { if (e.button === 0 && !isEditing) onCellDown({ id: item.id, col: k }, e.shiftKey); }}
            className={cn(
              "relative shrink-0 truncate border-r border-border/60 px-1.5 leading-[33px] transition-colors duration-700",
              COLUMN[k].align === "right" && "text-right tabular-nums",
              !COLUMN[k].editable && "bg-muted/20 text-muted-foreground",
              inRange(rowIdx, c) && "bg-accent/10",
              isActive && "outline outline-2 -outline-offset-2 outline-accent",
              err && "bg-destructive/10 text-destructive",
              flash.has(key) && "bg-amber-200/70",
              k === "float" && critical && "font-semibold text-foreground",
              k === "float" && near && "text-amber-700 dark:text-amber-400",
              k === "name" && item.status === "complete" && "text-muted-foreground line-through",
            )}
            style={{ width: COLUMN[k].width }}
          >
            {isEditing ? (
              SELECT_OPTIONS[k] ? (
                <CellOptions options={SELECT_OPTIONS[k]!} value={editing!.value} onPick={(v) => onEditCommit(v)} onCancel={() => onEditKey({ key: "Escape", preventDefault() {} } as React.KeyboardEvent)} />
              ) : (
                <input autoFocus value={editing!.value} onChange={(e) => onEditChange(e.target.value)} onKeyDown={onEditKey} onBlur={() => onEditCommit()}
                  className={cn("absolute inset-0 h-full w-full border-0 bg-background px-1.5 text-sm outline-none ring-2 ring-accent", COLUMN[k].align === "right" && "text-right")} />
              )
            ) : (
              <>
                {k === "name" && item.kind === "milestone" ? <span className="mr-1 text-accent">◆</span> : null}
                {k === "start" && item.constraint_type === "snet" ? <span className="mr-0.5 text-[10px] text-muted-foreground">⇥</span> : null}
                {k === "name" && critical ? <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-foreground align-middle" aria-label="Critical" /> : null}
                {text}
              </>
            )}
          </div>
        );
        return tip && !isEditing ? <AutoTooltip key={k} content={tip} className={err ? "bg-destructive text-destructive-foreground" : undefined}>{cell}</AutoTooltip> : cell;
      })}
    </div>
  );
});

/** Inline option list for Constraint, Milestone type and Calendar cells: themed
 *  (no native select), arrow keys + Enter, click to pick, Esc to cancel. */
function CellOptions({ options, value, onPick, onCancel }: { options: string[]; value: string; onPick: (v: string) => void; onCancel: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hi, setHi] = React.useState(() => Math.max(0, options.findIndex((o) => o.toLowerCase() === value.toLowerCase())));
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const listId = React.useId();
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    setRect(el.getBoundingClientRect());
  }, []);
  const below = rect ? window.innerHeight - rect.bottom > options.length * 30 + 12 : true;
  return (
    <div ref={ref} tabIndex={0} role="combobox" aria-expanded={true} aria-controls={listId} aria-label="Choose a value"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(options.length - 1, h + 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
        else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); onPick(options[hi]); }
        else if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      }}
      onBlur={(e) => { if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest("[data-cell-options]")) onCancel(); }}
      className="absolute inset-0 flex items-center bg-background px-1.5 text-sm outline-none ring-2 ring-accent">
      {options[hi] || "None"}
      {rect && typeof document !== "undefined" ? createPortal(
        <div id={listId} data-cell-options role="listbox" className="fixed z-[9999] min-w-[140px] rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          style={{ left: rect.left, width: Math.max(rect.width, 140), ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }) }}>
          {options.map((o, i) => (
            <button key={o || "none"} type="button" role="option" aria-selected={i === hi} tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); onPick(o); }} onMouseEnter={() => setHi(i)}
              className={cn("flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left", i === hi ? "bg-accent/15 text-foreground" : "hover:bg-muted/60")}>
              <span>{o || "None"}</span>
              {o.toLowerCase() === value.toLowerCase() ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
