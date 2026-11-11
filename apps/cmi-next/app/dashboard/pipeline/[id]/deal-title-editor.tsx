"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { isPipelineNumber, nameFromTitle } from "@/lib/deals/numbering";
import type { Deal } from "@/lib/deals/types";

// The deal's heading, with a pencil to correct its pipeline number and name
// together (the title is "26_058_Name"). Saving checks the number isn't used
// by another deal or Pre-Con project, renumbers a linked Pre-Con record, and
// logs the change on the timeline.
export function DealTitleEditor({ deal, canWrite, onSaved }: { deal: Deal; canWrite: boolean; onSaved: (deal: Deal) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [number, setNumber] = React.useState("");
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [linkedJob, setLinkedJob] = React.useState<{ id: string; job_name: string } | null>(null);

  function start() {
    setNumber(deal.job_number ?? "");
    setName(nameFromTitle(deal.title));
    setError(null);
    setLinkedJob(null);
    setEditing(true);
  }

  async function save() {
    const n = number.trim();
    if (!isPipelineNumber(n)) { setError("The number must look like 26_058."); return; }
    if (!nameFromTitle(name)) { setError("Add a name."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/number`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_number: n, name }) });
      const j = (await res.json().catch(() => ({}))) as { deal?: Deal; job?: { id: string; job_name: string } | null; error?: string };
      if (!res.ok || !j.deal) throw new Error(j.error || "Couldn't save the number and name.");
      onSaved(j.deal);
      setLinkedJob(j.job ?? null);
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the number and name."); } finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold">{deal.title}</h1>
          {canWrite ? (
            <button type="button" onClick={start} aria-label="Edit the deal number and name" title="Edit number and name"
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><Pencil className="h-4 w-4" /></button>
          ) : null}
        </div>
        {linkedJob ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Saved. The job <Link href={`/dashboard/jobs/${linkedJob.id}/info`} className="font-medium text-accent hover:underline">{linkedJob.job_name}</Link> keeps its own name; rename it in Job Info if it carries the old number.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="space-y-1.5" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[11px] font-medium text-muted-foreground">Number</span>
          <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="26_058" className="w-28 font-mono" autoFocus aria-label="Pipeline number" />
        </label>
        <label className="block min-w-[14rem] flex-1">
          <span className="text-[11px] font-medium text-muted-foreground">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Smith Residence" aria-label="Deal name" />
        </label>
        <div className="flex gap-1.5">
          <button type="submit" disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm hover:bg-muted"><X className="h-4 w-4" /> Cancel</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Shows as <span className="font-medium text-foreground">{number.trim() || "26_058"}_{nameFromTitle(name) || "Name"}</span>. A linked Pre-Con project takes the new number too.</p>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
