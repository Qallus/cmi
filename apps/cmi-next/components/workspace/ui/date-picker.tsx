"use client";

import * as React from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Branded, theme-aware date picker (no native browser calendar).
// value / onChange use "YYYY-MM-DD".
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function parse(s?: string) { if (!s) return null; const d = new Date(`${s}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }

export function DatePicker({
  value, onChange, placeholder = "Pick a date", className, allowClear = true,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const selected = parse(value);
  const [cursor, setCursor] = React.useState(() => {
    const d = selected ?? new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });

  React.useEffect(() => {
    const d = parse(value);
    if (d) setCursor(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
  }, [value]);

  React.useEffect(() => {
    function onDoc(e: MouseEvent) { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    if (open) { document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onEsc); }
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const year = cursor.getUTCFullYear();
  const mon = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, mon, 1));
  const gridStart = new Date(first); gridStart.setUTCDate(1 - first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, k) => { const d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + k); return d; });
  const todayYmd = ymd(new Date());
  const label = selected ? selected.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "";

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring",
          !selected && "text-muted-foreground",
          className,
        )}
      >
        <span>{label || placeholder}</span>
        <CalendarIcon className="h-4 w-4 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-64 rounded-md border bg-popover p-2 text-popover-foreground shadow-md">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" onClick={() => setCursor(new Date(Date.UTC(year, mon - 1, 1)))} className="rounded p-1 hover:bg-accent hover:text-accent-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium">{cursor.toLocaleDateString([], { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            <button type="button" onClick={() => setCursor(new Date(Date.UTC(year, mon + 1, 1)))} className="rounded p-1 hover:bg-accent hover:text-accent-foreground"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const inMonth = d.getUTCMonth() === mon;
              const cy = ymd(d);
              const isSel = value === cy;
              const isToday = cy === todayYmd;
              return (
                <button
                  key={cy}
                  type="button"
                  onClick={() => { onChange(cy); setOpen(false); }}
                  className={cn(
                    "h-7 rounded text-xs transition-colors",
                    isSel ? "bg-accent text-accent-foreground" : isToday ? "border border-accent text-accent" : inMonth ? "hover:bg-accent hover:text-accent-foreground" : "text-muted-foreground/50 hover:bg-accent",
                  )}
                >
                  {d.getUTCDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between px-1 text-xs">
            {allowClear ? (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-muted-foreground hover:text-foreground">Clear</button>
            ) : <span />}
            <button type="button" onClick={() => { onChange(todayYmd); setOpen(false); }} className="font-medium text-accent hover:underline">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}
