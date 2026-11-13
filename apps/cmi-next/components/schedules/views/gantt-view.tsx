"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { scheduleColor, fmtShort } from "../shared";
import { barFill, nextUpId, phaseColors } from "@/lib/schedules/colors";
import { useColorScheme } from "../color-scheme";
import { AutoTooltip } from "@/components/ui/tooltip";
import { scheduleRows, type GridRow } from "@/lib/schedules/grid";
import { DEPENDENCY_ABBR, type ScheduleItem, type ScheduleDependency, type SchedulePhase, type LineStyle } from "@/lib/schedules/types";
import { dashFor } from "../item-colors-panel";

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
  /** Double-click a bar: open its colours (bar and link lines). */
  onStyleItem?: (item: ScheduleItem) => void;
  /** Where the date header sticks, in px from the top of the scrolling area: 0 inside a
   *  scrolling panel (the schedule workspace), 56 when the window scrolls under the top bar. */
  stickyTop?: number;
  /** Phase 2 status date: drawn as a dashed line at the end of that day. */
  statusDate?: string | null;
  /** Split view (Grid Addendum §2.2): a click selects the task's grid row and a
   *  double-click opens the task, instead of click = open, double-click = colours. */
  onSelectItem?: (item: ScheduleItem) => void;
  /** Click a link line to select it; Delete (or the chip's button) removes it (§2.4). */
  onDeleteLink?: (dep: ScheduleDependency) => void;
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

