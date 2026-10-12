"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import type { DailyLog, DailyLogDraft } from "@/lib/daily-logs/types";
import { LogMedia } from "@/components/dashboard/log-media";
import { JobModuleShell, ModuleModal, Field, inputCls, fmtDate } from "../job-module-shell";

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
  const [d, setD] = React.useState({ log_date: "", title: "", notes: "", weather: "", temperature: "", hours_worked: "", crew: "", visitors: "", delays: "", client_visible: false });

  function openAdd() { setD({ log_date: new Date().toISOString().slice(0, 10), title: "", notes: "", weather: "", temperature: "", hours_worked: "", crew: "", visitors: "", delays: "", client_visible: false }); setError(null); setModal({ mode: "add" }); }
  function openEdit(log: DailyLog) {
    setD({ log_date: log.log_date, title: log.title ?? "", notes: log.notes ?? "", weather: log.weather ?? "", temperature: log.temperature ?? "", hours_worked: log.hours_worked?.toString() ?? "", crew: (log.crew ?? []).join(", "), visitors: log.visitors ?? "", delays: log.delays ?? "", client_visible: log.client_visible });
    setError(null); setModal({ mode: "edit", log });
  }
  async function save() {
    if (!d.log_date) { setError("Date is required."); return; }
    setSaving(true); setError(null);
    try {
      const payload: DailyLogDraft = { log_date: d.log_date, title: d.title || null, notes: d.notes || null, weather: d.weather || null, temperature: d.temperature || null, hours_worked: d.hours_worked ? Number(d.hours_worked) : null, crew: d.crew ? d.crew.split(",").map((s) => s.trim()).filter(Boolean) : null, visitors: d.visitors || null, delays: d.delays || null, client_visible: d.client_visible };
      const url = modal?.mode === "add" ? `/api/jobs/${jobId}/daily-logs` : `/api/jobs/${jobId}/daily-logs/${(modal as { log: DailyLog }).log.id}`;
      const res = await fetch(url, { method: modal?.mode === "add" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => (modal?.mode === "add" ? [j, ...r] : r.map((x) => (x.id === j.id ? j : x))));
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this log?")) return;
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
                <div className="flex items-center gap-2"><span className="font-medium">{fmtDate(log.log_date)}</span>{log.title && <span className="text-sm text-muted-foreground">· {log.title}</span>}{log.client_visible && <Badge tone="accent">Client-visible</Badge>}</div>
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
            {log.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{log.notes}</p>}
            {log.delays && <p className="mt-1 text-sm text-destructive">Delays: {log.delays}</p>}
            <LogMedia photos={log.photos} attachments={log.attachments} />
          </div>
        ))}
      </div>

      {modal && (
        <ModuleModal title={modal.mode === "add" ? "Add Daily Log" : "Edit Daily Log"} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><Input type="date" value={d.log_date} onChange={(e) => setD({ ...d, log_date: e.target.value })} /></Field>
              <Field label="Title"><input className={inputCls} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></Field>
              <Field label="Weather"><input className={inputCls} value={d.weather} onChange={(e) => setD({ ...d, weather: e.target.value })} /></Field>
              <Field label="Temperature"><input className={inputCls} value={d.temperature} onChange={(e) => setD({ ...d, temperature: e.target.value })} /></Field>
              <Field label="Hours Worked"><input type="number" className={inputCls} value={d.hours_worked} onChange={(e) => setD({ ...d, hours_worked: e.target.value })} /></Field>
              <Field label="Crew (comma-separated)"><input className={inputCls} value={d.crew} onChange={(e) => setD({ ...d, crew: e.target.value })} /></Field>
              <Field label="Visitors" className="sm:col-span-2"><input className={inputCls} value={d.visitors} onChange={(e) => setD({ ...d, visitors: e.target.value })} /></Field>
            </div>
            <Field label="Notes"><Textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
            <Field label="Delays / Issues"><Textarea value={d.delays} onChange={(e) => setD({ ...d, delays: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.client_visible} onChange={(e) => setD({ ...d, client_visible: e.target.checked })} /> Visible to client</label>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
          </div>
        </ModuleModal>
      )}
    </JobModuleShell>
  );
}
