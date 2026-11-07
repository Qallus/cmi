"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { SEARCH_GROUPS, type SearchHit } from "@/lib/search/types";
import { NAV_ITEMS, type UserRole } from "./nav";
import { cn } from "@/lib/utils";

/**
 * Top-bar dashboard search. Debounced queries hit /api/search and render a
 * grouped results list; picking a result navigates to it.
 *
 * Two ways in, one engine:
 *   <GlobalSearch />          the box in the top bar (768px and up)
 *   <MobileSearchToggle /> +  on phones (under 768px), a top-bar button that
 *   <MobileSearchPanel />     slides a search field down below the bar
 *
 * It also re-broadcasts the term on the existing `cmi-dashboard-search` window
 * event, so pages that filter their own list in place (e.g. Contacts) keep
 * working exactly as before.
 */
const PLACEHOLDER = "Search Constructed Matter";

type Page = { href: string; label: string; parent: string | null; roles?: UserRole[]; flag?: string };
// Every page in the sidebar, flattened (children carry their parent's name).
const PAGES: Page[] = NAV_ITEMS.flatMap((i) => (i.href ? [
  { href: i.href, label: i.label!, parent: null, roles: i.roles, flag: i.flag },
  ...(i.children ?? []).map((c) => ({ href: c.href, label: c.label, parent: i.label!, roles: c.roles ?? i.roles, flag: c.flag ?? i.flag })),
] : []));

// "Go to": sidebar pages this person can open (same roles, feature switches and
// hidden items as the sidebar) whose name contains every word typed.
function usePages(role: UserRole) {
  const [allowed, setAllowed] = React.useState<{ flags: Record<string, boolean>; hidden: Set<string> } | null>(null);
  const load = React.useCallback(() => {
    if (allowed) return;
    Promise.all([
      fetch("/api/flags").then((r) => r.json()).catch(() => ({})),
      fetch("/api/nav-settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([f, n]: [{ flags?: Record<string, boolean> }, { hidden?: string[] }]) => setAllowed({ flags: f.flags ?? {}, hidden: new Set(n.hidden ?? []) }));
  }, [allowed]);
  const match = React.useCallback((term: string): SearchHit[] => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !allowed) return [];
    return PAGES.filter((p) => (!p.roles || p.roles.includes(role)) && (!p.flag || allowed.flags[p.flag]) && !allowed.hidden.has(p.href) && p.href !== "/")
      .filter((p) => { const hay = `${p.label} ${p.parent ?? ""}`.toLowerCase(); return words.every((w) => hay.includes(w)); })
      .slice(0, 5).map((p) => ({ id: p.href, group: "Go to" as const, title: p.label, subtitle: p.parent ? `${p.parent} → ${p.label}` : "Dashboard page", href: p.href }));
  }, [allowed, role]);
  return { load, match };
}

function useSearch(role: UserRole) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const pages = usePages(role);
  const [found, setFound] = React.useState<SearchHit[]>([]);

  const broadcast = React.useCallback((v: string) => {
    window.dispatchEvent(new CustomEvent("cmi-dashboard-search", { detail: { value: v } }));
  }, []);

  // Debounced fetch.
  React.useEffect(() => {
    const term = value.trim();
    if (term.length < 2) { setFound([]); setLoading(false); return; }
    setLoading(true);
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits?: SearchHit[] }) => { setFound(d.hits ?? []); setActive(0); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value]);

  // Pages first ("Go to"), then the records, in the group order.
  const hits = React.useMemo(() => {
    const term = value.trim();
    return term.length < 2 ? [] : [...pages.match(term), ...found];
  }, [value, found, pages]);

  const change = (v: string) => { setValue(v); broadcast(v); pages.load(); };
  function go(hit: SearchHit) {
    setValue("");
    broadcast("");
    router.push(hit.href);
  }
  function onKeyDown(e: React.KeyboardEvent, onClose: () => void) {
    if (e.key === "Escape") { onClose(); return; }
    if (!hits.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (hits[active]) { go(hits[active]); onClose(); } }
  }
  return { value, change, hits, loading, active, setActive, go, onKeyDown };
}
type SearchState = ReturnType<typeof useSearch>;

