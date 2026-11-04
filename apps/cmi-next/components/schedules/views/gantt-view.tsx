"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { scheduleColor, fmtShort } from "../shared";
import { AutoTooltip } from "@/components/ui/tooltip";
import { scheduleRows, type GridRow } from "@/lib/schedules/grid";
import type { ScheduleItem, ScheduleDependency, SchedulePhase } from "@/lib/schedules/types";

type Zoom = "day" | "week" | "month";
const DAY_W: Record<Zoom, number> = { day: 40, week: 20, month: 10 };
// Exported so the grid beside it (split layout) lines up row for row.
export const ROW_H = 34;
const LABEL_W = 260;
const HEAD_TOP = 22;   // month band
const HEAD_TICK = 24;  // day / week ticks
export const HEAD_H = HEAD_TOP + HEAD_TICK;

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
  onDatesChange?: (id: string, start: string, end: string, gesture: "move" | "resize") => void;
  onLink?: (sourceId: string, targetId: string) => void;
  /** Split layout: the grid shows the names, so hide the label column. */
  hideLabels?: boolean;
  /** Phases whose tasks are folded away (same as the grid). */
  collapsed?: Set<string>;
  selectedId?: string | null;
  /** Rows the last edit moved, briefly highlighted. */
  flashIds?: Set<string>;
  /** Draw the link lines between tasks (default on). */
  showLinks?: boolean;
};

// Link lines: how far a line runs out of a bar before it turns.
const LINK_GAP = 8;
const LINK_COLOR = "#9e6f2e";

/** The elbow path for one link. Each type leaves and enters the bar edge it
 *  ties: FS end → start, SS start → start, FF end → end, SF start → end.
 *  When no single vertical run fits outside both edges, the line doubles
 *  back along the row boundary, as MS Project draws it. */
export function linkPath(type: string, src: { left: number; right: number; y: number }, tgt: { left: number; right: number; y: number }, rowH: number): string {
  const fromEnd = type !== "start_to_start" && type !== "start_to_finish";
  const toStart = type === "finish_to_start" || type === "start_to_start";
  const sx = fromEnd ? src.right : src.left, out = fromEnd ? 1 : -1;
  const tx = toStart ? tgt.left : tgt.right, into = toStart ? -1 : 1;
  const sy = src.y, ty = tgt.y;
  let vx: number | null = null;
  if (out === 1 && into === -1) vx = tx - sx >= 2 * LINK_GAP ? sx + LINK_GAP : null; // FS
  else if (out === -1 && into === -1) vx = Math.min(sx, tx) - LINK_GAP; // SS
  else if (out === 1 && into === 1) vx = Math.max(sx, tx) + LINK_GAP; // FF
  else vx = sx - tx >= 2 * LINK_GAP ? sx - LINK_GAP : null; // SF
  if (vx != null) return `M ${sx} ${sy} H ${vx} V ${ty} H ${tx}`;
  const midY = sy + Math.sign(ty - sy) * (rowH / 2);
  return `M ${sx} ${sy} H ${sx + out * LINK_GAP} V ${midY} H ${tx + into * LINK_GAP} V ${ty} H ${tx}`;
}

