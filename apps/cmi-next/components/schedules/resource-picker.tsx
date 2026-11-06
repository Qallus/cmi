"use client";

// Pick who does a task (Phase 2 Step 7): staff, trade partners, or a generic
// trade like "Electrician" that can be converted to a partner later. Search
// by name; type a trade that isn't listed to add it.
import * as React from "react";
import { HardHat, Loader2, Plus, User, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tradeLabel, resourceKey } from "@/lib/schedules/resources";
import type { Assignee } from "@/lib/schedules/types";

type Entry = Assignee & { sub?: string | null };

export const RESOURCE_ICON = { staff: User, vendor: Users, contractor: Users, client: User, trade: HardHat } as const;

export function ResourcePicker({ value, onChange, disabled }: { value: Assignee[]; onChange: (next: Assignee[]) => void; disabled?: boolean }) {
  const [q, setQ] = React.useState("");
  const [pool, setPool] = React.useState<Entry[] | null>(null);
  React.useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/schedules/resources?pool=1&q=${encodeURIComponent(q.trim())}`).then((r) => (r.ok ? r.json() : { pool: [] })).then((d) => { if (live) setPool(d.pool ?? []); }).catch(() => { if (live) setPool([]); });
    }, q ? 200 : 0);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  const chosen = new Set(value.map(resourceKey));
  const toggle = (a: Assignee) => onChange(chosen.has(resourceKey(a)) ? value.filter((x) => resourceKey(x) !== resourceKey(a)) : [...value, { id: a.id, name: a.name, type: a.type ?? "staff" }]);
  const typed = q.trim();
  const canAddTrade = typed.length >= 2 && !(pool ?? []).some((p) => p.type === "trade" && p.name.toLowerCase() === typed.toLowerCase());
  const groups: [string, Entry[]][] = [
    ["Staff", (pool ?? []).filter((p) => p.type === "staff")],
    ["Trade partners", (pool ?? []).filter((p) => p.type === "vendor")],
    ["Trades", (pool ?? []).filter((p) => p.type === "trade")],
  ];
  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((a) => { const Icon = RESOURCE_ICON[a.type ?? "staff"] ?? User; return (
            <span key={resourceKey(a)} className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-0.5 pl-2 pr-1 text-xs font-medium text-accent">
              <Icon className="h-3 w-3" />{a.name}
              {!disabled ? <button type="button" onClick={() => toggle(a)} aria-label={`Remove ${a.name}`} className="rounded-full p-0.5 hover:bg-accent/20"><X className="h-3 w-3" /></button> : null}
            </span>
          ); })}
        </div>
      ) : <p className="text-xs text-muted-foreground">No one assigned yet.</p>}
      {!disabled ? (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff, trade partners or trades (e.g. Electrician)"
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent" />
          <div className="max-h-56 overflow-y-auto rounded-md border border-border">
            {pool === null ? <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div> : null}
            {canAddTrade ? (
              <button type="button" onClick={() => { toggle(tradeLabel(typed)); setQ(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                <Plus className="h-3.5 w-3.5 text-accent" /> Add trade &quot;{typed}&quot; <span className="text-xs text-muted-foreground">(pick the partner later)</span>
              </button>
            ) : null}
            {groups.map(([label, list]) => list.length ? (
              <div key={label}>
                <div className="bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
                {list.map((p) => { const on = chosen.has(resourceKey(p)); const Icon = RESOURCE_ICON[p.type ?? "staff"] ?? User; return (
                  <button key={resourceKey(p)} type="button" onClick={() => toggle(p)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted", on && "bg-accent/10")}>
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    {p.sub ? <span className="truncate text-[11px] text-muted-foreground">{p.sub}</span> : null}
                    {on ? <span className="text-xs font-medium text-accent">✓</span> : null}
                  </button>
                ); })}
              </div>
            ) : null)}
            {pool && !pool.length && !canAddTrade ? <p className="px-3 py-2 text-xs text-muted-foreground">Nothing matches. Type at least two letters to search trade partners.</p> : null}
          </div>
          {!typed ? <p className="text-[11px] text-muted-foreground">Trade partners show when you search by name.</p> : null}
        </>
      ) : null}
    </div>
  );
}
