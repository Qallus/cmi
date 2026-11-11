"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { INSPECTION_STATUSES, type InspectionStatus } from "@/lib/inspections/status";
import type { InspectionInfo } from "@/lib/inspections/status-data";

const TONE: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  bad: "bg-destructive/10 text-destructive",
};
// Statuses where a date means "the inspection is now on this day".
const DATED = new Set<InspectionStatus>(["requested", "scheduled", "failed", "reinspect_requested", "partial", "passed"]);

// Inspection milestones, Step 4: the status box in an inspection milestone's
// drawer. Who may change it is set in Settings → Scheduling → Inspections.
export function InspectionPanel({ itemId, onChanged }: { itemId: string; onChanged: (message: string) => void }) {
  const [info, setInfo] = React.useState<InspectionInfo | null>(null);
  const [status, setStatus] = React.useState<InspectionStatus>("not_ready");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedule-items/${itemId}/inspection`).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!live) return;
      if (!res.ok) { setError(d.error ?? "Couldn't load the inspection."); return; }
      setInfo(d); setStatus(d.status); setDate("");
    });
    return () => { live = false; };
  }, [itemId]);

  if (!info && !error) return <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">Loading inspection…</div>;

  const current = INSPECTION_STATUSES.find((s) => s.value === info?.status);
  const picked = INSPECTION_STATUSES.find((s) => s.value === status);
  const changed = !!info && (status !== info.status || !!date || !!note.trim());

  async function save() {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/schedule-items/${itemId}/inspection`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, date: date || null, note }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't update the inspection."); return; }
      setInfo(d.info); setDate(""); setNote("");
      onChanged(`Inspection marked ${picked?.label ?? status}.${d.cascaded?.length ? ` ${d.cascaded.length} item${d.cascaded.length === 1 ? "" : "s"} moved.` : ""}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inspection</span>
        {current ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[current.tone])}>{current.label}</span> : null}
        {info?.hold_point ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive" title="The work after this waits for a pass">Hold point</span> : null}
        <span className="ml-auto font-mono text-[11px] text-muted-foreground">{info?.step_id}</span>
      </div>
      {info?.request_by ? <div className="text-xs font-medium text-amber-700 dark:text-amber-400">{info.request_by.label}</div> : null}
      {info?.jurisdiction ? (
        <div className="text-xs text-muted-foreground">
          {info.jurisdiction.name}{info.jurisdiction.scheduling_method ? ` · ${info.jurisdiction.scheduling_method}` : ""}{info.jurisdiction.phone ? ` · ${info.jurisdiction.phone}` : ""}
          {info.jurisdiction.portal_url ? <> · <a href={info.jurisdiction.portal_url} target="_blank" rel="noreferrer" className="underline">portal</a></> : null}
          {!info.request_by && info.status !== "passed" && info.status !== "na" && !info.jurisdiction.cutoff_label ? " · cutoff to confirm" : ""}
        </div>
      ) : null}
      {info?.request_rule ? <div className="text-xs"><span className="text-muted-foreground">Request: </span>{info.request_rule}</div> : null}
      {info?.ready_checklist ? <div className="text-xs"><span className="text-muted-foreground">Ready to call when: </span>{info.ready_checklist}</div> : null}

      {info?.can_update ? (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">Status
              <select value={status} onChange={(e) => setStatus(e.target.value as InspectionStatus)} className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground">
                {INSPECTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            {DATED.has(status) ? (
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">{status === "failed" ? "Re-inspection date" : status === "passed" ? "Passed on (default today)" : "Inspection date"}
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
            ) : null}
          </div>
          {picked ? <div className="text-xs text-muted-foreground">{picked.hint}{status === "na" ? ". It stays on record, held at its date." : "."}</div> : null}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={status === "failed" ? "What needs correcting (required)" : "Note (optional): inspector, result, ticket #"}
            className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm" />
          {error ? <div className="text-xs text-destructive">{error}</div> : null}
          <div className="flex justify-end"><Button size="sm" variant="accent" disabled={saving || !changed} onClick={() => void save()}>{saving ? "Saving…" : "Update inspection"}</Button></div>
        </div>
      ) : info ? (
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">Your role can&apos;t change inspection status (Settings → Scheduling → Inspections).</div>
      ) : null}
      {error && !info ? <div className="text-xs text-destructive">{error}</div> : null}
    </div>
  );
}
