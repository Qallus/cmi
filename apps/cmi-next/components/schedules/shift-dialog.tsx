"use client";

import * as React from "react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "./shared";
import type { JobSchedule } from "@/lib/schedules/types";

type Plan = {
  from: string | null; to: string; workdays: number; moved: number; finish: string | null;
  skipped: { id: string; title: string; reason: "locked" | "complete" }[];
  changes: { id: string; title: string; from: { start: string | null; end: string | null }; to: { start: string; end: string } }[];
};

// Move a whole schedule to a new start date. Every task moves by the same number
// of working days and keeps its length; the preview shows the result before saving.
export function ShiftDialog({ open, schedule, onClose, onShifted }: {
  open: boolean; schedule: JobSchedule | null; onClose: () => void; onShifted: (plan: Plan) => void;
}) {
  // Mounted fresh each time it opens, so state starts from the schedule.
  const [date, setDate] = React.useState(schedule?.start_date ?? "");
  const [includeComplete, setIncludeComplete] = React.useState(false);
  const [plan, setPlan] = React.useState<Plan | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const run = React.useCallback(async (dryRun: boolean) => {
    if (!schedule || !date) return null;
    const res = await fetch(`/api/schedules/${schedule.id}/shift`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: date, includeComplete, dryRun }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Could not shift the schedule."); return null; }
    setError(null);
    return d as Plan;
  }, [schedule, date, includeComplete]);

  React.useEffect(() => {
    if (!open || !date) return;
    const t = setTimeout(() => { void run(true).then((p) => setPlan(p)); }, 250);
    return () => clearTimeout(t);
  }, [open, date, includeComplete, run]);

  async function apply() {
    setSaving(true);
    try { const p = await run(false); if (p) onShifted(p); } finally { setSaving(false); }
  }

  const direction = plan ? (plan.workdays > 0 ? "later" : "earlier") : "";
  const locked = plan?.skipped.filter((s) => s.reason === "locked").length ?? 0;
  const done = plan?.skipped.filter((s) => s.reason === "complete").length ?? 0;

  return (
    <ScheduleModal open={open} onClose={onClose} title={`Shift dates${schedule ? `: ${schedule.name}` : ""}`} footer={
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="accent" size="sm" disabled={saving || !plan || !plan.moved} onClick={() => void apply()}>{saving ? "Shifting…" : "Shift schedule"}</Button>
      </div>
    }>
      <div className="space-y-3 pb-4">
        <p className="text-xs text-muted-foreground">Pick the new first day. Every task moves by the same number of working days and keeps its length, so the spacing stays the same. Locked tasks stay where they are. You can still drag or edit any single task afterwards.</p>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">New start date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeComplete} onChange={(e) => setIncludeComplete(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          <span>Also move tasks that are already complete</span>
        </label>
        {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        {plan ? (
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            {plan.workdays === 0 ? (
              <div className="text-muted-foreground">The schedule already starts on {fmtDate(plan.to)}.</div>
            ) : (
              <>
                <div><strong>{plan.moved}</strong> task{plan.moved === 1 ? "" : "s"} move <strong>{Math.abs(plan.workdays)}</strong> working day{Math.abs(plan.workdays) === 1 ? "" : "s"} {direction}.</div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Starts</span><span className="font-medium">{fmtDate(plan.from)} → {fmtDate(plan.to)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Finishes</span><span className="font-medium">{fmtDate(plan.finish)}</span></div>
                {locked ? <div className="text-xs text-muted-foreground">{locked} locked task{locked === 1 ? "" : "s"} stay put.</div> : null}
                {done ? <div className="text-xs text-muted-foreground">{done} complete task{done === 1 ? "" : "s"} stay put.</div> : null}
                {plan.changes.length ? (
                  <div className="max-h-48 overflow-auto rounded border border-border">
                    {plan.changes.slice(0, 100).map((c) => (
                      <div key={c.id} className="flex justify-between gap-3 border-b border-border px-2 py-1 text-xs last:border-0">
                        <span className="truncate">{c.title}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{fmtDate(c.from.start)} → <span className="text-foreground">{fmtDate(c.to.start)}</span></span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </ScheduleModal>
  );
}
