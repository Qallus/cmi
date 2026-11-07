"use client";

// Phase 2 progress in the schedule's action bar: the status date (everything
// before it is reported done or late), forecast vs baseline, and how many tasks
// are behind the status date. Setting the date re-forecasts the schedule.
import * as React from "react";
import { Loader2 } from "lucide-react";
import { DateField } from "@/components/ui/date-field";
import { AutoTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { todayAZ } from "@/lib/schedules/progress";

/** Forecast vs baseline and tasks behind, as pills. Shown beside the finish and "vs contract"
 *  pills so all the schedule's results read as one group. */
export function ProgressChips({ finishVariance: v, baselineFinish, behind }: { finishVariance?: number | null; baselineFinish?: string | null; behind?: number }) {
  return (
    <>
      {v != null ? (
        <AutoTooltip content={`Forecast finish vs the baseline finish${baselineFinish ? ` (${baselineFinish})` : ""}, in working days`}>
          <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", v > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400")}>
            vs baseline {v === 0 ? "on date" : `${v > 0 ? "+" : ""}${v} wd`}
          </span>
        </AutoTooltip>
      ) : null}
      {behind ? (
        <AutoTooltip content="Tasks that should have started or finished by the status date but haven't">
          <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">{behind} behind</span>
        </AutoTooltip>
      ) : null}
    </>
  );
}

export function StatusDateControl({ scheduleId, value, canEdit, finishVariance, baselineFinish, behind, chips = true, onChanged, onError }: {
  scheduleId: string;
  value: string | null;
  canEdit: boolean;
  /** Forecast finish minus baseline finish, working days (positive = late). */
  finishVariance?: number | null;
  baselineFinish?: string | null;
  behind?: number;
  /** false when the pills are shown elsewhere (the schedule's action bar groups them with the finish). */
  chips?: boolean;
  onChanged: () => Promise<void> | void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  async function save(date: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/engine`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status_date", date }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't set the status date.");
      await onChanged();
    } catch (e) { onError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <AutoTooltip content="Status date: work up to here is reported. Unstarted tasks can't sit before it and remaining work runs after it.">
        <span className="text-xs text-muted-foreground">Status</span>
      </AutoTooltip>
      {canEdit ? (
        <DateField value={value ?? ""} onChange={(d) => void save(d || null)} placeholder="Set date" className="h-8 w-[9.5rem]"
          triggerProps={{ "aria-label": "Status date", disabled: busy }} />
      ) : <span className="text-xs font-medium">{value ?? "—"}</span>}
      {canEdit && value !== todayAZ() ? (
        <button type="button" onClick={() => void save(todayAZ())} disabled={busy} className="text-[11px] font-medium text-accent hover:underline disabled:opacity-50">Today</button>
      ) : null}
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
      {chips ? <ProgressChips finishVariance={finishVariance} baselineFinish={baselineFinish} behind={behind} /> : null}
    </div>
  );
}
