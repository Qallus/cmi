"use client";

// Shared pieces for dashboard list views: sortable column headers, row
// checkboxes, and the floating quick-action bar that appears once rows are
// selected. Modelled on the Pipeline list (pipeline-deals-client.tsx /
// bulk-bar.tsx) so every list sorts and selects the same way.
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export type SortState<K extends string = string> = { key: K | null; dir: SortDir; onSort: (key: K) => void };
type SortValue = string | number | boolean | null | undefined;

/**
 * Client-side sorting. `accessors` maps each sortable column key to the value
 * it sorts by. First click sorts ascending, a second click flips it. Blank
 * values always sort last; text compares naturally ("26_9" before "26_10").
 */
export function useSort<T, K extends string>(rows: T[], accessors: Record<K, (row: T) => SortValue>, initial?: { key: K; dir?: SortDir }) {
  const [key, setKey] = React.useState<K | null>(initial?.key ?? null);
  const [dir, setDir] = React.useState<SortDir>(initial?.dir ?? "asc");
  const onSort = React.useCallback((k: K) => {
    if (k === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setKey(k); setDir("asc"); }
  }, [key]);
  const sorted = React.useMemo(() => {
    if (!key) return rows;
    const get = accessors[key];
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const xe = x == null || x === "", ye = y == null || y === "";
      if (xe || ye) return xe === ye ? 0 : xe ? 1 : -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
      return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * sign;
    });
    // accessors are expected to be stable per render; re-sorting on rows/key/dir is enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, key, dir]);
  const state: SortState<K> = { key, dir, onSort };
  return { sorted, sort: state };
}

/** A column header you can sort by. The arrow always shows, muted until active. */
export function SortableTh<K extends string>({ label, sortKey, sort, className, align = "left" }: {
  label: string; sortKey?: K; sort?: SortState<K>; className?: string; align?: "left" | "right";
}) {
  const base = cn("px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", align === "right" && "text-right", className);
  if (!sort || !sortKey) return <th className={base}>{label}</th>;
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={base} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => sort.onSort(sortKey)} aria-label={`Sort by ${label}`}
        className={cn("inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase transition hover:bg-muted hover:text-foreground", align === "right" && "flex-row-reverse", active && "bg-accent/10 text-accent")}>
        {label}
        <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-accent" : "text-muted-foreground/60")} />
      </button>
    </th>
  );
}

/**
 * Row selection for the rows currently shown. Rows filtered out of view drop
 * out of the selection, so a bulk action never touches something you can't see.
 */
export function useRowSelection(visibleIds: string[]) {
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const visible = React.useMemo(() => new Set(visibleIds), [visibleIds]);
  const ids = React.useMemo(() => new Set(Array.from(picked).filter((id) => visible.has(id))), [picked, visible]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => ids.has(id));
  const toggleOne = React.useCallback((id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const toggleAll = React.useCallback(() => setPicked(allChecked ? new Set() : new Set(visibleIds)), [allChecked, visibleIds]);
  const clear = React.useCallback(() => setPicked(new Set()), []);
  return { ids, list: Array.from(ids), count: ids.size, allChecked, someChecked: ids.size > 0 && !allChecked, toggleOne, toggleAll, clear };
}
export type RowSelection = ReturnType<typeof useRowSelection>;

/** Header "select all" checkbox cell. */
export function HeaderCheckbox({ selection, label = "Select all" }: { selection: RowSelection; label?: string }) {
  const ref = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = selection.someChecked; }, [selection.someChecked]);
  return (
    <th className="w-8 px-2 py-2">
      <input ref={ref} type="checkbox" aria-label={label} checked={selection.allChecked} onChange={selection.toggleAll} className="h-4 w-4 accent-[var(--accent)]" />
    </th>
  );
}

/** Row checkbox cell. Clicking it never opens the row. */
export function RowCheckbox({ id, selection, label = "Select row" }: { id: string; selection: RowSelection; label?: string }) {
  return (
    <td className="w-8 px-2" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" aria-label={label} checked={selection.ids.has(id)} onChange={() => selection.toggleOne(id)} className="h-4 w-4 accent-[var(--accent)]" />
    </td>
  );
}

/** Floating quick-action bar, shown while rows are selected. */
export function SelectionBar({ count, noun = "item", onClear, children, panel }: {
  count: number; noun?: string; onClear: () => void; children: React.ReactNode; panel?: React.ReactNode;
}) {
  if (!count) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-xl">
        {panel}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="px-2 text-xs font-medium">{count} {noun}{count === 1 ? "" : "s"} selected</span>
          {children}
          <button type="button" onClick={onClear} title="Clear selection" aria-label="Clear selection" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

/** A button in the SelectionBar. */
export function BarAction({ icon: Icon, label, onClick, active, danger, disabled }: {
  icon: LucideIcon; label: string; onClick: () => void; active?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted",
        danger && "border-destructive/30 text-destructive hover:bg-destructive/10",
      )}>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
