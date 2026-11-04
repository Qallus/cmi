"use client";

// Excel import with a preview (Spec R2 §11.3): upload an edited export (rows
// match on Task GUID) or a filled-in blank template, see every change, pick
// which missing tasks to delete (none by default), then apply as one batch.
import * as React from "react";
import { FileUp, Loader2, AlertTriangle } from "lucide-react";
import { ScheduleModal } from "../schedule-modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GridOps } from "@/lib/schedules/grid";
import type { ImportPlan } from "@/lib/schedules/excel-plan";

type Preview = ImportPlan & { fileName: string; taskCount: number };

export function ExcelImportDialog({ scheduleId, scheduleName, onClose, onApply }: {
  scheduleId: string;
  scheduleName: string;
  onClose: () => void;
  onApply: (ops: GridOps, summary: string) => Promise<void>;
}) {
  const input = React.useRef<HTMLInputElement>(null);
  const [plan, setPlan] = React.useState<Preview | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [remove, setRemove] = React.useState<Set<string>>(new Set());

  async function read(file: File) {
    setReading(true); setError(null); setPlan(null); setRemove(new Set());
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/schedules/${scheduleId}/excel`, { method: "POST", body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Couldn't read that file."); return; }
      setPlan(d as Preview);
    } finally { setReading(false); if (input.current) input.current.value = ""; }
  }

  const updates = plan?.rows.filter((r) => r.kind === "update") ?? [];
  const creates = plan?.rows.filter((r) => r.kind === "create") ?? [];
  const total = updates.length + creates.length + remove.size;

  async function apply() {
    if (!plan || !total) return;
    setApplying(true);
    try {
      await onApply({ ...plan.ops, deletes: [...remove], source: "excel", fileName: plan.fileName },
        `Imported ${plan.fileName}: ${updates.length} updated, ${creates.length} added${remove.size ? `, ${remove.size} deleted` : ""}.`);
      onClose();
    } finally { setApplying(false); }
  }

  return (
    <ScheduleModal open title={`Import from Excel: ${scheduleName}`} onClose={onClose} footer={
      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs text-muted-foreground">{plan ? `${total} change${total === 1 ? "" : "s"} · recalculated when applied` : "Nothing is saved until you apply."}</div>
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button variant="accent" size="sm" disabled={!plan || !total || applying} onClick={() => void apply()}>{applying ? "Applying…" : `Apply ${total || ""} change${total === 1 ? "" : "s"}`}</Button>
      </div>
    }>
      <div className="space-y-4 pb-4">
        <p className="text-sm text-muted-foreground">
          Upload an export you&apos;ve edited (rows match on the hidden Task GUID column) or a filled-in blank template.
          Start and finish are worked out by the schedule; a typed start becomes Start No Earlier Than.
        </p>
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); }} />
        <button type="button" onClick={() => input.current?.click()} disabled={reading}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition hover:border-accent hover:bg-accent/5 hover:text-foreground">
          {reading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
          {reading ? "Reading…" : plan ? `${plan.fileName} · choose another file` : "Choose an .xlsx file"}
        </button>
        {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

        {plan ? (
          <>
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              {[["Updated", updates.length], ["New", creates.length], ["Unchanged", plan.unchanged], ["Not in file", plan.deletions.length]].map(([l, n]) => (
                <div key={l} className="rounded-lg border border-border px-2 py-2"><div className="text-lg font-semibold tabular-nums">{n}</div><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</div></div>
              ))}
            </div>

            {plan.errors.length || plan.ignoredColumns.length ? (
              <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                <div className="flex items-center gap-1.5 font-medium"><AlertTriangle className="h-3.5 w-3.5" /> Check these before applying</div>
                {plan.ignoredColumns.length ? <div>Ignored column{plan.ignoredColumns.length === 1 ? "" : "s"}: {plan.ignoredColumns.join(", ")}.</div> : null}
                {plan.errors.slice(0, 12).map((e, i) => <div key={i}>{e}</div>)}
                {plan.errors.length > 12 ? <div>…and {plan.errors.length - 12} more.</div> : null}
              </div>
            ) : null}

            {plan.rows.length ? (
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-2 py-1.5">Row</th><th className="px-2 py-1.5">Task</th><th className="px-2 py-1.5">Change</th></tr>
                  </thead>
                  <tbody>
                    {plan.rows.slice(0, 300).map((r) => (
                      <tr key={`${r.kind}-${r.row}`} className="border-t border-border align-top">
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{r.row}</td>
                        <td className="px-2 py-1.5">
                          <span className={cn("mr-1 rounded px-1 text-[10px] font-semibold uppercase", r.kind === "create" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-accent/15 text-accent")}>{r.kind === "create" ? "New" : "Edit"}</span>
                          {r.activityId != null ? <span className="mr-1 tabular-nums text-muted-foreground">{r.activityId}</span> : null}{r.title}
                        </td>
                        <td className="px-2 py-1.5">
                          {r.changes.map((c, i) => (
                            <div key={i}><span className="text-muted-foreground">{c.field}:</span> {r.kind === "create" ? c.to : <>{c.from} → <span className="font-medium">{c.to}</span></>}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="rounded-lg border border-border px-3 py-4 text-center text-sm text-muted-foreground">No changes in this file.</div>}

            {plan.deletions.length ? (
              <div className="space-y-1.5 rounded-lg border border-border p-3">
                <div className="text-xs font-medium">These tasks aren&apos;t in the file. Tick any you want deleted (they stay otherwise).</div>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {plan.deletions.map((d) => (
                    <label key={d.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={remove.has(d.id)} onChange={() => setRemove((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} />
                      <span className="tabular-nums text-muted-foreground">{d.activityId ?? ""}</span> {d.title}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ScheduleModal>
  );
}