/** The grouped results, shared by the dropdown and the phone window. */
function Results({ s, onPick }: { s: SearchState; onPick: () => void }) {
  const groups = React.useMemo(() => {
    return SEARCH_GROUPS.map((g) => ({ group: g, items: s.hits.filter((h) => h.group === g) })).filter((g) => g.items.length > 0);
  }, [s.hits]);
  if (!groups.length) {
    return <div className="px-3 py-6 text-center text-xs text-muted-foreground">{s.loading ? "Searching…" : `No results for “${s.value.trim()}”.`}</div>;
  }
  return (
    <>
      {groups.map((g) => (
        <div key={g.group} className="mb-1 last:mb-0">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.group}</div>
          {g.items.map((hit) => {
            const idx = s.hits.indexOf(hit);
            return (
              <button key={`${hit.group}-${hit.id}`} type="button" role="option" aria-selected={idx === s.active}
                onMouseEnter={() => s.setActive(idx)} onClick={() => { s.go(hit); onPick(); }}
                className={cn("flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left", idx === s.active ? "bg-accent text-accent-foreground" : "hover:bg-muted")}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{hit.title}</span>
                  {hit.subtitle && <span className={cn("block truncate text-[11px]", idx === s.active ? "text-accent-foreground/80" : "text-muted-foreground")}>{hit.subtitle}</span>}
                </span>
                {idx === s.active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" />}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );
}

export function GlobalSearch({ role = "viewer" }: { role?: UserRole }) {
  return <SearchBar role={role} />;
}

function SearchBar({ role }: { role: UserRole }) {
  const s = useSearch(role);
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close on outside click; Cmd/Ctrl-K focuses (on wide screens).
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && window.matchMedia("(min-width: 768px)").matches) { e.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onClick); window.removeEventListener("keydown", onKey); };
  }, []);

  const showDropdown = open && s.value.trim().length >= 2;
  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <label className="flex h-8 w-[260px] items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground focus-within:border-accent focus-within:ring-2 focus-within:ring-ring lg:w-[300px]">
        {s.loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Search className="h-3.5 w-3.5 shrink-0" />}
        <input
          ref={inputRef}
          value={s.value}
          onChange={(e) => { s.change(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => s.onKeyDown(e, () => setOpen(false))}
          placeholder={PLACEHOLDER}
          aria-label="Search the dashboard"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded border border-border px-1 text-[9px] text-muted-foreground lg:inline">⌘K</kbd>
      </label>
      {showDropdown && (
        <div id="global-search-results" role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] w-[min(92vw,420px)] overflow-auto rounded-lg border border-border bg-card p-1.5 shadow-2xl">
          <Results s={s} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/** Phones (under 768px): the top-bar button that slides the search field down. */
export function MobileSearchToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-label={open ? "Close search" : "Search"} aria-expanded={open} aria-controls="mobile-search"
      className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card transition hover:text-foreground md:hidden", open ? "text-foreground" : "text-muted-foreground")}>
      <Search className="h-4 w-4" />
    </button>
  );
}

/**
 * Phones: the search field that slides down below the top bar, above the page
 * heading. It sits in the header's padding, so its search icon lines up under
 * the menu button and its close icon under the sign-out button.
 */
export function MobileSearchPanel({ open, onClose, role = "viewer" }: { open: boolean; onClose: () => void; role?: UserRole }) {
  const s = useSearch(role);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const close = React.useCallback(() => { onClose(); s.change(""); }, [onClose, s]);
  React.useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  return (
    <div id="mobile-search" className={cn("grid transition-[grid-template-rows] duration-200 ease-out md:hidden print:hidden", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!open}>
      <div className="min-h-0 overflow-hidden">
        <div className="border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur">
          {/* Slots match the 32px buttons above (1px border + 30px), so the icons sit on the same centre lines. */}
          <label className="flex h-10 items-center rounded-md border border-border bg-card focus-within:border-accent focus-within:ring-2 focus-within:ring-ring">
            <span className="grid w-[30px] shrink-0 place-items-center text-muted-foreground">
              {s.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </span>
            <input ref={inputRef} value={s.value} onChange={(e) => s.change(e.target.value)} onKeyDown={(e) => s.onKeyDown(e, close)}
              placeholder={PLACEHOLDER} aria-label="Search the dashboard" enterKeyHint="search"
              className="h-full min-w-0 flex-1 bg-transparent px-1 text-[16px] text-foreground outline-none placeholder:text-muted-foreground" />
            <button type="button" onClick={close} aria-label="Close search" className="grid h-full w-[30px] shrink-0 place-items-center text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </label>
          {s.value.trim().length >= 2 ? (
            <div role="listbox" className="mt-2 max-h-[60dvh] overflow-auto rounded-lg border border-border bg-card p-1.5 shadow-xl"><Results s={s} onPick={close} /></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