export function GanttView({ items, dependencies, phases, zoom, groupBySchedule, showBaseline, canEdit, linkMode, onOpenItem, onDatesChange, onLink, hideLabels, collapsed, selectedId, flashIds, showLinks = true, onStyleItem, stickyTop = 0, statusDate, onSelectItem, onDeleteLink }: Props) {
  const dayW = DAY_W[zoom];
  const [linkSource, setLinkSource] = React.useState<string | null>(null);
  // The sticky date header scrolls sideways with the timeline body.
  const headRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const clickTimer = React.useRef<number | null>(null);
  const syncHead = () => { if (headRef.current && bodyRef.current) headRef.current.scrollLeft = bodyRef.current.scrollLeft; };
  // A link line picked by clicking it, and where to show its chip.
  const [pickedLink, setPickedLink] = React.useState<{ id: string; x: number; y: number } | null>(null);
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

  // Each phase its own colour (unless it has one set); past-due work in red; the next task up pulses.
  const todayISO = fmtISO(new Date());
  // Phase colours, or Tan & charcoal (the header's Colours picker).
  const [scheme] = useColorScheme();
  const phaseColorMap = React.useMemo(() => (scheme === "classic" ? new Map<string, string>() : phaseColors(phases)), [phases, scheme]);
  const nextId = React.useMemo(() => nextUpId(items, todayISO), [items, todayISO]);
  const fillFor = (it: ScheduleItem) => barFill(it, { today: todayISO, phases: phaseColorMap, scheduleColor: groupBySchedule && it.schedule_color ? scheduleColor(it.schedule_id, it.schedule_color) : null, fallback: "#9e6f2e", scheme });
  const groupColor = (r: Extract<GridRow, { kind: "group" }>) => (r.phaseId ? phaseColorMap.get(r.phaseId) : undefined) ?? r.color;

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
    setPickedLink(null);
    if (linkMode && onLink) {
      if (!linkSource) setLinkSource(item.id);
      else if (linkSource !== item.id) { onLink(linkSource, item.id); setLinkSource(null); }
      return;
    }
    if (onSelectItem) { onSelectItem(item); return; }
    // With a double-click action, wait a moment so a double-click doesn't also open the task.
    if (!onStyleItem) { onOpenItem?.(item); return; }
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => { clickTimer.current = null; onOpenItem?.(item); }, 240);
  }
  function doubleClickBar(item: ScheduleItem) {
    if (clickTimer.current) { window.clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (linkMode) return;
    if (onSelectItem) onOpenItem?.(item);
    else onStyleItem?.(item);
  }

  // Delete removes the picked link; Esc lets it go.
  const pickedDep = pickedLink ? dependencies.find((d) => d.id === pickedLink.id) ?? null : null;
  React.useEffect(() => {
    if (!pickedLink) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape") setPickedLink(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && pickedDep && onDeleteLink) { e.preventDefault(); e.stopPropagation(); onDeleteLink(pickedDep); setPickedLink(null); }
    };
    // The chip sits where you clicked; scrolling moves the line away from it, so let it go.
    const onScroll = () => setPickedLink(null);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("scroll", onScroll, true); };
  }, [pickedLink, pickedDep, onDeleteLink]);

  // Link lines between bars (under the bars, over the gridlines).
  const connectors = React.useMemo(() => {
    const paths: { id: string; d: string; cross: boolean; critical: boolean; touches: string[]; color: string | null; style: LineStyle | null }[] = [];
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
        touches: [src.id, tgt.id], color: dep.line_color ?? null, style: dep.line_style ?? null,
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
      <div className="sticky z-40 flex border-b border-border bg-muted" style={{ top: stickyTop }}>
        <div className={cn("shrink-0 border-r border-border", hideLabels && "hidden")} style={{ width: LABEL_W, height: HEAD_H - 1 }} />
        <div ref={headRef} className="min-w-0 flex-1 overflow-hidden">
          {/* Header — month band (top) + day/week ticks (bottom) */}
          <div className="relative" style={{ width: boardW, height: HEAD_H - 1 }}>
            {months.map((m, i) => (
              <div key={`m${i}`} className="absolute overflow-hidden whitespace-nowrap border-l border-border/60 px-2 text-[11px] font-semibold text-muted-foreground" style={{ left: m.left, width: m.width, top: 0, height: HEAD_TOP, lineHeight: `${HEAD_TOP}px` }}>{m.width >= 90 ? m.label : ""}</div>
            ))}
            {zoom !== "month" ? ticks.map((t, i) => (
              <div key={`t${i}`} className={cn("absolute overflow-hidden border-l border-border/40 text-center text-[10px] text-muted-foreground", t.weekend && "bg-foreground/5")} style={{ left: t.left, width: t.width, top: HEAD_TOP, height: HEAD_TICK, lineHeight: `${HEAD_TICK}px` }}>{t.label}</div>
            )) : null}
          </div>
        </div>
      </div>
      <div className="flex">
        {/* Left labels */}
        <div className={cn("shrink-0 border-r border-border", hideLabels && "hidden")} style={{ width: LABEL_W }}>
          {rows.map((r, idx) => r.kind === "group" ? (
            <div key={`g-${idx}`} className="flex items-center gap-2 border-b border-l-4 border-border px-3 text-xs font-semibold uppercase tracking-wide"
              style={{ height: ROW_H, borderLeftColor: groupColor(r) ?? "transparent", background: groupColor(r) ? `color-mix(in oklch, ${groupColor(r)} 14%, var(--card))` : undefined, color: groupColor(r) ? `color-mix(in oklch, ${groupColor(r)} 80%, var(--foreground))` : undefined }}>
              {groupColor(r) ? <span className="h-2.5 w-2.5 rounded-sm" style={{ background: groupColor(r) }} /> : null}
              <span className="truncate">{r.label}</span>
            </div>
          ) : (
            <button key={r.item.id} type="button" onClick={() => onOpenItem?.(r.item)}
              className={cn("relative flex w-full items-center gap-1.5 overflow-hidden border-b border-l-4 border-border px-3 text-left text-sm hover:bg-muted/40", fillFor(r.item).pastDue && "text-[#c2410c]")}
              style={{ height: ROW_H, borderLeftColor: (r.item.phase_id && phaseColorMap.get(r.item.phase_id)) || "transparent" }}
              title={fillFor(r.item).pastDue ? "Past due" : r.item.id === nextId ? "Up next" : undefined}>
              {r.item.id === nextId ? <NextUpSweep /> : null}
              {r.item.kind === "milestone" ? <span className="relative" style={{ color: fillFor(r.item).color }}>◆</span> : null}
              <span className={cn("relative truncate", r.item.status === "complete" && "text-muted-foreground line-through", r.item.id === nextId && "font-semibold")}>{r.item.title}</span>
              {fillFor(r.item).pastDue ? <span className="relative ml-auto shrink-0 rounded bg-[#c2410c]/10 px-1.5 text-[10px] font-semibold uppercase tracking-wide">Past due</span> : r.item.id === nextId ? <span className="relative ml-auto shrink-0 rounded bg-accent/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Up next</span> : null}
            </button>
          ))}
        </div>

        {/* Right timeline (scrolls) */}
        <div ref={bodyRef} onScroll={syncHead} className="relative min-w-0 flex-1 overflow-x-auto">
          <div className="relative" style={{ width: boardW }}>
            <div className="relative" style={{ height: rows.length * ROW_H }} onClick={() => { if (pickedLink) setPickedLink(null); }}>
              {/* column gridlines (+ weekend shading on day zoom) */}
              {ticks.map((t, i) => (
                <div key={`gl${i}`} className={cn("absolute top-0 border-l border-border/25", t.weekend && "bg-muted/20")} style={{ left: t.left, width: zoom === "day" && t.weekend ? dayW : undefined, height: rows.length * ROW_H }} />
              ))}
              {/* status date: work up to here is reported */}
              {statusDate && parse(statusDate) ? (() => {
                const sx = x(statusDate) + dayW;
                return sx >= 0 && sx <= boardW ? <div title={`Status date ${fmtShort(statusDate)}`} className="absolute top-0 z-10 border-l-2 border-dashed border-foreground/50" style={{ left: sx, height: rows.length * ROW_H }} /> : null;
              })() : null}
              {/* today marker */}
              {todayX >= 0 && todayX <= boardW ? <div className="absolute top-0 z-10 w-px bg-accent/70" style={{ left: todayX, height: rows.length * ROW_H }} /> : null}

              {/* dependency connectors */}
              {connectors.length ? (
                <svg className="pointer-events-none absolute inset-0 z-20 overflow-visible" width={boardW} height={rows.length * ROW_H} aria-hidden>
                  <defs>
                    <marker id="sched-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={LINK_COLOR} /></marker>
                    <marker id="sched-arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" style={{ fill: "var(--foreground)" }} /></marker>
                    {[...new Set(connectors.map((c) => c.color).filter(Boolean))].map((c) => (
                      <marker key={c} id={`sched-arrow-${c!.slice(1)}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill={c!} /></marker>
                    ))}
                  </defs>
                  {connectors.map((c) => {
                    // A selected task's links stand out; the rest fade back.
                    const picked = pickedLink?.id === c.id;
                    const lit = picked || (!!selectedId && c.touches.includes(selectedId));
                    const dim = !!(selectedId || pickedLink) && !lit;
                    return (
                      <React.Fragment key={c.id}>
                      {/* A wide invisible stroke so a thin line is easy to click. */}
                      {onDeleteLink && canEdit && !linkMode ? (
                        <path d={c.d} fill="none" stroke="transparent" strokeWidth={9} style={{ pointerEvents: "stroke", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); setPickedLink({ id: c.id, x: e.clientX, y: e.clientY }); }}>
                          <title>Click to select this link</title>
                        </path>
                      ) : null}
                      <path d={c.d} fill="none" strokeLinejoin="round"
                        strokeWidth={picked ? 2.5 : lit ? 2 : c.critical ? 1.5 : 1.25}
                        strokeDasharray={picked ? undefined : c.style ? dashFor(c.style) : c.critical || lit ? undefined : c.cross ? "5 3" : "2 2"}
                        style={picked ? { stroke: "var(--accent)", opacity: 1 } : { stroke: c.color ?? (c.critical ? "var(--foreground)" : LINK_COLOR), opacity: dim ? 0.35 : c.critical || lit || c.color ? 0.9 : 0.75 }}
                        markerEnd={c.color ? `url(#sched-arrow-${c.color.slice(1)})` : c.critical ? "url(#sched-arrow-crit)" : "url(#sched-arrow)"} />
                      </React.Fragment>
                    );
                  })}
                </svg>
              ) : null}

              {/* the picked link: what it joins, and a Delete button */}
              {pickedLink && pickedDep ? (() => {
                const src = items.find((i) => i.id === pickedDep.source_item_id), tgt = items.find((i) => i.id === pickedDep.target_item_id);
                const name = (i?: ScheduleItem) => (i ? `${i.activity_id != null ? `${i.activity_id} ` : ""}${i.title}` : "another schedule");
                const lag = pickedDep.lag_days ? `${pickedDep.lag_days > 0 ? "+" : ""}${pickedDep.lag_days}` : "";
                return (
                  // Fixed to the screen beside the click, so the Gantt's edge never clips it.
                  <div className="fixed z-[60] flex max-w-[22rem] items-center gap-2 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
                    style={{ left: Math.max(8, Math.min(pickedLink.x + 8, window.innerWidth - 360)), top: Math.min(pickedLink.y + 10, window.innerHeight - 44) }} onMouseDown={(e) => e.stopPropagation()}>
                    <span className="truncate">{name(src)} → {name(tgt)} <span className="text-muted-foreground">{DEPENDENCY_ABBR[pickedDep.dependency_type]}{lag}</span></span>
                    <button type="button" onClick={() => { onDeleteLink?.(pickedDep); setPickedLink(null); }} className="shrink-0 rounded px-1.5 py-0.5 font-medium text-destructive hover:bg-destructive/10">Delete</button>
                    <button type="button" onClick={() => setPickedLink(null)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Close">×</button>
                  </div>
                );
              })() : null}

              {/* rows + bars */}
              {rows.map((r, idx) => (
                <div key={r.kind === "item" ? r.item.id : `g-${idx}`} className={cn("absolute left-0 right-0 border-b border-border/60 transition-colors duration-700", r.kind === "group" && "bg-muted/20", r.kind === "item" && r.item.id === selectedId && "bg-accent/10", r.kind === "item" && flashIds?.has(r.item.id) && "bg-amber-200/40")} style={{ top: idx * ROW_H, height: ROW_H, background: r.kind === "group" && groupColor(r) ? `color-mix(in oklch, ${groupColor(r)} 9%, transparent)` : undefined }}>
                  {r.kind === "item" ? <Bar item={r.item} x={x} dayW={dayW} drag={drag} color={fillFor(r.item).color} nextUp={r.item.id === nextId} showBaseline={showBaseline} linkSource={linkSource === r.item.id} onBody={(e) => startDrag(e, r.item, "move")} onResize={(e) => startDrag(e, r.item, "resize")} onClick={() => clickBar(r.item)} onDoubleClick={onStyleItem ? () => doubleClickBar(r.item) : undefined} /> : null}
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

/** A soft light sweeping across the next task up (the row and its bar). */
function NextUpSweep() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-full animate-next-sweep bg-gradient-to-r from-transparent via-white/45 to-transparent motion-reduce:hidden dark:via-white/20" />
    </span>
  );
}

function Bar({ item, x, dayW, drag, color, nextUp, showBaseline, linkSource, onBody, onResize, onClick, onDoubleClick }: {
  item: ScheduleItem; x: (iso?: string | null, fb?: Date) => number; dayW: number;
  drag: { id: string; mode: "move" | "resize"; deltaDays: number } | null; color: string; nextUp?: boolean; showBaseline?: boolean; linkSource?: boolean;
  onBody: (e: React.MouseEvent) => void; onResize: (e: React.MouseEvent) => void; onClick: () => void; onDoubleClick?: () => void;
}) {
  const hint = onDoubleClick ? "Double-click for colors" : undefined;
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
        <AutoTooltip prefer="horizontal" disabled={!!drag} content={<TipBody item={item} hint={hint} />}>
          <div className="absolute top-1/2 z-30 -translate-y-1/2" style={{ left: left - 7 }} onClick={onClick} onDoubleClick={onDoubleClick}>
            <span onMouseDown={onBody} className={cn("block h-3.5 w-3.5 rotate-45 cursor-pointer border-2", item.status === "complete" ? "bg-accent" : "bg-card", linkSource ? "ring-2 ring-accent" : "", nextUp && "animate-next-glow motion-reduce:animate-none")} style={{ borderColor: color }} />
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
      <AutoTooltip disabled={!!drag} content={<TipBody item={item} hint={hint} />}>
      <div
        onMouseDown={onBody}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        className={cn("group absolute top-1/2 z-30 flex h-5 -translate-y-1/2 cursor-pointer items-center overflow-hidden rounded text-[11px] text-white shadow-sm",
          // Engine-worked critical path in charcoal; a hand-ticked "critical" keeps the red ring.
          item.is_critical && (item.total_float != null ? "ring-2 ring-foreground/80" : "ring-1 ring-destructive"), linkSource && "ring-2 ring-accent", nextUp && "animate-next-glow motion-reduce:animate-none")}
        style={{ left, width, background: item.status === "complete" ? `${color}aa` : color }}
      >
        {nextUp ? <NextUpSweep /> : null}
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
function TipBody({ item, heading, hint }: { item: ScheduleItem; heading?: string; hint?: string }) {
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
      {hint ? <div className="border-t border-white/15 pt-1 text-[10px] opacity-60">{hint}</div> : null}
    </div>
  );
}
