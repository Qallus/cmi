"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { scheduleColor } from "../shared";
import type { ScheduleItem } from "@/lib/schedules/types";

type Mode = "day" | "week" | "month" | "year";

function parse(iso?: string | null) { if (!iso) return null; const d = new Date(`${iso}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }
function key(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; }
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function CalendarView({ items, onOpenItem }: { items: ScheduleItem[]; onOpenItem?: (i: ScheduleItem) => void }) {
  const [mode, setMode] = React.useState<Mode>("month");
  // cursor is a UTC midnight anchor for the visible period.
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); });

  // Map every item onto each day it spans.
  const byDay = React.useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const s = parse(it.start_date); if (!s) continue;
      const e = parse(it.end_date) ?? s;
      const d = new Date(s); let guard = 0;
      while (d <= e && guard++ < 800) { const k = key(d); if (!map.has(k)) map.set(k, []); map.get(k)!.push(it); d.setUTCDate(d.getUTCDate() + 1); }
    }
    return map;
  }, [items]);

  const todayKey = key(new Date());
  const shift = (dir: number) => setCursor((c) => {
    if (mode === "day") return addDays(c, dir);
    if (mode === "week") return addDays(c, dir * 7);
    if (mode === "month") return new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + dir, 1));
    return new Date(Date.UTC(c.getUTCFullYear() + dir, c.getUTCMonth(), 1));
  });
  const goToday = () => { const d = new Date(); setCursor(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))); };

  const title = React.useMemo(() => {
    if (mode === "day") return cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    if (mode === "week") { const s = weekStart(cursor); const e = addDays(s, 6); const sameMonth = s.getUTCMonth() === e.getUTCMonth(); return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${e.toLocaleDateString("en-US", { month: sameMonth ? undefined : "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`; }
    if (mode === "month") return `${MONTHS[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
    return String(cursor.getUTCFullYear());
  }, [mode, cursor]);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            {(["day", "week", "month", "year"] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded px-2.5 py-1 font-medium capitalize transition", mode === m ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-muted")}>{m}</button>
            ))}
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={() => shift(-1)} className="rounded border border-border p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={goToday} className="rounded border border-border px-2 text-xs hover:bg-muted">Today</button>
            <button type="button" onClick={() => shift(1)} className="rounded border border-border p-1 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {mode === "day" ? <DayView day={cursor} byDay={byDay} todayKey={todayKey} onOpenItem={onOpenItem} />
        : mode === "week" ? <WeekView start={weekStart(cursor)} byDay={byDay} todayKey={todayKey} onOpenItem={onOpenItem} />
        : mode === "year" ? <YearView year={cursor.getUTCFullYear()} byDay={byDay} onPickMonth={(m) => { setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), m, 1))); setMode("month"); }} />
        : <MonthView cursor={cursor} byDay={byDay} todayKey={todayKey} onOpenItem={onOpenItem} />}
    </div>
  );
}

function weekStart(d: Date) { return addDays(d, -d.getUTCDay()); }

function EventChip({ it, onOpenItem }: { it: ScheduleItem; onOpenItem?: (i: ScheduleItem) => void }) {
  return (
    <button type="button" onClick={() => onOpenItem?.(it)} title={it.title} className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-white" style={{ background: it.kind === "milestone" ? "#9e6f2e" : scheduleColor(it.schedule_id, it.schedule_color) }}>
      {it.kind === "milestone" ? "◆ " : ""}{it.title}
    </button>
  );
}

function MonthView({ cursor, byDay, todayKey, onOpenItem }: { cursor: Date; byDay: Map<string, ScheduleItem[]>; todayKey: string; onOpenItem?: (i: ScheduleItem) => void }) {
  const first = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1));
  const start = addDays(first, -first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const k = key(d); const inMonth = d.getUTCMonth() === cursor.getUTCMonth(); const evs = byDay.get(k) ?? [];
          return (
            <div key={k} className={cn("min-h-[92px] rounded border border-border p-1", inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground/50", k === todayKey && "ring-1 ring-accent")}>
              <div className="text-[11px]">{d.getUTCDate()}</div>
              <div className="mt-0.5 space-y-0.5">
                {evs.slice(0, 4).map((it) => <EventChip key={it.id + k} it={it} onOpenItem={onOpenItem} />)}
                {evs.length > 4 ? <div className="px-1 text-[10px] text-muted-foreground">+{evs.length - 4} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekView({ start, byDay, todayKey, onOpenItem }: { start: Date; byDay: Map<string, ScheduleItem[]>; todayKey: string; onOpenItem?: (i: ScheduleItem) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const k = key(d); const evs = byDay.get(k) ?? [];
        return (
          <div key={k} className={cn("min-h-[220px] rounded border border-border p-1.5", k === todayKey && "ring-1 ring-accent")}>
            <div className="mb-1 text-center text-[11px] text-muted-foreground">{d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}</div>
            <div className="mb-1 text-center text-sm font-semibold">{d.getUTCDate()}</div>
            <div className="space-y-0.5">{evs.map((it) => <EventChip key={it.id + k} it={it} onOpenItem={onOpenItem} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ day, byDay, todayKey, onOpenItem }: { day: Date; byDay: Map<string, ScheduleItem[]>; todayKey: string; onOpenItem?: (i: ScheduleItem) => void }) {
  const k = key(day); const evs = byDay.get(k) ?? [];
  return (
    <div className={cn("rounded border border-border p-3", k === todayKey && "ring-1 ring-accent")}>
      {evs.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">Nothing scheduled for this day.</div> : (
        <div className="space-y-1.5">
          {evs.map((it) => (
            <button key={it.id} type="button" onClick={() => onOpenItem?.(it)} className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left hover:bg-muted/40">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: it.kind === "milestone" ? "#9e6f2e" : scheduleColor(it.schedule_id, it.schedule_color) }} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.kind === "milestone" ? "◆ " : ""}{it.title}</span>
              {it.schedule_name ? <span className="shrink-0 text-xs text-muted-foreground">{it.schedule_name}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function YearView({ year, byDay, onPickMonth }: { year: number; byDay: Map<string, ScheduleItem[]>; onPickMonth: (m: number) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const first = new Date(Date.UTC(year, m, 1));
        const start = addDays(first, -first.getUTCDay());
        const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
        let count = 0;
        for (let d = new Date(first); d.getUTCMonth() === m; d.setUTCDate(d.getUTCDate() + 1)) count += (byDay.get(key(d))?.length ?? 0);
        return (
          <button key={m} type="button" onClick={() => onPickMonth(m)} className="rounded-lg border border-border p-2 text-left transition hover:border-accent/40 hover:bg-accent/5">
            <div className="mb-1 flex items-center justify-between"><span className="text-sm font-semibold">{MONTHS[m]}</span>{count ? <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-medium text-accent">{count}</span> : null}</div>
            <div className="grid grid-cols-7 gap-[1px] text-center text-[8px] text-muted-foreground">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}</div>
            <div className="mt-0.5 grid grid-cols-7 gap-[2px]">
              {cells.map((d) => {
                const inMonth = d.getUTCMonth() === m; const has = inMonth && (byDay.get(key(d))?.length ?? 0) > 0;
                return <div key={key(d)} className={cn("aspect-square rounded-[2px] text-[8px] leading-[1.6]", !inMonth ? "text-transparent" : has ? "bg-accent text-white" : "text-muted-foreground/60")}>{inMonth ? d.getUTCDate() : "."}</div>;
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
