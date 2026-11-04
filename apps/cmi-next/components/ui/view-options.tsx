"use client";

// Page toolbar pieces shared by the list pages (Contacts, Pipeline, …) so every
// header reads the same: search on the left, filters, then "View options" and
// the icon-only view switcher on the far right.
import * as React from "react";
import { ChevronDown, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export type ColumnDef<K extends string> = { key: K; label: string; default: boolean };

/**
 * Which optional columns a person shows, remembered in this browser. Columns
 * that aren't in `all` any more are dropped; new ones start at their default.
 */
export function useColumnPrefs<K extends string>(storageKey: string, all: ColumnDef<K>[]) {
  const defaults = React.useMemo(() => all.filter((c) => c.default).map((c) => c.key), [all]);
  const [columns, setState] = React.useState<K[]>(defaults);
  React.useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as unknown;
      // eslint-disable-next-line -- one-time restore of the saved preference on mount
      if (Array.isArray(saved)) setState(all.map((c) => c.key).filter((k) => saved.includes(k)));
    } catch { /* private window or bad value: keep defaults */ }
  }, [storageKey, all]);
  const setColumns = React.useCallback((next: K[]) => {
    setState(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* fine */ }
  }, [storageKey]);
  return { columns, setColumns, defaults };
}

/** "View options": tick the table's columns, with a reset to the defaults. */
export function ViewOptions<K extends string>({
  all, columns, onChange, defaults, pinned = ["Name"], disabled, disabledHint = "View options apply to the table views",
}: {
  all: ColumnDef<K>[];
  columns: K[];
  onChange: (next: K[]) => void;
  defaults: K[];
  /** Always-shown columns, listed greyed out at the top. */
  pinned?: string[];
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const toggle = (key: K) => onChange(columns.includes(key) ? columns.filter((k) => k !== key) : all.map((c) => c.key).filter((k) => k === key || columns.includes(k)));

  return (
    <div ref={ref} className="relative">
      <Tooltip label={disabled ? disabledHint : "Choose which columns the table shows"} side="bottom" className="inline-block">
        <button
          type="button" disabled={disabled} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          View options
          <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{columns.length + pinned.length}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </Tooltip>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Columns</p>
          {pinned.map((p) => (
            <label key={p} className="flex cursor-not-allowed items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked disabled className="h-4 w-4 accent-[var(--accent)]" /> {p}
            </label>
          ))}
          {all.map((col) => (
            <label key={col.key} role="menuitemcheckbox" aria-checked={columns.includes(col.key)} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted">
              <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={columns.includes(col.key)} onChange={() => toggle(col.key)} />
              {col.label}
            </label>
          ))}
          <div className="mt-1 border-t border-border px-3 pb-1 pt-1.5">
            <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => onChange(defaults)}>Reset to default</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Icon-only view switcher (each icon has a tooltip with its name). */
export function ViewSwitcher<V extends string>({ views, value, onChange }: {
  views: { key: V; label: string; icon: LucideIcon }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label="View">
      {views.map(({ key, label, icon: Icon }) => (
        <Tooltip key={key} label={label} side="bottom" className="inline-block">
          <button type="button" role="tab" aria-selected={value === key} aria-label={label} onClick={() => onChange(key)}
            className={cn("inline-flex h-7 w-7 items-center justify-center rounded", value === key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
