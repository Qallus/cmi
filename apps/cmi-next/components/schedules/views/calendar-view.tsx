"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { scheduleColor } from "../shared";
import type { ScheduleItem } from "@/lib/schedules/types";

function parse(iso?: string | null) { if (!iso) return null; const d = new Date(`${iso}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }
function key(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; }

// Places each item on every day it spans (start..end), clamped to the month grid.
export function CalendarView({ items, onOpenItem }: { items: ScheduleItem[]; onOpenItem?: (i: ScheduleItem) => void }) {
  const [cursor, setCursor] = React.useState(() => { const d = new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });

  const byDay = React.useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const s = parse(it.start_date); if (!s) continue;
      const e = parse(it.end_date) ?? s;
      const d = new Date(s);
      let guard = 0;
      while (d <= e && guard++ < 400) { const k = key(d); (map.get(k) ?? map.set(k, []).get(k)!).push(it); d.setUTCDate(d.getUTCDate() + 1); }
    }
    return map;
  }, [items]);

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
  const start = new Date(first); start.setUTCDate(1 - first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d; });
  const todayKey = key(new Date());
  const shift = (delta: number) => setCursor((c) => { const m = c.m + delta; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} className="rounded border border-border p-1 hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(() => { const d = new Date(); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; })} className="rounded border border-border px-2 text-xs hover:bg-muted">Today</button>
          <button type="button" onClick={() => shift(1)} className="rounded border border-border p-1 hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const k = key(d); const inMonth = d.getUTCMonth() === cursor.m; const evs = byDay.get(k) ?? [];
          return (
            <div key={k} className={cn("min-h-[92px] rounded border border-border p-1", inMonth ? "bg-background" : "bg-muted/20 text-muted-foreground/50", k === todayKey && "ring-1 ring-accent")}>
              <div className="text-[11px]">{d.getUTCDate()}</div>
              <div className="mt-0.5 space-y-0.5">
                {evs.slice(0, 4).map((it) => (
                  <button key={it.id + k} type="button" onClick={() => onOpenItem?.(it)} title={it.title} className="block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-white" style={{ background: it.kind === "milestone" ? "#9e6f2e" : scheduleColor(it.schedule_id, it.schedule_color) }}>
                    {it.kind === "milestone" ? "◆ " : ""}{it.title}
                  </button>
                ))}
                {evs.length > 4 ? <div className="px-1 text-[10px] text-muted-foreground">+{evs.length - 4} more</div> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