export function GanttView({ items, dependencies, phases, zoom, groupBySchedule, showBaseline, canEdit, linkMode, onOpenItem, onDatesChange, onLink, hideLabels, collapsed, selectedId, flashIds, showLinks = true }: Props) {
  const dayW = DAY_W[zoom];
  const [linkSource, setLinkSource] = React.useState<string | null>(null);
  // The sticky date header scrolls sideways with the timeline body.
  const headRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const syncHead = () => { if (headRef.current && bodyRef.current) headRef.current.scrollLeft = bodyRef.current.scrollLeft; };
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
  const rows: GridRow[] = React.useMemo(
    () => scheduleRows(items, phases, { groupBySchedule, collapsed, scheduleColor }),
    [items, phases, groupBySchedule, collapsed],
  );

  const rowIndexOf = React.useMemo(() => { const m = new Map<string, number>(); rows.forEach((r, idx) => { if (r.kind === "item") m.set(r.item.id, idx); }); return m; }, [rows]);

  const x = (iso?: string | null, fallback?: Date) => { const d = parse(iso) ?? fallback; return d ? diffDays(min, d) * dayW : 0; };
  const today = new Date(`${fmtISO(new Date())}T00:00:00Z`);
  const todayX = diffDays(min, today) * dayW;

  // Top band: month segments (unambiguous "Aug 2026").
  const months = React.useMemo(() => {
    const segs: { label: string; left: number; width: number }[] = [];
    let cur = new Date(min); cur.setUTCDate(1);
    const end = addDays(min, totalDays);
    while (cur < end) {
      const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      const segStart = cur < min ? min : cur;
      const left = diffDays(min, segStart) * dayW;
      const width = (diffDays(segStart, next > end ? end : next)) * dayW;
      segs.push({ label: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(cur), left, width });
      cur = next;
    }
    return segs;
  }, [min, totalDays, dayW]);

  // Bottom band + gridlines: per-day (day zoom), per-week (week), per-month (month).
  const ticks = React.useMemo(() => {
    const out: { left: number; width: number; label: string; weekend: boolean }[] = [];
    if (zoom === "day") {
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(min, i);
        out.push({ left: i * dayW, width: dayW, label: String(d.getUTCDate()), weekend: d.getUTCDay() === 0 || d.getUTCDay() === 6 });
      }
    } else if (zoom === "week") {
      // Align to Sundays.
      const startOffset = -min.getUTCDay();
      for (let i = startOffset; i < totalDays; i += 7) {
        const left = Math.max(0, i) * dayW;
        const d = addDays(min, Math.max(0, i));
        out.push({ left, width: 7 * dayW, label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, weekend: false });
      }
    } else {
      // month: gridlines at month boundaries (labels live in the top band).
      for (const m of months) out.push({ left: m.left, width: m.width, label: "", weekend: false });
    }
    return out;
  }, [zoom, min, totalDays, dayW, months]);

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
          if (d.mode === "move") onDatesChange(d.id, fmtISO(addDays(d.origStart, d.deltaDays)), fmtISO(addDays(d.origEnd, d.deltaDays)), "move");
          else { const ne = addDays(d.origEnd, d.deltaDays); if (ne >= d.origStart) onDatesChange(d.id, fmtISO(d.origStart), fmtISO(ne), "resize"); }
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

  // Link lines between bars (under the bars, over the gridlines).
  const connectors = React.useMemo(() => {
    const paths: { id: string; d: string; cross: boolean; critical: boolean; touches: string[] }[] = [];
    if (!showLinks) return paths;
    const byId = new Map(items.map((i) => [i.id, i]));
    const edges = (i: ScheduleItem) => {
      const idx = rowIndexOf.get(i.id);
      const s = parse(i.start_date);
      if (idx == null || !s) return null;
      const y = idx * ROW_H + ROW_H / 2;
      const left = diffDays(min, s) * dayW;
      if (i.kind === "milestone") return { left: left - 7, right: left + 7, y };
      const e = parse(i.end_date) ?? s;
      return { left, right: left + Math.max(dayW, (diffDays(s, e) + 1) * dayW), y };
    };
    for (const dep of dependencies) {
      const src = byId.get(dep.source_item_id), tgt = byId.get(dep.target_item_id);
      if (!src || !tgt) continue;
      const a = edges(src), b = edges(tgt);
      if (!a || !b) continue;
      paths.push({
        id: dep.id, d: linkPath(dep.dependency_type, a, b, ROW_H), cross: dep.is_cross_schedule,
        critical: !!(src.is_critical && tgt.is_critical && src.total_float != null && tgt.total_float != null),
        touches: [src.id, tgt.id],
      });
    }
    return paths;
  }, [showLinks, dependencies, items, rowIndexOf, dayW, min]);

  if (!items.length) {
    return <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No schedule items yet. Add an item to see it on the Gantt.</div>;
  }

  return (
    // overflow-clip (not hidden) so the date header can stick to the page as it scrolls.
    <div className="overflow-clip rounded-lg border border-border bg-card">
      {/* Date header: stays under the top bar while the rows scroll, and follows the timeline sideways. */}
      <div className="sticky top-14 z-40 flex border-b border-border bg-card">
        <div className={cn("shrink-0 border-r border-border bg-muted/40", hideLabels && "hidden")} style={{ width: LABEL_W, height: HEAD_H - 1 }} />
        <div ref={headRef} className="min-w-0 flex-1 overflow-hidden bg-muted/40">
          {/* Header — month band (top) + day/week ticks (bottom) */}
          <div className="relative" style={{ width: boardW, height: HEAD_H - 1 }}>
            {months.map((m, i) => (
              <div key={`m${i}`} className="absolute overflow-hidden whitespace-nowrap border-l border-border/60 px-2 text-[11px] font-semibold text-muted-foreground" style={{ left: m.left, width: m.width, top: 0, height: HEAD_TOP, lineHeight: `${HEAD_TOP}px` }}>{m.width >= 90 ? m.label : ""}</div>
            ))}
            {zoom !== "month" ? ticks.map((t, i) => (
              <div key={`t${i}`} className={cn("absolute overflow-hidden border-l border-border/40 text-center text-[10px] text-muted-foreground", t.weekend && "bg-muted/50")} style={{ left: t.left, width: t.width, top: HEAD_TOP, height: HEAD_TICK, lineHeight: `${HEAD_TICK}px` }}>{t.label}</div>
            )) : null}
          </div>
        </div>
      </div>
      <div className="flex">
        {/* Left labels */}
        <div className={cn("shrink-0 border-r border-border", hideLabels && "hidden")} style={{ width: LABEL_W }}>
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
        <div ref={bodyRef} onScroll={syncHead} className="relative min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: boardW }}>
            <div className="relative" style={{ height: rows.length * ROW_H }}>
              {/* column gridlines (+ weekend shading on day zoom) */}
              {ticks.map((t, i) => (
                <div key={`gl${i}`} className={cn("absolute top-0 border-l border-border/25", t.weekend && "bg-muted/20")} style={{ left: t.left, width: zoom === "day" && t.weekend ? dayW : undefined, height: rows.length * ROW_H }} />
              ))}
              {/* today marker */}
              {todayX >= 0 && todayX <= boardW ? <div className="absolute top-0 z-10 w-px bg-accent/70" style={{ left: todayX, height: rows.length * ROW_H }} /> : null}

              {/* dependency connectors */}
              {connectors.length ? (
                <svg className="pointer-events-none absolute inset-0 z-20 overflow-visible" width={boardW} height={rows.length * ROW_H} aria-hidden>
                  <defs>
                    <marker id="sched-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={LINK_COLOR} /></marker>
                    <marker id="sched-arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" style={{ fill: "var(--foreground)" }} /></marker>
                  </defs>
                  {connectors.map((c) => {
                    // A selected task's links stand out; the rest fade back.
                    const lit = !!selectedId && c.touches.includes(selectedId);
                    const dim = !!selectedId && !lit;
                    return (
                      <path key={c.id} d={c.d} fill="none" strokeLinejoin="round"
                        strokeWidth={lit ? 2 : c.critical ? 1.5 : 1.25}
                        strokeDasharray={c.critical || lit ? undefined : c.cross ? "5 3" : "2 2"}
                        style={{ stroke: c.critical ? "var(--foreground)" : LINK_COLOR, opacity: dim ? 0.35 : c.critical || lit ? 0.9 : 0.75 }}
                        markerEnd={c.critical ? "url(#sched-arrow-crit)" : "url(#sched-arrow)"} />
                    );
                  })}
                </svg>
              ) : null}

              {/* rows + bars */}
              {rows.map((r, idx) => (
                <div key={r.kind === "item" ? r.item.id : `g-${idx}`} className={cn("absolute left-0 right-0 border-b border-border/60 transition-colors duration-700", r.kind === "group" && "bg-muted/20", r.kind === "item" && r.item.id === selectedId && "bg-accent/10", r.kind === "item" && flashIds?.has(r.item.id) && "bg-amber-200/40")} style={{ top: idx * ROW_H, height: ROW_H }}>
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
    // A contract date shows as a dashed marker; the gap to the diamond is the variance.
    const late = item.contract_date && item.start_date ? item.start_date > item.contract_date : false;
    return (
      <>
        {item.contract_date ? (
          <AutoTooltip prefer="horizontal" disabled={!!drag} content={<TipBody item={item} heading="Contract date" />}>
            <div className={cn("absolute inset-y-1 z-20 w-2 -translate-x-1/2 cursor-help", "after:absolute after:inset-y-0 after:left-1/2 after:border-l-2 after:border-dashed", late ? "after:border-destructive/70" : "after:border-foreground/50")} style={{ left: x(item.contract_date) }} />
          </AutoTooltip>
        ) : null}
        <AutoTooltip prefer="horizontal" disabled={!!drag} content={<TipBody item={item} />}>
          <div className="absolute top-1/2 z-30 -translate-y-1/2" style={{ left: left - 7 }} onClick={onClick}>
            <span onMouseDown={onBody} className={cn("block h-3.5 w-3.5 rotate-45 cursor-pointer border", item.status === "complete" ? "bg-accent" : "bg-card", linkSource ? "ring-2 ring-accent" : "")} style={{ borderColor: color }} />
          </div>
        </AutoTooltip>
      </>
    );
  }

  return (
    <>
      {showBaseline && item.baseline_start ? (
        <div className="absolute top-1/2 z-10 h-1.5 -translate-y-1/2 rounded bg-muted-foreground/25" style={{ left: x(item.baseline_start), width: Math.max(dayW, ((diffDays(parse(item.baseline_start)!, parse(item.baseline_end) ?? parse(item.baseline_start)!) + 1)) * dayW), marginTop: 9 }} />
      ) : null}
      <AutoTooltip disabled={!!drag} content={<TipBody item={item} />}>
      <div
        onMouseDown={onBody}
        onClick={onClick}
        className={cn("group absolute top-1/2 z-30 flex h-5 -translate-y-1/2 cursor-pointer items-center overflow-hidden rounded text-[11px] text-white shadow-sm",
          // Engine-worked critical path in charcoal; a hand-ticked "critical" keeps the red ring.
          item.is_critical && (item.total_float != null ? "ring-2 ring-foreground/80" : "ring-1 ring-destructive"), linkSource && "ring-2 ring-accent")}
        style={{ left, width, background: item.status === "complete" ? `${color}aa` : color }}
      >
        {item.percent_complete > 0 ? <span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${item.percent_complete}%` }} /> : null}
        {item.constraint_type === "snet" ? <span className="relative z-10 pl-1 text-[10px] opacity-80" aria-label="Start No Earlier Than">⇥</span> : null}
        <span className="relative z-10 truncate px-1.5">{item.title}</span>
        <span onMouseDown={onResize} className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-ew-resize opacity-0 group-hover:opacity-100" style={{ background: "rgba(255,255,255,0.5)" }} />
      </div>
      </AutoTooltip>
    </>
  );
}

/** What a bar's tooltip shows: ID and name, dates, length, progress, float,
 *  constraint and contract date. */
function TipBody({ item, heading }: { item: ScheduleItem; heading?: string }) {
  const milestone = item.kind === "milestone";
  const len = item.duration_days ?? (item.start_date && item.end_date ? diffDays(parse(item.start_date)!, parse(item.end_date)!) + 1 : null);
  const tf = item.total_float;
  const rows: [string, React.ReactNode][] = [];
  rows.push([milestone ? "Date" : "Dates", milestone ? fmtShort(item.start_date) : `${fmtShort(item.start_date)} → ${fmtShort(item.end_date)}`]);
  if (!milestone && len != null) rows.push(["Length", `${len} ${item.duration_unit === "calendar" ? "calendar" : "working"} day${len === 1 ? "" : "s"}`]);
  if (!milestone) rows.push(["Progress", `${item.percent_complete ?? 0}%`]);
  if (tf != null) rows.push(["Float", tf <= 0 ? <span key="f" className="font-semibold">{tf} wd · critical</span> : `${tf} wd${tf <= 3 ? " · near-critical" : ""}`]);
  if (item.is_locked) rows.push(["Constraint", "Locked"]);
  else if (item.constraint_type && item.constraint_date) rows.push(["Constraint", `${item.constraint_type === "snet" ? "Start no earlier than" : item.constraint_type === "mfo" ? "Must finish on" : "As late as possible"} ${item.constraint_type === "alap" ? "" : fmtShort(item.constraint_date)}`.trim()]);
  if (item.contract_date) {
    const late = item.start_date && item.start_date > item.contract_date;
    rows.push(["Contract", <span key="c">{fmtShort(item.contract_date)}{late ? <span className="ml-1 font-semibold">· forecast is later</span> : null}</span>]);
  }
  if ((item.assignees ?? []).length) rows.push(["Assigned", item.assignees.map((a) => a.name).join(", ")]);
  return (
    <div className="space-y-1.5 py-0.5">
      {heading ? <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{heading}</div> : null}
      <div className="font-semibold">{item.activity_id != null ? <span className="mr-1 tabular-nums opacity-70">{item.activity_id}</span> : null}{milestone ? "◆ " : ""}{item.title}</div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-normal">
        {rows.map(([k, v]) => (
          <React.Fragment key={k}>
            <span className="opacity-70">{k}</span>
            <span className="tabular-nums">{v}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
