"use client";

// Every punch list on one Job, Pre-Con opportunity or Pipeline deal, with
// "New punch list" (blank or from a construction template). Drop it into any
// record page: <PunchListPanel parentType="job" parentId={job.id} parentLabel={job.job_name} />
import * as React from "react";
import { ClipboardCheck, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PunchList, PunchParentType } from "@/lib/punch/types";
import { api, loadPunchMeta, type PunchMeta } from "./shared";
import { PunchListCard } from "./punch-list-card";
import { ListDialog } from "./list-dialog";

export function PunchListPanel({ parentType, parentId, parentLabel, heading = true }: {
  parentType: PunchParentType;
  parentId: string;
  parentLabel: string;
  heading?: boolean;
}) {
  const [meta, setMeta] = React.useState<PunchMeta | null>(null);
  const [lists, setLists] = React.useState<PunchList[] | null>(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [m, l] = await Promise.all([
        loadPunchMeta(),
        api<PunchList[]>(`/api/punch-lists?parent_type=${parentType}&parent_id=${parentId}${showArchived ? "&archived=1" : ""}`),
      ]);
      setMeta(m); setLists(l); setError(null);
    } catch (e) {
      setError((e as Error).message);
      setLists([]);
    }
  }, [parentType, parentId, showArchived]);
  React.useEffect(() => { void load(); }, [load]);

  const parent = { type: parentType, id: parentId, label: parentLabel, href: "" };
  const open = lists?.reduce((n, l) => n + l.items.filter((i) => !i.completed_at).length, 0) ?? 0;

  return (
    <div className="space-y-3">
      {heading && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ClipboardCheck className="h-5 w-5 text-accent" /> Punch Lists</h2>
            {lists && lists.length > 0 && <p className="text-xs text-muted-foreground">{lists.length} list{lists.length === 1 ? "" : "s"} · {open} open item{open === 1 ? "" : "s"}</p>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
            </label>
            {meta?.canWrite && <Button size="sm" variant="accent" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New punch list</Button>}
          </div>
        </div>
      )}

      {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {!lists && <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading punch lists…</div>}

      {lists && lists.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No punch lists yet. Start one blank or from a construction template — Final Walkthrough, Pre-Drywall, Kitchen, Bath and more.</p>
          {meta?.canWrite && <Button size="sm" variant="accent" className="mt-3" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" /> New punch list</Button>}
        </div>
      )}

      {meta && lists?.map((l) => (
        <PunchListCard
          key={l.id} list={l} meta={meta}
          onChanged={(next) => setLists((prev) => prev?.map((x) => (x.id === next.id ? next : x)) ?? prev)}
          onRemoved={(id) => setLists((prev) => (showArchived ? prev : prev?.filter((x) => x.id !== id)) ?? prev)}
          onMetaChanged={() => void loadPunchMeta(true).then(setMeta)}
        />
      ))}

      {creating && meta && (
        <ListDialog meta={meta} fixedParent={parent} onClose={() => setCreating(false)}
          onSaved={(l) => setLists((prev) => [...(prev ?? []), l])} />
      )}
    </div>
  );
}
