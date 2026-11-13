"use client";

// Renumber by Tens (Grid Addendum §1.6): shows every task's old → new ID before
// anything changes, because printouts and notes that quote the old numbers go
// stale. Links are stored by task, so they follow automatically.
import * as React from "react";
import { Loader2 } from "lucide-react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RenumberChange } from "@/lib/schedules/id-order";

export function RenumberDialog({ scheduleId, scheduleName, note, onClose, onDone }: {
  /** Open when set. */
  scheduleId: string | null; scheduleName?: string;
  /** Why it opened, e.g. "No ID left between 25 and 27." */
  note?: string | null;
  onClose: () => void;
  onDone: (changes: RenumberChange[]) => void;
}) {
  const [changes, setChanges] = React.useState<RenumberChange[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [onlyChanged, setOnlyChanged] = React.useState(true);

  React.useEffect(() => {
    if (!scheduleId) return;
    setChanges(null); setError(null);
    let live = true;
    void fetch(`/api/schedules/${scheduleId}/grid?renumber=preview`).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!live) return;
      if (!r.ok) setError(d.error ?? "Could not work out the new numbers.");
      else setChanges(d.changes ?? []);
    });
    return () => { live = false; };
  }, [scheduleId]);

  async function apply() {
    if (!scheduleId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/schedules/${scheduleId}/grid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renumber: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not renumber the activity IDs."); return; }
      onDone(d.renumbered ?? changes ?? []);
    } finally { setSaving(false); }
  }

  const moved = changes?.filter((c) => c.from !== c.to) ?? [];
  const shown = (onlyChanged ? moved : changes ?? []);
  return (
    <ScheduleModal open={!!scheduleId} onClose={onClose} title={`Renumber by 10s${scheduleName ? `: ${scheduleName}` : ""}`} footer={
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="accent" size="sm" disabled={saving || !changes || !moved.length} onClick={() => void apply()}>
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Renumbering…</> : `Renumber ${moved.length} task${moved.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    }>
      <div className="space-y-3 pb-4">
        {note ? <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{note} Renumber by tens, then insert.</div> : null}
        <p className="text-xs text-muted-foreground">Every task gets 10, 20, 30… in the order shown on the schedule. Predecessors and successors follow automatically, and the old → new list is saved in the schedule history. Notes or printouts that quote the old numbers will be out of date.</p>
        {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        {!changes && !error ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Working out the new numbers…</div> : null}
        {changes ? (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{moved.length ? <><strong>{moved.length}</strong> of {changes.length} task{changes.length === 1 ? "" : "s"} get a new number.</> : "Every task is already numbered by tens."}</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" /> Only changes
              </label>
            </div>
            {shown.length ? (
              <div className="max-h-72 overflow-auto rounded border border-border">
                <div className="sticky top-0 grid grid-cols-[4rem_4rem_1fr] gap-2 border-b border-border bg-muted px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span className="text-right">Old</span><span className="text-right">New</span><span>Task</span></div>
                {shown.map((c) => (
                  <div key={c.id} className="grid grid-cols-[4rem_4rem_1fr] gap-2 border-b border-border/60 px-2 py-1 text-xs tabular-nums last:border-0">
                    <span className="text-right text-muted-foreground">{c.from ?? "—"}</span>
                    <span className={cn("text-right", c.from !== c.to && "font-semibold text-accent")}>{c.to}</span>
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ScheduleModal>
  );
}
