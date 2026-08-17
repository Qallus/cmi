"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { scheduleColor } from "../shared";
import type { ScheduleItem, ScheduleDependency, SchedulePhase } from "@/lib/schedules/types";

type Zoom = "day" | "week" | "month";
const DAY_W: Record<Zoom, number> = { day: 30, week: 12, month: 5 };
const ROW_H = 34;
const LABEL_W = 260;

function parse(iso?: string | null): Date | null { if (!iso) return null; const d = new Date(`${iso}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }
function fmtISO(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; }
function diffDays(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }

type Props = {
  items: ScheduleItem[];
  dependencies: ScheduleDependency[];
  phases?: SchedulePhase[];
  zoom: Zoom;
  groupBySchedule?: boolean;
  showBaseline?: boolean;
  canEdit?: boolean;
  linkMode?: boolean;
  onOpenItem?: (item: ScheduleItem) => void;
  onDatesChange?: (id: string, start: string, end: string) => void;
  onLink?: (sourceId: string, targetId: string) => void;
};

export function GanttView({ items, dependencies, phases, zoom, groupBySchedule, showBaseline, canEdit, linkMode, onOpenItem, onDatesChange, onLink }: Props) {
  const dayW = DAY_W[zoom];
  const [linkSource, setLinkSource] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState<{ id: string; mode: "move" | "resize"; startX: number; origStart: Date; origEnd: Date; deltaDays: number } | null>(null);

  const dated = items.filter((i) => i.start_date);
  const { min, totalDays } = React.useMemo(() => {
    let lo: Date | null = null, hi: Date | null = null;
    for (const i of dated) {
      const s = parse(i.start_date); const e = parse(i.end_date) ?? s;
      if (s && (!lo || s < lo)) lo = s;
      if (e && (!hi || e > hi)) hi = e;
    }
    const today = new Date(`${fmtISO(new Date())}T00:00:00Z`);
    if (!lo) lo = today; if (!hi) hi = addDays(today, 30);
    if (today < lo) lo = today; if (addDays(today, 3) > hi) hi = addDays(today, 3);
    lo = addDays(lo, -3); hi = addDays(hi, 4);
    return { min: lo, totalDays: Math.max(14, diffDays(lo, hi)) };
  }, [dated]);

  const boardW = totalDays * dayW;

  // Ordered rows: group by schedule (overlay) or phase (single schedule).
  type Row = { kind: "group"; label: string; color?: string } | { kind: "item"; item: ScheduleItem };
  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    if (groupBySchedule) {
      const groups = new Map<string, ScheduleItem[]>();
      for (const i of items) { const k = i.schedule_id; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(i); }
      for (const [sid, its] of groups) {
        out.push({ kind: "group", label: its[0]?.schedule_name ?? "Schedule", color: scheduleColor(sid, its[0]?.schedule_color) });
        its.sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
      }
    } else if (phases && phases.length) {
      const byPhase = new Map<string, ScheduleItem[]>();
      for (const i of items) { const k = i.phase_id ?? "none"; if (!byPhase.has(k)) byPhase.set(k, []); byPhase.get(k)!.push(i); }
      for (const ph of phases) {
        const its = byPhase.get(ph.id) ?? [];
        out.push({ kind: "group", label: ph.name, color: ph.color ?? undefined });
        its.sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
      }
      const orphan = byPhase.get("none") ?? [];
      if (orphan.length) { out.push({ kind: "group", label: "Unphased" }); orphan.sort(sortItems).forEach((item) => out.push({ kind: "item", item })); }
    } else {
      items.slice().sort(sortItems).forEach((item) => out.push({ kind: "item", item }));
    }
    return out;
  }, [items, phases, groupBySchedule]);

  const rowIndexOf = React.useMemo(() => { const m = new Map<string, number>(); rows.forEach((r, idx) => { if (r.kind === "item") m.set(r.item.id, idx); }); return m; }, [rows]);

  const x = (iso?: string | null, fallback?: Date) => { const d = parse(iso) ?? fallback; return d ? diffDays(min, d) * dayW : 0; };
  const today = new Date(`${fmtISO(new Date())}T00:00:00Z`);
  const todayX = diffDays(min, today) * dayW;

  // Month header segments.
  const months = React.useMemo(() => {
    const segs: { label: string; left: number; width: number }[] = [];
    let cur = new Date(min); cur.setUTCDate(1);
    const end = addDays(min, totalDays);
    while (cur < end) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      const segStart = cur < min ? min : cur;
      const left = diffDays(min, segStart) * dayW;
      const width = (diffDays(segStart, next > end ? end : next)) * dayW;
      segs.push({ label: new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }).format(cur), left, width });
      cur = next;
    }
    return segs;
  }, [min, totalDays, dayW]);

  // ---- drag / resize ----
  React.useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const deltaDays = Math.round((e.clientX - drag.startX) / dayW);
      setDrag((d) => (d ? { ...d, deltaDays } : d));
    };
    const onUp = () => {
      setDrag((d) => {
        if (d && d.deltaDays !== 0 && onDatesChange) {
          if (d.mode === "move") onDatesChange(d.id, fmtISO(addDays(d.origStart, d.deltaDays)), fmtISO(addDays(d.origEnd, d.deltaDays)));
          else { const ne = addDays(d.origEnd, d.deltaDays); if (ne >= d.origStart) onDatesChange(d.id, fmtISO(d.origStart), fmtISO(ne)); }
        }
        return null;
      });
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, dayW, onDatesChange]);

  function startDrag(e: React.MouseEvent, item: ScheduleItem, mode: "move" | "resize") {
    if (!canEdit || item.is_locked || linkMode) return;
    e.preventDefault(); e.stopPropagation();
    const s = parse(item.start_date); const en = parse(item.end_date) ?? s;
    if (!s || !en) return;
    setDrag({ id: item.id, mode, startX: e.clientX, origStart: s, origEnd: en, deltaDays: 0 });
  }

  function clickBar(item: ScheduleItem) {
    if (linkMode && onLink) {
      if (!linkSource) setLinkSource(item.id);
      else if (linkSource !== item.id) { onLink(linkSource, item.id); setLinkSource(null); }
      return;
    }
    onOpenItem?.(item);
  }

  // Dependency connector paths (drawn over the track area).
  const connectors = React.useMemo(() => {
    const paths: { d: string; cross: boolean }[] = [];
    const yOf = (id: string) => { const idx = rowIndexOf.get(id); return idx == null ? null : idx * ROW_H + ROW_H / 2; };
    for (const dep of dependencies) {
      const src = items.find((i) => i.id === dep.source_item_id);
      const tgt = items.find((i) => i.id === dep.target_item_id);
      if (!src || !tgt) continue;
      const sy = yOf(src.id), ty = yOf(tgt.id);
      if (sy == null || ty == null) continue;
      const sx = x(src.end_date, parse(src.start_date) ?? undefined) + dayW; // right edge of source
      const tx = x(tgt.start_date); // left edge of target
      const midX = Math.max(sx + 8, tx - 8);
      paths.push({ d: `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`, cross: dep.is_cross_schedule });
    }
    return paths;
  }, [dependencies, items, rowIndexOf, dayW, min]);

  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No schedule items yet. Add an item to see it on the Gantt.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex">
        {/* Left labels */}
        <div className="shrink-0 border-r border-border" style={{ width: LABEL_W }}>
          <div className="h-10 border-b border-border bg-muted/40" />
          {rows.map((r, idx) => r.kind === "group" ? (
            <div key={`g-${idx}`} className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground" style={{ height: ROW_H }}>
              {r.color ? <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} /> : null}
              <span className="truncate">{r.label}</span>
            </div>
          ) : (
            <button key={r.item.id} type="button" onClick={() => onOpenItem?.(r.item)} className="flex w-full items-center gap-1.5 border-b border-border px-3 text-left text-sm hover:bg-muted/40" style={{ height: ROW_H }}>
              {r.item.kind === "milestone" ? <span className="text-accent">◆</span> : null}
              <span className={cn("truncate", r.item.status === "complete" && "text-muted-foreground line-through")}>{r.item.title}</span>
            </button>
          ))}
        </div>

        {/* Right timeline (scrolls) */}
        <div className="relative flex-1 overflow-x-auto">
          <div className="relative" style={{ width: boardW }}>
            {/* Month header */}
            <div className="relative h-10 border-b border-border bg-muted/40">
              {months.map((m, i) => (
                <div key={i} className="absolute top-0 h-full border-l border-border/60 px-2 text-[11px] font-medium leading-10 text-muted-foreground" style={{ left: m.left, width: m.width }}>{m.label}</div>
              ))}
            </div>

            <div className="relative" style={{ height: rows.length * ROW_H }}>
              {/* today marker */}
              {todayX >= 0 && todayX <= boardW ? <div className="absolute top-0 z-10 w-px bg-accent/70" style={{ left: todayX, height: rows.length * ROW_H }} /> : null}

              {/* dependency connectors */}
              <svg className="pointer-events-none absolute inset-0 z-20" width={boardW} height={rows.length * ROW_H}>
                <defs>
                  <marker id="sched-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground" /></marker>
                </defs>
                {connectors.map((c, i) => <path key={i} d={c.d} fill="none" strokeWidth={1.5} className={c.cross ? "stroke-accent" : "stroke-muted-foreground/60"} strokeDasharray={c.cross ? "4 3" : undefined} markerEnd="url(#sched-arrow)" />)}
              </svg>

              {/* rows + bars */}
              {rows.map((r, idx) => (
                <div key={r.kind === "item" ? r.item.id : `g-${idx}`} className={cn("absolute left-0 right-0 border-b border-border/60", r.kind === "group" && "bg-muted/20")} style={{ top: idx * ROW_H, height: ROW_H }}>
                  {r.kind === "item" ? <Bar item={r.item} x={x} dayW={dayW} drag={drag} color={r.kind === "item" ? (r.item.schedule_color ? scheduleColor(r.item.schedule_id, r.item.schedule_color) : "#9e6f2e") : "#9e6f2e"} showBaseline={showBaseline} linkSource={linkSource === r.item.id} onBody={(e) => startDrag(e, r.item, "move")} onResize={(e) => startDrag(e, r.item, "resize")} onClick={() => clickBar(r.item)} /> : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {linkMode ? <div className="border-t border-border bg-accent/5 px-3 py-1.5 text-xs text-accent">{linkSource ? "Now click the successor item to link it." : "Link mode: click a predecessor item, then its successor."}</div> : null}
    </div>
  );
}

function sortItems(a: ScheduleItem, b: ScheduleItem) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return (a.start_date ?? "") < (b.start_date ?? "") ? -1 : 1;
}

function Bar({ item, x, dayW, drag, color, showBaseline, linkSource, onBody, onResize, onClick }: {
  item: ScheduleItem; x: (iso?: string | null, fb?: Date) => number; dayW: number;
  drag: { id: string; mode: "move" | "resize"; deltaDays: number } | null; color: string; showBaseline?: boolean; linkSource?: boolean;
  onBody: (e: React.MouseEvent) => void; onResize: (e: React.MouseEvent) => void; onClick: () => void;
}) {
  const s = parse(item.start_date); const e = parse(item.end_date) ?? s;
  if (!s) return null;
  const dragging = drag?.id === item.id ? drag : null;
  const shift = dragging?.mode === "move" ? (dragging.deltaDays || 0) : 0;
  const grow = dragging?.mode === "resize" ? (dragging.deltaDays || 0) : 0;
  const left = x(item.start_date) + shift * dayW;
  const durDays = e ? diffDays(s, e) + 1 : 1;
  const width = Math.max(dayW, (durDays + grow) * dayW);

  if (item.kind === "milestone") {
    return (
      <div className="absolute top-1/2 z-30 -translate-y-1/2" style={{ left: left - 7 }} onClick={onClick} title={item.title}>
        <span onMouseDown={onBody} className={cn("block h-3.5 w-3.5 rotate-45 cursor-pointer border", item.status === "complete" ? "bg-accent" : "bg-card", linkSource ? "ring-2 ring-accent" : "")} style={{ borderColor: color }} />
      </div>
    );
  }

  return (
    <>
      {showBaseline && item.baseline_start ? (
        <div className="absolute top-1/2 z-10 h-1.5 -translate-y-1/2 rounded bg-muted-foreground/25" style={{ left: x(item.baseline_start), width: Math.max(dayW, ((diffDays(parse(item.baseline_start)!, parse(item.baseline_end) ?? parse(item.baseline_start)!) + 1)) * dayW), marginTop: 9 }} />
      ) : null}
      <div
        onMouseDown={onBody}
        onClick={onClick}
        className={cn("group absolute top-1/2 z-30 flex h-5 -translate-y-1/2 cursor-pointer items-center overflow-hidden rounded text-[11px] text-white shadow-sm", item.is_critical && "ring-1 ring-destructive", linkSource && "ring-2 ring-accent")}
        style={{ left, width, background: item.status === "complete" ? `${color}aa` : color }}
        title={`${item.title} · ${item.percent_complete}%`}
      >
        {item.percent_complete > 0 ? <span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${item.percent_complete}%` }} /> : null}
        <span className="relative z-10 truncate px-1.5">{item.title}</span>
        <span onMouseDown={onResize} className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100" style={{ background: "rgba(255,255,255,0.5)" }} />
      </div>
    </>
  );
}
