"use client";

import * as React from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DailyLog } from "@/lib/daily-logs/types";
import { LogMedia } from "@/components/dashboard/log-media";
import { LogNotes } from "@/components/dashboard/log-notes";
import { AddDailyLogDialog } from "@/components/dashboard/add-daily-log";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { confirmAction } from "@/components/ui/confirm-action";
import { JobModuleShell, ModuleModal, fmtDate } from "../job-module-shell";

type Modal = { mode: "add" } | { mode: "edit"; log: DailyLog } | null;

// What a log holds decides its tab: a voice note (usually transcribed),
// photos/video from the camera, or a standard written log.
type LogTab = "all" | "standard" | "photos" | "voice";
const TABS: { key: LogTab; label: string }[] = [
  { key: "all", label: "All Logs" },
  { key: "standard", label: "Standard" },
  { key: "photos", label: "Photos" },
  { key: "voice", label: "Voice" },
];
function logKind(log: DailyLog): Exclude<LogTab, "all"> {
  const att = log.attachments ?? [];
  if (att.some((a) => a.type === "audio")) return "voice";
  if ((log.photos ?? []).length > 0 || att.some((a) => a.type === "video")) return "photos";
  return "standard";
}

export function DailyLogsClient({ jobId, jobName, initial }: { jobId: string; jobName: string; initial: DailyLog[] }) {
  const [rows, setRows] = React.useState<DailyLog[]>(initial);
  const [modal, setModal] = React.useState<Modal>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<LogTab>("all");
  const counts = React.useMemo(() => {
    const c = { all: rows.length, standard: 0, photos: 0, voice: 0 };
    for (const r of rows) c[logKind(r)] += 1;
    return c;
  }, [rows]);
  const shown = tab === "all" ? rows : rows.filter((r) => logKind(r) === tab);
  const router = useRouter();
  // Editing keeps to what the new form collects: the log text and who sees it.
  const [d, setD] = React.useState({ notes: "", client_visible: false, include_in_brief: false, private: false });

  function openAdd() { setError(null); setModal({ mode: "add" }); }
  function openEdit(log: DailyLog) {
    // Plain-text logs open in the editor as paragraphs.
    const notes = log.notes && !/<\w/.test(log.notes) ? log.notes.split(/\n+/).map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`).join("") : log.notes ?? "";
    setD({ notes, client_visible: log.client_visible, include_in_brief: !!log.include_in_brief, private: log.visibility === "private" });
    setError(null); setModal({ mode: "edit", log });
  }
  async function save() {
    if (modal?.mode !== "edit") return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/daily-logs/${modal.log.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: d.notes, client_visible: d.client_visible && !d.private, include_in_brief: d.include_in_brief, visibility: d.private ? "private" : "team" }),
      });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => r.map((x) => (x.id === j.id ? j : x)));
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }
  async function reload() {
    const res = await fetch(`/api/jobs/${jobId}/daily-logs`);
    if (res.ok) setRows(await res.json());
    router.refresh();
  }
  async function remove(id: string) {
    if (!(await confirmAction({ title: "Delete this daily log?", tone: "danger", body: "Its text, photos and recordings are removed from this job." }))) return;
    const res = await fetch(`/api/jobs/${jobId}/daily-logs/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((r) => r.filter((x) => x.id !== id));
  }

  return (
    <JobModuleShell jobId={jobId} jobName={jobName} active="daily-logs" title="Daily Logs"
      action={<Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Log</Button>}>
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{counts[t.key]}</span>
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {shown.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No daily logs yet." : tab === "voice" ? "No voice notes yet. Record one from the Record button on your phone." : tab === "photos" ? "No photo logs yet. Take one with the Camera button on your phone." : "No standard logs yet."}
          </div>
        )}
        {shown.map((log) => (
          <div key={log.id} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{fmtDate(log.log_date)}</span><span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" })}</span>{log.client_visible && <Badge tone="accent">Client-visible</Badge>}{log.visibility === "private" && <Badge><Lock className="mr-1 inline h-3 w-3" />Private</Badge>}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {log.weather && <span>☁ {log.weather}{log.temperature ? ` · ${log.temperature}` : ""}</span>}
                  {log.hours_worked != null && <span>⏱ {log.hours_worked}h</span>}
                  {(log.crew ?? []).length > 0 && <span>👷 {(log.crew ?? []).join(", ")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openEdit(log)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                <button type="button" onClick={() => void remove(log.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <LogNotes notes={log.notes} className="mt-2" />
            {log.delays && <p className="mt-1 text-sm text-destructive">Delays: {log.delays}</p>}
            <LogMedia photos={log.photos} attachments={log.attachments} />
          </div>
        ))}
      </div>

      {modal?.mode === "add" && (
        <AddDailyLogDialog preselect={{ kind: "job", id: jobId }} onClose={() => setModal(null)} onSaved={() => { setModal(null); void reload(); }} />
      )}
      {modal?.mode === "edit" && (
        <ModuleModal title="Edit Daily Log" onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">What happened</span>
              <RichTextEditor key={modal.log.id} value={d.notes} onChange={(v) => setD((x) => ({ ...x, notes: v }))} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.client_visible && !d.private} disabled={d.private} onChange={(e) => setD({ ...d, client_visible: e.target.checked })} /> Client visible</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.include_in_brief} onChange={(e) => setD({ ...d, include_in_brief: e.target.checked })} /> My Daily Brief</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.private} onChange={(e) => setD({ ...d, private: e.target.checked, client_visible: e.target.checked ? false : d.client_visible })} /> Private (only me)</label>
            </div>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
          </div>
        </ModuleModal>
      )}
    </JobModuleShell>
  );
}
