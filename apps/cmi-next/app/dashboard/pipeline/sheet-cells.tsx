"use client";

// Spreadsheet cells for the Pipeline Table view. Every editable cell is a real
// input, so Tab / Shift+Tab move across a row the way a spreadsheet does,
// Enter saves and drops to the same column on the next row, ↑/↓ move between
// rows, and Esc puts the value back. A change saves when you leave the cell;
// a failed save reverts the cell and shows why.
import * as React from "react";
import { cn } from "@/lib/utils";

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
export function SheetInput({ row, col, label, disabled, value, type = "text", align, save, placeholder }: Base & {
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

/** Dropdown cell: saves as soon as a new option is picked. */
export function SheetSelect({ row, col, label, disabled, value, options, save }: Base & {
  value: string; options: { value: string; label: string }[]; save: Save;
}) {
  const s = useSaving(save);
  const opts = value && !options.some((o) => o.value === value) ? [{ value, label: value }, ...options] : options;
  return (
    <Wrap busy={s.busy} error={s.error}>
      <select
        key={value}
        defaultValue={value}
        aria-label={label}
        disabled={disabled}
        data-row={row} data-col={col}
        className={cn(CELL, "cursor-pointer pr-6")}
        onChange={async (e) => {
          const el = e.currentTarget;
          const err = await s.run(el.value);
          if (err) el.value = value;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); focusCell(e.currentTarget, row + (e.shiftKey ? -1 : 1), col); }
        }}
      >
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}
