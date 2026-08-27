"use client";

import * as React from "react";
import { ChevronDown, Check, X, Search } from "lucide-react";

export type ComboOption = { value: string; label: string; sublabel?: string };

function useOutside(ref: React.RefObject<HTMLElement | null>, onOut: () => void) {
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onOut]);
}

function match(o: ComboOption, q: string) {
  const s = `${o.label} ${o.sublabel ?? ""}`.toLowerCase();
  return q.trim() === "" || s.includes(q.trim().toLowerCase());
}

// Single-choice searchable dropdown.
export function SearchableSelect({
  options, value, onChange, placeholder = "— Choose —", className,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = options.filter((o) => match(o, q));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQ(""); }}
        className={className ?? "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-sm outline-none focus:border-accent"}
      >
        <span className={selected ? "truncate" : "truncate text-muted-foreground"}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches.</div>
            ) : filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted ${o.value === value ? "text-accent" : ""}`}
              >
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.sublabel && <span className="block truncate text-xs text-muted-foreground">{o.sublabel}</span>}
                </span>
                {o.value === value && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Multi-choice searchable dropdown with chips for the current selection.
export function SearchableMultiSelect({
  options, values, onChange, placeholder = "Search to add…",
}: {
  options: ComboOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const byValue = React.useMemo(() => new Map(options.map((o) => [o.value, o])), [options]);
  const filtered = options.filter((o) => !values.includes(o.value) && match(o, q));

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  return (
    <div ref={ref} className="relative">
      <div
        className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus-within:border-accent"
        onClick={() => setOpen(true)}
      >
        {values.map((v) => {
          const o = byValue.get(v);
          return (
            <span key={v} className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-0.5 pl-2.5 pr-1 text-xs font-medium text-accent">
              {o?.label ?? v}
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(v); }} className="rounded-full p-0.5 hover:bg-accent/20" aria-label={`Remove ${o?.label ?? v}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[100px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-xl">
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { toggle(o.value); setQ(""); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-muted"
            >
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                {o.sublabel && <span className="block truncate text-xs text-muted-foreground">{o.sublabel}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
