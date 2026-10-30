"use client";

// Search-and-pick for dashboard records (deals, jobs, Pre-Con, vendors and trade
// partners, contacts, selections, projects, punch lists, schedules). Used to
// choose what a schedule is for and what a schedule item points at.
import * as React from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { LINK_LABELS, type LinkType } from "@/lib/schedules/types";

export type PickedRecord = { type: LinkType; id: string; label: string };
type Hit = PickedRecord & { sub: string | null };

export function RecordPicker({ types, value, onChange, placeholder = "Search records…", disabled, autoFocus }: {
  types?: LinkType[]; value: PickedRecord | null; onChange: (v: PickedRecord | null) => void;
  placeholder?: string; disabled?: boolean; autoFocus?: boolean;
}) {
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const typesKey = (types ?? []).join(",");

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/schedule-links/search?q=${encodeURIComponent(term)}${typesKey ? `&types=${typesKey}` : ""}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((d) => { setHits(d.hits ?? []); setOpen(true); })
        .catch(() => {}).finally(() => setLoading(false));
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, typesKey]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm">
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">{LINK_LABELS[value.type]}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{value.label}</span>
        <a href={`/api/schedule-links/open?type=${value.type}&id=${value.id}`} target="_blank" rel="noreferrer" title="Open" className="text-muted-foreground hover:text-foreground"><ExternalLink className="h-3.5 w-3.5" /></a>
        {!disabled ? <button type="button" onClick={() => onChange(null)} aria-label="Clear" className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button> : null}
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q} disabled={disabled} autoFocus={autoFocus} placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); if (e.target.value.trim().length < 2) { setHits([]); setOpen(false); } }}
        onFocus={() => { if (hits.length) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent"
      />
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {loading && !hits.length ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Searching…</div> : null}
          {!loading && !hits.length ? <div className="px-2 py-1.5 text-xs text-muted-foreground">Nothing found.</div> : null}
          {hits.map((h) => (
            <button key={`${h.type}:${h.id}`} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ type: h.type, id: h.id, label: h.label }); setQ(""); setOpen(false); }}
              className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/60")}>
              <span className="w-24 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{LINK_LABELS[h.type]}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{h.label}</span>
              {h.sub ? <span className="shrink-0 text-[11px] text-muted-foreground">{h.sub}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
