"use client";

import * as React from "react";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { fmtDate } from "./shared";
import { SCHEDULING_MODE_LABELS, type JobSchedule, type SchedulingMode } from "@/lib/schedules/types";

type Preview = {
  mode: SchedulingMode; keepDates: boolean; finishBefore: string | null; finishAfter: string | null;
  pinned: number; earlier: number; later: number;
  moved: { id: string; title: string; from: { start: string | null; end: string | null }; to: { start: string | null; end: string | null } }[];
};

const MODE_HELP: Record<SchedulingMode, string> = {
  auto: "The schedule works out its own dates from the links, the work calendar and holidays. Tasks move later and earlier, and it shows float and the critical path.",
  manual: "Dates stay where you put them. Float and the critical path are still worked out, as advice.",
  legacy: "The way schedules have worked until now: moving a task pushes the linked tasks after it later, never earlier.",
};

// Choose how a schedule's dates are worked out, with a preview before anything
// changes (Spec R2 §6.2). Switching to the critical path keeps today's dates by
// default: tasks that sit later than their links need get a Start No Earlier Than.
export function EngineDialog({ open, schedule, currentMode, onClose, onSwitched }: {
  open: boolean; schedule: JobSchedule | null; currentMode: SchedulingMode; onClose: () => void; onSwitched: (p: Preview) => void;
}) {
  const [mode, setMode] = React.useState<SchedulingMode>(currentMode === "legacy" ? "auto" : currentMode);
  const [keepDates, setKeepDates] = React.useState(true);
  const [plan, setPlan] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const run = React.useCallback(async (dryRun: boolean) => {
    if (!schedule) return null;
    const res = await fetch(`/api/schedules/${schedule.id}/engine`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "switch", mode, keepDates, dryRun }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Could not work out the preview."); return null; }
    setError(null);
    return d as Preview;
  }, [schedule, mode, keepDates]);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void run(true).then((p) => setPlan(p)); }, 150);
    return () => clearTimeout(t);
  }, [open, mode, keepDates, run]);

  async function apply() {
    setSaving(true);
    try { const p = await run(false); if (p) onSwitched(p); } finally { setSaving(false); }
  }

  const same = mode === currentMode;
  return (
    <ScheduleModal open={open} onClose={onClose} title={`Dates${schedule ? `: ${schedule.name}` : ""}`} footer={
      <div className="flex items-center gap-2">
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="accent" size="sm" disabled={saving || same || (!plan && mode !== "legacy")} onClick={() => void apply()}>{saving ? "Saving…" : "Use this"}</Button>
      </div>
    }>
      <div className="space-y-3 pb-4">
        <div className="space-y-2">
          {(["auto", "manual", "legacy"] as SchedulingMode[]).map((m) => (
            <label key={m} className="flex cursor-pointer gap-2 rounded-lg border border-border p-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent/5">
              <input type="radio" name="engine-mode" checked={mode === m} onChange={() => setMode(m)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span>
                <span className="font-medium">{SCHEDULING_MODE_LABELS[m]}</span>{m === currentMode ? <span className="ml-1.5 text-xs text-muted-foreground">(now)</span> : null}
                <span className="block text-xs text-muted-foreground">{MODE_HELP[m]}</span>
              </span>
            </label>
          ))}
        </div>
        {mode === "auto" && currentMode !== "auto" ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={keepDates} onChange={(e) => setKeepDates(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
            <span>Keep today&apos;s dates<span className="block text-xs text-muted-foreground">Tasks that are later than their links need stay where they are (they get a Start No Earlier Than). Untick to let the schedule pull everything as early as the links allow.</span></span>
          </label>
        ) : null}
        {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        {plan && mode !== "legacy" ? (
          <div className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Finish</span><span className="font-medium">{fmtDate(plan.finishBefore)} → {fmtDate(plan.finishAfter)}</span></div>
            {plan.moved.length ? (
              <div><strong>{plan.moved.length}</strong> task{plan.moved.length === 1 ? "" : "s"} change dates{plan.earlier ? <> ({plan.later} later, {plan.earlier} earlier)</> : null}: their links, the holiday calendar or the working days need it.</div>
            ) : <div className="text-muted-foreground">No dates change.</div>}
            {plan.pinned ? <div className="text-xs text-muted-foreground">{plan.pinned} task{plan.pinned === 1 ? "" : "s"} get a Start No Earlier Than at today&apos;s date.</div> : null}
            {plan.moved.length ? (
              <div className="max-h-48 overflow-auto rounded border border-border">
                {plan.moved.slice(0, 100).map((c) => (
                  <div key={c.id} className="flex justify-between gap-3 border-b border-border px-2 py-1 text-xs last:border-0">
                    <span className="truncate">{c.title}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{c.from.start === c.to.start
                      ? <>finish {fmtDate(c.from.end)} → <span className="text-foreground">{fmtDate(c.to.end)}</span></>
                      : <>{fmtDate(c.from.start)} → <span className="text-foreground">{fmtDate(c.to.start)}</span></>}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {mode === "legacy" && currentMode !== "legacy" ? <div className="text-xs text-muted-foreground">No dates change. Float and the critical path stop updating.</div> : null}
      </div>
    </ScheduleModal>
  );
}
