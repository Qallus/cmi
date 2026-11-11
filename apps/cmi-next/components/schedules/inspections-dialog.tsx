"use client";

import * as React from "react";
import Link from "next/link";
import { ScheduleModal } from "./schedule-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateState } from "@/lib/inspections/plan";
import type { InspectionProfile, ApplyInspectionsResult } from "@/lib/inspections/apply";

const STATE_LABEL: Record<CandidateState, { text: string; cls: string }> = {
  include: { text: "Required", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  condition_on: { text: "Job has it", cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  condition_off: { text: "Not on the job", cls: "bg-muted text-muted-foreground" },
  confirm: { text: "Confirm", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
};

// Inspection milestones, Step 3: load the job's jurisdiction library into this
// schedule. Required rows start ticked; "If …" rows follow the job's conditions;
// "As needed" rows wait for the PM. Each becomes a milestone linked Finish→Start
// to the work before it and the work it releases.
export function InspectionsDialog({ scheduleId, scheduleName, jobId, onClose, onApplied }: {
  scheduleId: string; scheduleName: string; jobId: string; onClose: () => void; onApplied: (r: ApplyInspectionsResult) => void;
}) {
  const [profile, setProfile] = React.useState<InspectionProfile | null>(null);
  const [rows, setRows] = React.useState<Candidate[]>([]);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [showAll, setShowAll] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [result, setResult] = React.useState<ApplyInspectionsResult | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch(`/api/schedules/${scheduleId}/inspections`).then(async (res) => {
      const d = await res.json().catch(() => ({}));
      if (!live) return;
      if (!res.ok) { setError(d.error ?? "Couldn't load the inspection library."); setLoading(false); return; }
      setProfile(d.profile);
      setRows(d.candidates ?? []);
      setPicked(new Set((d.candidates as Candidate[] ?? []).filter((c) => c.selected).map((c) => c.row.milestone_id)));
      setLoading(false);
    });
    return () => { live = false; };
  }, [scheduleId]);

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const visible = rows.filter((c) => showAll || c.state !== "condition_off" || picked.has(c.row.milestone_id));
  const hidden = rows.length - visible.length;
  const groups = React.useMemo(() => {
    const m = new Map<string, { label: string; items: Candidate[] }>();
    for (const c of visible) {
      const k = c.row.phase_id;
      if (!m.has(k)) m.set(k, { label: `${c.row.phase_id}${c.row.phase ? ` · ${c.row.phase}` : ""}`, items: [] });
      m.get(k)!.items.push(c);
    }
    return Array.from(m.values());
  }, [visible]);
  const total = rows.filter((c) => picked.has(c.row.milestone_id)).reduce((n, c) => n + (c.repeats ? counts[c.row.milestone_id] ?? 1 : 1), 0);

  async function apply() {
    setSaving(true); setError(null);
    try {
      const picks = rows.filter((c) => picked.has(c.row.milestone_id)).map((c) => ({ step_id: c.row.milestone_id, count: c.repeats ? counts[c.row.milestone_id] ?? 1 : 1 }));
      const res = await fetch(`/api/schedules/${scheduleId}/inspections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ picks }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't add the inspections."); return; }
      setResult(d as ApplyInspectionsResult);
      onApplied(d as ApplyInspectionsResult);
    } finally { setSaving(false); }
  }

  const footer = result ? (
    <div className="flex justify-end"><Button variant="accent" size="sm" onClick={onClose}>Done</Button></div>
  ) : (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{total} milestone{total === 1 ? "" : "s"}</span>
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
      <Button variant="accent" size="sm" disabled={saving || !total || !profile || profile.missing.length > 0} onClick={() => void apply()}>{saving ? "Adding…" : `Add ${total || ""} inspection${total === 1 ? "" : "s"}`}</Button>
    </div>
  );

  return (
    <ScheduleModal open onClose={onClose} title={`Add inspections: ${scheduleName}`} footer={footer}>
      <div className="space-y-3 pb-4 text-sm">
        {loading ? <div className="py-6 text-center text-muted-foreground">Loading the library…</div> : null}
        {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive">{error}</div> : null}

        {result ? (
          <div className="space-y-2">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
              Added <strong>{result.created}</strong> milestone{result.created === 1 ? "" : "s"} and <strong>{result.linked}</strong> link{result.linked === 1 ? "" : "s"}. Each starts as Not Ready.
            </div>
            {result.unlinked.length ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <div className="mb-1 font-medium">Not linked yet ({result.unlinked.length})</div>
                <p className="mb-1 text-xs text-muted-foreground">These hooks point at tasks this schedule doesn&apos;t have. Link them by hand, or add the task and load again later.</p>
                <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">{result.unlinked.map((u, i) => <li key={i}><span className="font-mono text-muted-foreground">{u.step_id}</span> {u.note}</li>)}</ul>
              </div>
            ) : null}
            {result.skipped.length ? (
              <div className="rounded-lg border border-border px-3 py-2 text-xs">
                <div className="mb-1 font-medium">Left out ({result.skipped.length})</div>
                <ul className="space-y-0.5">{result.skipped.map((s, i) => <li key={i}><span className="font-mono text-muted-foreground">{s.step_id}</span> {s.note}</li>)}</ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {!result && profile ? (
          profile.missing.length ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-3">
              Set {profile.missing.join(" and ")} first, so the right inspections load.{" "}
              <Link href={`/dashboard/jobs/${jobId}/info`} className="font-medium text-accent underline">Open Job Info</Link>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{profile.jurisdiction?.name}</span> · {profile.scope === "NEW" ? "New build" : profile.scope === "ADD" ? "Addition" : "Remodel"}
                {profile.jurisdiction?.cutoff_label ? <> · next-day cutoff {profile.jurisdiction.cutoff_label}</> : null}
                <div className="mt-1">Each one is a milestone linked from the work before it to the work it releases, so a late inspection pushes what follows. Edit Job conditions in <Link href={`/dashboard/jobs/${jobId}/info`} className="underline">Job Info</Link>.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button" className="underline" onClick={() => setPicked(new Set(rows.filter((c) => c.selected).map((c) => c.row.milestone_id)))}>Reset to suggested</button>
                <button type="button" className="underline" onClick={() => setPicked(new Set())}>Clear</button>
                <div className="flex-1" />
                {hidden || showAll ? <label className="flex items-center gap-1.5"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show rows this job doesn&apos;t need{hidden ? ` (${hidden})` : ""}</label> : null}
              </div>
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</div>
                  <div className="divide-y divide-border rounded-lg border border-border">
                    {g.items.map((c) => {
                      const id = c.row.milestone_id;
                      const on = picked.has(id);
                      const st = STATE_LABEL[c.state];
                      return (
                        <div key={id} className={cn("flex gap-2 px-3 py-2", !on && "opacity-80")}>
                          <input type="checkbox" checked={on} onChange={() => toggle(id)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-label={c.row.gantt_name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium">{c.row.gantt_name}</span>
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", st.cls)} title={c.reason}>{st.text}</span>
                              {c.row.hold_point ? <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">Hold point</span> : null}
                              {c.alreadyLoaded ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">On schedule{c.alreadyLoaded > 1 ? ` ×${c.alreadyLoaded}` : ""}</span> : null}
                            </div>
                            <div className="text-xs text-muted-foreground">{c.reason}{c.row.code ? ` · code ${c.row.code}` : ""}</div>
                            {c.follows.length || c.releases.length ? (
                              <div className="text-xs text-muted-foreground">{c.follows.length ? <>After {c.follows.join(", ")}</> : null}{c.follows.length && c.releases.length ? " · " : ""}{c.releases.length ? <>before {c.releases.join(", ")}</> : null}</div>
                            ) : null}
                            {c.missing.length ? <div className="text-xs text-amber-700 dark:text-amber-400">{c.missing.join(" · ")}</div> : null}
                          </div>
                          {c.repeats && on ? (
                            <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={c.repeats}>
                              <input type="number" min={1} max={50} value={counts[id] ?? 1} onChange={(e) => setCounts((m) => ({ ...m, [id]: Math.max(1, Math.min(50, Number(e.target.value) || 1)) }))}
                                className="h-7 w-14 rounded-md border border-border bg-card px-1.5 text-right text-sm text-foreground" />
                              <span className="max-w-[6rem] truncate">{c.repeats.toLowerCase()}</span>
                            </label>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {!rows.length ? <div className="py-4 text-center text-muted-foreground">No library rows for this jurisdiction and scope.</div> : null}
            </>
          )
        ) : null}
      </div>
    </ScheduleModal>
  );
}
