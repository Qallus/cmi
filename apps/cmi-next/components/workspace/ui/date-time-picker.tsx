"use client";

import * as React from "react";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Branded, theme-aware combined Date & Time field (no native browser UI).
// date = "YYYY-MM-DD", time = "HH:MM" (24h). Panel is position:fixed so it never
// gets clipped inside scroll containers (e.g. the Project Tracker table).

function ymd(d: Date) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`; }
function parse(s?: string) { if (!s) return null; const d = new Date(`${s}T00:00:00Z`); return isNaN(d.getTime()) ? null : d; }
function to12(v?: string) {
  if (!v || !/^\d{1,2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return { hour12: h % 12 === 0 ? 12 : h % 12, minute: m, period: (h >= 12 ? "PM" : "AM") as "AM" | "PM" };
}
function to24(hour12: number, minute: number, period: "AM" | "PM") {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function timeLabel(v?: string) { const p = to12(v); return p ? `${p.hour12}:${String(p.minute).padStart(2, "0")} ${p.period}` : ""; }

export function DateTimePicker({
  date, time, onChange, placeholder = "Set date & time…", className, dateOnly = false,
}: {
  date?: string;
  time?: string;
  onChange: (date: string, time: string) => void;
  placeholder?: string;
  className?: string;
  dateOnly?: boolean;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const selected = parse(date);
  const [cursor, setCursor] = React.useState(() => {
    const d = selected ?? new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  });

  React.useEffect(() => { const d = parse(date); if (d) setCursor(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))); }, [date]);

  React.useEffect(() => {
    if (!open || !wrapRef.current) { setPos(null); return; }
    const r = wrapRef.current.getBoundingClientRect();
    const width = 260;
    let left = Math.min(r.left, window.innerWidth - width - 8);
    left = Math.max(8, left);
    const top = Math.min(r.bottom + 6, window.innerHeight - 340);
    setPos({ top, left: left });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (wrapRef.current?.contains(t) || panelRef.current?.contains(t)) return; setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  const year = cursor.getUTCFullYear();
  const mon = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, mon, 1));
  const gridStart = new Date(first); gridStart.setUTCDate(1 - first.getUTCDay());
  const cells = Array.from({ length: 42 }, (_, k) => { const d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + k); return d; });
  const todayYmd = ymd(new Date());
  const parsedTime = to12(time) ?? { hour12: 9, minute: 0, period: "AM" as const };

  const dateLabel = selected ? selected.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "";
  const tLabel = timeLabel(time);
  const label = dateLabel ? (dateOnly ? dateLabel : `${dateLabel}${tLabel ? ` · ${tLabel}` : ""}`) : "";

  const setTime = (part: Partial<{ hour12: number; minute: number; period: "AM" | "PM" }>) => {
    const next = { ...parsedTime, ...part };
    onChange(date || todayYmd, to24(next.hour12, next.minute, next.period));
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn("flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-background px-2 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring", !label && "text-muted-foreground", className)}
      >
        <span className="truncate">{label || placeholder}</span>
        <CalendarClock className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </button>

      {open && pos ? (
        <div ref={panelRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: 260 }} className="z-50 rounded-md border bg-popover p-2 text-popover-foreground shadow-lg">
          <div className="mb-1 flex items-center justify-between">
            <button type="button" onClick={() => setCursor(new Date(Date.UTC(year, mon - 1, 1)))} className="rounded p-1 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-sm font-medium">{cursor.toLocaleDateString([], { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            <button type="button" onClick={() => setCursor(new Date(Date.UTC(year, mon + 1, 1)))} className="rounded p-1 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const inMonth = d.getUTCMonth() === mon;
              const cy = ymd(d);
              const isSel = date === cy;
              const isToday = cy === todayYmd;
              return (
                <button key={cy} type="button" onClick={() => { onChange(cy, dateOnly ? "" : (time || "")); if (dateOnly) setOpen(false); }}
                  className={cn("h-7 rounded text-xs transition-colors", isSel ? "bg-accent text-accent-foreground" : isToday ? "border border-accent text-accent" : inMonth ? "hover:bg-accent" : "text-muted-foreground/50 hover:bg-accent")}>
                  {d.getUTCDate()}
                </button>
              );
            })}
          </div>

          {!dateOnly ? (
            <div className="mt-2 border-t pt-2">
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Time</span>
                <span className="text-xs text-muted-foreground">{tLabel || "—"}</span>
              </div>
              <div className="flex gap-1">
                <TimeColumn items={Array.from({ length: 12 }, (_, i) => ({ v: i + 1, l: String(i + 1) }))} selected={parsedTime.hour12} onPick={(v) => setTime({ hour12: v })} />
                <TimeColumn items={Array.from({ length: 60 }, (_, i) => ({ v: i, l: String(i).padStart(2, "0") }))} selected={parsedTime.minute} onPick={(v) => setTime({ minute: v })} />
                <div className="flex w-12 shrink-0 flex-col gap-0.5">
                  {(["AM", "PM"] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setTime({ period: p })} className={cn("rounded px-2 py-1 text-xs transition-colors", parsedTime.period === p ? "bg-accent text-accent-foreground" : "hover:bg-accent")}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex justify-between px-0.5 text-xs">
            <button type="button" onClick={() => { onChange("", ""); setOpen(false); }} className="text-muted-foreground hover:text-foreground">Clear</button>
            <button type="button" onClick={() => setOpen(false)} className="font-medium text-accent hover:underline">Done</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimeColumn({ items, selected, onPick }: { items: { v: number; l: string }[]; selected: number; onPick: (v: number) => void }) {
  return (
    <div className="flex max-h-28 flex-1 flex-col gap-0.5 overflow-y-auto">
      {items.map((it) => (
        <button key={it.v} type="button" onClick={() => onPick(it.v)} className={cn("rounded px-2 py-1 text-center text-xs transition-colors", selected === it.v ? "bg-accent text-accent-foreground" : "hover:bg-accent")}>{it.l}</button>
      ))}
    </div>
  );
}
