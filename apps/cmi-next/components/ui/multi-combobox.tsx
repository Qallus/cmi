"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = { id: string; label: string };

// Branded searchable combobox. Multi-select by default; pass single to limit to one.
export function MultiCombobox({
  options, value, onChange, placeholder = "Search…", single = false,
}: {
  options: ComboOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  single?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const byId = React.useMemo(() => new Map(options.map((o) => [o.id, o.label])), [options]);
  const selected = value.filter((id) => byId.has(id));
  const q = query.toLowerCase();
  const matches = options.filter((o) => !value.includes(o.id) && o.label.toLowerCase().includes(q)).slice(0, 50);

  function add(id: string) {
    onChange(single ? [id] : Array.from(new Set([...value, id])));
    setQuery("");
    if (single) setOpen(false);
  }
  function remove(id: string) { onChange(value.filter((v) => v !== id)); }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 text-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-ring"
        onClick={() => setOpen(true)}
      >
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
            {byId.get(id)}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(id); }} className="hover:text-foreground"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length ? "" : placeholder}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {matches.length === 0 ? (
            <div className="px-2 py-2 text-xs text-muted-foreground">{options.length ? "No matches." : "No options."}</div>
          ) : matches.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => add(o.id)}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent/10"
            >
              {o.label}
              <Check className="h-3.5 w-3.5 opacity-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
