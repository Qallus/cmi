"use client";

// Spreadsheet cells for the Pipeline Table view. Every editable cell is a real
// input, so Tab / Shift+Tab move across a row the way a spreadsheet does,
// Enter saves and drops to the same column on the next row, ↑/↓ move between
// rows, and Esc puts the value back. A change saves when you leave the cell;
// a failed save reverts the cell and shows why.
import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateField } from "@/components/ui/date-field";

type Save = (raw: string) => Promise<string | null>;
type Base = { row: number; col: number; label: string; disabled?: boolean };

const CELL = "h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-sm outline-none transition focus:bg-background focus:ring-2 focus:ring-inset focus:ring-accent disabled:cursor-default";

/** Focus the cell at (row, col) in the same sheet, if there is one. */
function focusCell(from: HTMLElement, row: number, col: number) {
  const sheet = from.closest("[data-sheet]");
  const next = sheet?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`);
  if (next) { next.focus(); if (next instanceof HTMLInputElement) next.select(); }
}

function useSaving(save: Save) {
  const [state, setState] = React.useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  React.useEffect(() => {
    if (!state.error) return;
    const t = setTimeout(() => setState((s) => ({ ...s, error: null })), 5000);
    return () => clearTimeout(t);
  }, [state.error]);
  const run = React.useCallback(async (raw: string) => {
    setState({ busy: true, error: null });
    const error = await save(raw);
    setState({ busy: false, error });
    return error;
  }, [save]);
  return { ...state, run };
}

function Wrap({ busy, error, children }: { busy: boolean; error: string | null; children: React.ReactNode }) {
  return (
    <div className={cn("relative", busy && "opacity-60", error && "ring-2 ring-inset ring-destructive")} title={error ?? undefined}>
      {children}
      {error ? <div className="absolute left-0 top-full z-20 mt-0.5 max-w-[260px] rounded bg-destructive px-2 py-1 text-[11px] text-destructive-foreground shadow">{error}</div> : null}
    </div>
  );
}

/** Text, number or date cell. `value` is the saved value as text. */
export function SheetInput(props: Base & {
  value: string; type?: "text" | "number" | "date"; align?: "right"; save: Save; placeholder?: string;
}) {
  // Dates use the dashboard's own calendar, not the browser's.
  return props.type === "date" ? <SheetDate {...props} /> : <SheetText {...props} />;
}

function SheetText({ row, col, label, disabled, value, type = "text", align, save, placeholder }: Base & {
  value: string; type?: "text" | "number" | "date"; align?: "right"; save: Save; placeholder?: string;
}) {
  const s = useSaving(save);
  // Uncontrolled and keyed by the saved value: a fresh value from the server
  // resets the cell, but typing never fights a re-render.
  return (
    <Wrap busy={s.busy} error={s.error}>
      <input
        key={value}
        defaultValue={value}
        type={type}
        inputMode={type === "number" ? "decimal" : undefined}
        aria-label={label}
        placeholder={placeholder}
        disabled={disabled}
        data-row={row} data-col={col}
        className={cn(CELL, align === "right" && "text-right tabular-nums", type === "date" && "pr-1")}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={async (e) => {
          const el = e.currentTarget;
          if (el.value === value) return;
          const err = await s.run(el.value);
          if (err) el.value = value;
        }}
        onKeyDown={(e) => {
          const el = e.currentTarget;
          if (e.key === "Escape") { el.value = value; el.blur(); }
          else if (e.key === "Enter") { e.preventDefault(); focusCell(el, row + (e.shiftKey ? -1 : 1), col); if (document.activeElement === el) el.blur(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(el, row + 1, col); }
          else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(el, row - 1, col); }
        }}
      />
    </Wrap>
  );
}

/** Date cell: the dashboard calendar; saves when a day is picked or cleared. */
function SheetDate({ row, col, label, disabled, value, save }: Base & { value: string; save: Save }) {
  const s = useSaving(save);
  // A fresh value from the server resets what the cell shows.
  const [shown, setShown] = React.useState(value);
  const [seen, setSeen] = React.useState(value);
  if (value !== seen) { setSeen(value); setShown(value); }
  return (
    <Wrap busy={s.busy} error={s.error}>
      <DateField
        value={shown}
        placeholder="—"
        icon={false}
        onChange={async (v) => { setShown(v); const err = await s.run(v); if (err) setShown(value); }}
        className={cn(CELL, "h-8 justify-start border-0 px-2 focus:ring-2 focus:ring-inset focus:ring-accent", !shown && "text-muted-foreground")}
        triggerProps={{
          "aria-label": label, disabled, "data-row": row, "data-col": col,
          onKeyDown: (e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); focusCell(e.currentTarget, row + 1, col); }
            else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(e.currentTarget, row - 1, col); }
          },
        }}
      />
    </Wrap>
  );
}

/** Dropdown cell: a themed option list; saves as soon as a new option is picked.
 *  Space / Enter / Alt+Down open it, Up / Down move, Enter picks, Esc closes,
 *  typing a letter jumps to the first option that starts with it. */
export function SheetSelect({ row, col, label, disabled, value, options, save }: Base & {
  value: string; options: { value: string; label: string }[]; save: Save;
}) {
  const s = useSaving(save);
  const opts = value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options;
  // A fresh value from the server resets what the cell shows.
  const [shown, setShown] = React.useState(value);
  const [seen, setSeen] = React.useState(value);
  if (value !== seen) { setSeen(value); setShown(value); }
  const [open, setOpen] = React.useState(false);
  const [hi, setHi] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const btn = React.useRef<HTMLButtonElement>(null);
  const list = React.useRef<HTMLDivElement>(null);
  const current = opts.find((o) => o.value === shown);

  const openList = () => {
    if (disabled || !btn.current) return;
    setRect(btn.current.getBoundingClientRect());
    setHi(Math.max(0, opts.findIndex((o) => o.value === shown)));
    setOpen(true);
  };
  const pick = async (v: string) => {
    setOpen(false);
    btn.current?.focus();
    if (v === shown) return;
    setShown(v);
    const err = await s.run(v);
    if (err) setShown(value);
  };
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (!btn.current?.contains(t) && !list.current?.contains(t)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { document.removeEventListener("mousedown", onDoc); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);
  React.useEffect(() => { if (open) list.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, hi]);

  const below = rect ? window.innerHeight - rect.bottom > Math.min(opts.length, 8) * 32 + 16 : true;
  return (
    <Wrap busy={s.busy} error={s.error}>
      <button
        ref={btn} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} disabled={disabled}
        data-row={row} data-col={col}
        className={cn(CELL, "flex cursor-pointer items-center justify-between gap-1 text-left", !current?.value && "text-muted-foreground")}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(opts.length - 1, h + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
            else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void pick(opts[hi].value); }
            else if (e.key === "Escape" || e.key === "Tab") { setOpen(false); }
            else if (e.key.length === 1) { const i = opts.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase())); if (i >= 0) setHi(i); }
            return;
          }
          if (e.key === " " || e.key === "Enter" || (e.altKey && e.key === "ArrowDown")) { e.preventDefault(); openList(); }
          else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(e.currentTarget, row + 1, col); }
          else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(e.currentTarget, row - 1, col); }
        }}
      >
        <span className="truncate">{current?.label ?? "—"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && rect && typeof document !== "undefined" ? createPortal(
        <div ref={list} role="listbox" aria-label={label}
          className="fixed z-[9999] max-h-64 min-w-[160px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          style={{ left: rect.left, width: Math.max(rect.width, 160), ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }) }}>
          {opts.map((o, i) => (
            <button key={o.value || "_none"} type="button" role="option" aria-selected={o.value === shown} data-i={i} tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); void pick(o.value); }} onMouseEnter={() => setHi(i)}
              className={cn("flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left", i === hi ? "bg-accent/15 text-foreground" : "hover:bg-muted/60")}>
              <span className="truncate">{o.label}</span>
              {o.value === shown ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </Wrap>
  );
}
