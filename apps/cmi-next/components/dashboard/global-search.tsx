"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import type { SearchHit } from "@/app/api/search/route";
import { cn } from "@/lib/utils";

/**
 * Top-bar dashboard search. Debounced queries hit /api/search and render a
 * grouped results dropdown; picking a result navigates to it.
 *
 * It also re-broadcasts the term on the existing `cmi-dashboard-search` window
 * event, so pages that filter their own list in place (e.g. Contacts) keep
 * working exactly as before.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const broadcast = React.useCallback((v: string) => {
    window.dispatchEvent(new CustomEvent("cmi-dashboard-search", { detail: { value: v } }));
  }, []);

  // Debounced fetch.
  React.useEffect(() => {
    const term = value.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits?: SearchHit[] }) => { setHits(d.hits ?? []); setActive(0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value]);

  // Close on outside click / Escape; Cmd/Ctrl-K focuses.
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); window.removeEventListener("keydown", onKey); };
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setValue("");
    broadcast("");
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) go(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  // Group hits in a stable order for rendering.
  const groups = React.useMemo(() => {
    const order: SearchHit["group"][] = ["Contacts", "Jobs", "Documents"];
    return order
      .map((g) => ({ group: g, items: hits.filter((h) => h.group === g) }))
      .filter((g) => g.items.length > 0);
  }, [hits]);

  const showDropdown = open && value.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <label className="flex h-8 w-56 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground focus-within:border-accent focus-within:ring-2 focus-within:ring-ring">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setOpen(true); broadcast(e.target.value); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search contacts, jobs, docs…"
          aria-label="Search the dashboard"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border border-border px-1 text-[9px] text-muted-foreground lg:inline">⌘K</kbd>
      </label>

      {showDropdown && (
        <div id="global-search-results" role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] w-[min(92vw,420px)] overflow-auto rounded-lg border border-border bg-card p-1.5 shadow-2xl">
          {groups.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {loading ? "Searching…" : `No results for “${value.trim()}”.`}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.group} className="mb-1 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.group}</div>
                {g.items.map((hit) => {
                  const idx = hits.indexOf(hit);
                  return (
                    <button
                      key={`${hit.group}-${hit.id}`}
                      type="button"
                      role="option"
                      aria-selected={idx === active}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => go(hit)}
                      className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left", idx === active ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{hit.title}</span>
                        {hit.subtitle && <span className={cn("block truncate text-[11px]", idx === active ? "text-accent-foreground/80" : "text-muted-foreground")}>{hit.subtitle}</span>}
                      </span>
                      {idx === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
