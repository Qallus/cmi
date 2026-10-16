"use client";

// Branded date field for dashboard forms, in place of the browser's native
// calendar: CMI accent colors in light and dark mode. The calendar renders in
// a portal so scrolling panels and modals never clip it.
// value / onChange use "YYYY-MM-DD" ("" when cleared).
import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function todayYmd(): string {
  const n = new Date();
  return ymd(n.getFullYear(), n.getMonth(), n.getDate());
}
function parse(s?: string | null): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  return m ? { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) } : null;
}

export function DateField({
  value, onChange, placeholder = "Pick a date", min, allowClear = true, className, title,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Earliest selectable day, YYYY-MM-DD. */
  min?: string;
  allowClear?: boolean;
  className?: string;
  title?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const sel = parse(value);
  const [cursor, setCursor] = React.useState(() => {
    const base = sel ?? parse(todayYmd())!;
    return { y: base.y, m: base.m };
  });

  const place = React.useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 272, height = 320;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const below = r.bottom + 4;
    const top = below + height > window.innerHeight ? Math.max(8, r.top - height - 4) : below;
    setPos({ top, left });
  }, []);

  function toggle() {
    if (!open) {
      const base = sel ?? parse(todayYmd())!;
      setCursor({ y: base.y, m: base.m });
      place();
    }
    setOpen((o) => !o);
  }

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } }
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onEsc, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const { y, m } = cursor;
  const firstDow = new Date(y, m, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, k) => {
    const d = new Date(y, m, 1 - firstDow + k);
    return { key: ymd(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), inMonth: d.getMonth() === m };
  });
  const today = todayYmd();
  const label = sel ? new Date(sel.y, sel.m, sel.d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const shift = (delta: number) => setCursor(({ y: cy, m: cm }) => { const d = new Date(cy, cm + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={title}
        onClick={toggle}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-sm outline-none transition focus:border-accent",
          open && "border-accent",
          !sel && "text-muted-foreground",
          className,
        )}
      >
        <span className="truncate">{label || placeholder}</span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-accent/70" />
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popRef} style={{ top: pos.top, left: pos.left }} className="fixed z-[200] w-[272px] rounded-xl border border-border bg-card p-3 text-card-foreground shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-display text-sm font-semibold">{new Date(y, m, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
            <button type="button" onClick={() => shift(1)} className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((c) => {
              const isSel = value === c.key;
              const isToday = c.key === today;
              const disabled = !!min && c.key < min;
              return (
                <button
                  key={c.key}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(c.key); setOpen(false); }}
                  className={cn(
                    "h-8 rounded-md text-xs transition",
                    disabled ? "cursor-not-allowed text-muted-foreground/30"
                      : isSel ? "bg-accent font-semibold text-accent-foreground"
                      : isToday ? "border border-accent font-semibold text-accent hover:bg-accent/10"
                      : c.inMonth ? "text-foreground hover:bg-accent/10 hover:text-accent"
                      : "text-muted-foreground/50 hover:bg-muted",
                  )}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border px-1 pt-2 text-xs">
            {allowClear ? (
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="text-muted-foreground hover:text-foreground">Clear</button>
            ) : <span />}
            <button type="button" disabled={!!min && today < min} onClick={() => { onChange(today); setOpen(false); }} className="font-medium text-accent hover:underline disabled:opacity-40">Today</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
