"use client";

// "Save to: Job · Pre-Con · Daily Log" — shared by the mobile Camera and Voice
// note sheets so both offer the same places, and the second field follows the
// choice. A Daily Log target is "job:<id>" or "opportunity:<id>".
import * as React from "react";
import { cn } from "@/lib/utils";

export type MediaDest = "job" | "precon" | "dailylog";
export type MediaOption = { id: string; label: string };

const DESTS: { key: MediaDest; label: string }[] = [
  { key: "job", label: "Job" },
  { key: "precon", label: "Pre-Con" },
  { key: "dailylog", label: "Daily Log" },
];

/** Jobs and Pre-Con projects, loaded once when a sheet first needs them. */
export function useMediaTargets() {
  const [jobs, setJobs] = React.useState<MediaOption[]>([]);
  const [opps, setOpps] = React.useState<MediaOption[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const load = React.useCallback(async () => {
    if (loaded) return;
    try {
      const [rows, targets] = await Promise.all([
        fetch("/api/jobs").then((r) => r.json()),
        fetch("/api/daily-logs/targets").then((r) => (r.ok ? r.json() : [])),
      ]);
      if (Array.isArray(rows)) {
        setJobs(rows.map((r: { id: string; job_number?: string; job_name?: string }) => ({
          id: r.id, label: [r.job_number, r.job_name].filter(Boolean).join(" · ") || r.job_name || "Job",
        })));
      }
      if (Array.isArray(targets)) {
        setOpps((targets as { kind: string; id: string; label: string; sub: string }[])
          .filter((t) => t.kind === "opportunity")
          .map((t) => ({ id: t.id, label: [t.sub.replace(/^Pre-Con( · )?/, ""), t.label].filter(Boolean).join(" · ") })));
      }
      setLoaded(true);
    } catch { /* the sheet shows an empty state */ }
  }, [loaded]);

  return { jobs, opps, loaded, load };
}

export type MediaDestState = {
  dest: MediaDest; jobId: string; oppId: string; logTarget: string;
};
export const EMPTY_DEST: MediaDestState = { dest: "job", jobId: "", oppId: "", logTarget: "" };

/** Whether the chosen destination has its record picked. */
export const destReady = (s: MediaDestState) => (s.dest === "job" ? !!s.jobId : s.dest === "precon" ? !!s.oppId : !!s.logTarget);
/** Client portal sharing only exists for Jobs. */
export const canShareWithClient = (s: MediaDestState) => s.dest === "job" || (s.dest === "dailylog" && s.logTarget.startsWith("job:"));
/** Where it went, for the confirmation line. */
export const destPhrase = (s: MediaDestState) =>
  s.dest === "job" ? "added to the job" : s.dest === "precon" ? "added to the Pre-Con project" : "saved as a daily log";

const select = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent";
const label = "mb-1 block text-xs font-medium text-muted-foreground";

export function MediaDestinationPicker({
  value, onChange, jobs, opps, loaded,
}: {
  value: MediaDestState; onChange: (v: MediaDestState) => void;
  jobs: MediaOption[]; opps: MediaOption[]; loaded: boolean;
}) {
  return (
    <>
      <div>
        <span className={label}>Save to</span>
        <div role="radiogroup" aria-label="Save to" className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
          {DESTS.map((d) => (
            <button key={d.key} type="button" role="radio" aria-checked={value.dest === d.key} onClick={() => onChange({ ...value, dest: d.key })}
              className={cn("rounded-md px-2 py-2 text-sm font-medium transition", value.dest === d.key ? "bg-accent text-white" : "text-muted-foreground hover:bg-muted")}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        {value.dest === "job" && (
          <>
            <label className={label}>Job</label>
            <select value={value.jobId} onChange={(e) => onChange({ ...value, jobId: e.target.value })} className={select}>
              <option value="">Select a job…</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
            </select>
            {loaded && jobs.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No jobs available.</p>}
          </>
        )}
        {value.dest === "precon" && (
          <>
            <label className={label}>Pre-Con project</label>
            <select value={value.oppId} onChange={(e) => onChange({ ...value, oppId: e.target.value })} className={select}>
              <option value="">Select a Pre-Con project…</option>
              {opps.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            {loaded && opps.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No Pre-Con projects available.</p>}
          </>
        )}
        {value.dest === "dailylog" && (
          <>
            <label className={label}>Daily log for</label>
            <select value={value.logTarget} onChange={(e) => onChange({ ...value, logTarget: e.target.value })} className={select}>
              <option value="">Select a Job or Pre-Con…</option>
              <optgroup label="Jobs">{jobs.map((j) => <option key={`j${j.id}`} value={`job:${j.id}`}>{j.label}</option>)}</optgroup>
              <optgroup label="Pre-Con">{opps.map((o) => <option key={`o${o.id}`} value={`opportunity:${o.id}`}>{o.label}</option>)}</optgroup>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">Saved as today&apos;s daily log, with your note as the log.</p>
          </>
        )}
      </div>
    </>
  );
}
