"use client";

import * as React from "react";
import { ClipboardCheck, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PARENT_LABEL, type PunchList, type PunchParentType } from "@/lib/punch/types";
import { api, loadPunchMeta, type PunchMeta } from "@/components/punch/shared";
import { PunchListCard } from "@/components/punch/punch-list-card";
import { ListDialog } from "@/components/punch/list-dialog";

type Scope = "open" | "mine" | "all";
const SCOPES: { key: Scope; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Assigned to me" },
  { key: "all", label: "All" },
];

export function PunchListsClient() {
  const [meta, setMeta] = React.useState<PunchMeta | null>(null);
  const [lists, setLists] = React.useState<PunchList[] | null>(null);
  const [scope, setScope] = React.useState<Scope>("open");
  const [kind, setKind] = React.useState<"all" | PunchParentType>("all");
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLists(null);
    try {
      const [m, l] = await Promise.all([
        loadPunchMeta(),
        api<PunchList[]>(`/api/punch-lists?scope=${scope === "mine" ? "mine" : "all"}${scope === "all" ? "&archived=1" : ""}`),
      ]);
      setMeta(m); setLists(l); setError(null);
    } catch (e) {
      setError((e as Error).message);
      setLists([]);
    }
  }, [scope]);
  React.useEffect(() => { void load(); }, [load]);

  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lists ?? []).filter((l) => {
      if (scope === "open" && (l.items.length > 0 && l.items.every((i) => i.completed_at))) return false;
      if (kind !== "all" && l.parent?.type !== kind) return false;
      if (q && !`${l.title} ${l.parent?.label ?? ""} ${l.items.map((i) => i.title).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lists, scope, kind, query]);

  const openItems = shown.reduce((n, l) => n + l.items.filter((i) => !i.completed_at).length, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Management</div>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-semibold tracking-tight"><ClipboardCheck className="h-6 w-6 text-accent" /> Punch Lists</h1>
          <p className="mt-1 text-sm text-muted-foreground">{shown.length} list{shown.length === 1 ? "" : "s"} · {openItems} open item{openItems === 1 ? "" : "s"}</p>
        </div>
        {meta?.canWrite && <Button size="sm" variant="accent" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New punch list</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-border">
          {SCOPES.map((s) => (
            <button key={s.key} type="button" onClick={() => setScope(s.key)}
              className={cn("px-3 py-1.5 text-xs font-medium transition", scope === s.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>
              {s.label}
            </button>
          ))}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs">
          <option value="all">Jobs, Pre-Con &amp; Pipeline</option>
          {(["job", "precon", "deal"] as PunchParentType[]).map((k) => <option key={k} value={k}>{PARENT_LABEL[k]} only</option>)}
        </select>
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search lists, items, jobs…"
            className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent" />
        </div>
      </div>

      {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {!lists && <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading punch lists…</div>}
      {lists && shown.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {scope === "mine" ? "Nothing is assigned to you right now." : "No punch lists match. Create one and attach it to a Job, Pre-Con or Pipeline deal."}
        </div>
      )}

      <div className="space-y-3">
        {meta && shown.map((l) => (
          <PunchListCard
            key={l.id} list={l} meta={meta} showParent
            onChanged={(next) => setLists((prev) => prev?.map((x) => (x.id === next.id ? next : x)) ?? prev)}
            onRemoved={(id) => setLists((prev) => (scope === "all" ? prev : prev?.filter((x) => x.id !== id)) ?? prev)}
            onMetaChanged={() => void loadPunchMeta(true).then(setMeta)}
          />
        ))}
      </div>

      {creating && meta && (
        <ListDialog meta={meta} onClose={() => setCreating(false)} onSaved={(l) => setLists((prev) => [l, ...(prev ?? [])])} />
      )}
    </div>
  );
}
