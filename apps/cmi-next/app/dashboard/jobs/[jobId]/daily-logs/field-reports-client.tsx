"use client";

// Field Reports (plan: docs/features/field-reports/field-reports-plan.md): one
// daily log per day for this job. Captures from the phone (Record, Camera) and
// Add to today's log land in that day's log, sorted into the standard sections.
// Review what Bolt sorted, fix anything flagged in Needs a look, then Submit.
import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, FileText, Loader2, Lock, Plus, RotateCcw, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AddDailyLogDialog } from "@/components/dashboard/add-daily-log";
import { confirmAction } from "@/components/ui/confirm-action";
import {
  INTERNAL_SECTIONS, SECTION_KEYS, SECTION_LABELS, needsALook, newItemId,
  type LogItem, type LogSections, type SectionKey,
} from "@/lib/daily-logs/sections";
import { fmtDate } from "../job-module-shell";

export type FieldReportRow = {
  id: string; log_date: string; log_number: number | null; title: string | null; status: "draft" | "submitted";
  weather: string | null; temperature: string | null; photos: string[] | null;
  attachments: { url: string; type: string; name?: string | null }[] | null;
  sections: LogSections; submitted_at: string | null; updated_at: string;
};

const HINT: Partial<Record<SectionKey, string>> = {
  work: "What got done today",
  onsite: "Company and trade. Crew size and hours if you have them",
  inspections: "Type and result",
  delays: "What happened and what it holds up",
  actions: "Who does what, by when (becomes a commitment on Submit)",
  internal: "Never goes to the client",
};

export function FieldReportsClient({ jobId, initial, today, canEdit, canReopen }: {
  jobId: string; initial: FieldReportRow[]; today: string; canEdit: boolean; canReopen: boolean;
}) {
  const [rows, setRows] = React.useState<FieldReportRow[]>(initial);
  const [open, setOpen] = React.useState<string | null>(initial[0]?.id ?? null);
  const [adding, setAdding] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [quick, setQuick] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const todayLog = rows.find((r) => r.log_date === today);

  async function reload(focus?: string) {
    const res = await fetch(`/api/jobs/${jobId}/field-reports`);
    if (!res.ok) return;
    const d = await res.json();
    setRows(d.reports);
    if (focus) setOpen(focus);
    else if (!open && d.reports[0]) setOpen(d.reports[0].id);
  }

  async function addQuick() {
    if (!quick.trim()) return;
    setBusy(true); setBanner(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/field-reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notes: quick }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't add it.");
      setQuick(""); await reload(d.log.id); setBanner("Added to today's log and sorted into sections.");
    } catch (e) { setBanner((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">{todayLog ? `Today: ${todayLog.title ?? "Daily Log"}` : "Today's log"}</div>
              <p className="text-xs text-muted-foreground">Type it however it comes out, or use Record and Camera on your phone. It all goes into one log for the day.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" /> Photos, voice or more</Button>
          </div>
          <textarea value={quick} onChange={(e) => setQuick(e.target.value)} rows={3} placeholder="e.g. Framing crew finished the north wall. Ideal Temp was here for rough HVAC, 3 guys. Plumbing inspection passed. Ben to order the tile by Friday."
            className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-accent" />
          <div className="mt-2 flex items-center justify-end gap-2">
            {banner ? <span className="mr-auto text-xs text-muted-foreground">{banner}</span> : null}
            <Button size="sm" variant="accent" onClick={() => void addQuick()} disabled={busy || !quick.trim()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Add to today&apos;s log</Button>
          </div>
        </div>
      ) : null}

      {!rows.length ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">No field reports yet. Add the first entry above, or record one from your phone.</div>
      ) : null}

      {rows.map((r) => (
        <ReportCard key={r.id} jobId={jobId} row={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)}
          canEdit={canEdit} canReopen={canReopen} onChanged={(next) => setRows((all) => all.map((x) => (x.id === next.id ? next : x)))} />
      ))}

      {adding ? (
        <AddDailyLogDialog preselect={{ kind: "job", id: jobId }} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void reload(todayLog?.id); }} />
      ) : null}
    </div>
  );
}

function ReportCard({ jobId, row, open, onToggle, canEdit, canReopen, onChanged }: {
  jobId: string; row: FieldReportRow; open: boolean; onToggle: () => void; canEdit: boolean; canReopen: boolean;
  onChanged: (r: FieldReportRow) => void;
}) {
  const [draft, setDraft] = React.useState<LogSections>(row.sections);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [showRaw, setShowRaw] = React.useState(false);
  const [changes, setChanges] = React.useState<{ at: string; field: string; by: string | null; new_value: string | null }[] | null>(null);
  // Take the saved version when it changes (a new capture, a save), unless there are unsaved edits.
  const [seen, setSeen] = React.useState(row.updated_at);
  if (seen !== row.updated_at && !dirty) { setSeen(row.updated_at); setDraft(row.sections); }

  const flags = needsALook(draft);
  const submitted = row.status === "submitted";
  const count = draft.items.length;

  const edit = (fn: (items: LogItem[]) => LogItem[]) => { setDraft((d) => ({ ...d, items: fn(d.items) })); setDirty(true); };
  const patchItem = (id: string, p: Partial<LogItem>) => edit((items) => items.map((i) => (i.id === id ? { ...i, ...p } : i)));

  async function save(): Promise<FieldReportRow | null> {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/field-reports/${row.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sections: draft }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't save.");
      setDirty(false); onChanged(d.log); setMsg(submitted ? "Saved. The edit is recorded on the submitted log." : "Saved.");
      return d.log;
    } catch (e) { setMsg((e as Error).message); return null; } finally { setSaving(false); }
  }

  async function act(action: "submit" | "reopen") {
    if (action === "submit" && flags.length && !(await confirmAction({ title: "Submit with items to look at?", body: `${flags.length} item${flags.length === 1 ? "" : "s"} in Needs a look. You can still edit after submitting; edits are recorded.`, confirmLabel: "Submit anyway" }))) return;
    if (dirty && !(await save())) return;
    setSaving(true); setMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/field-reports/${row.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Couldn't update the log.");
      onChanged(d.log);
      setMsg(action === "submit" ? `Submitted.${d.commitments ? ` ${d.commitments} action item${d.commitments === 1 ? "" : "s"} added to Commitments.` : ""}` : "Reopened as a draft.");
    } catch (e) { setMsg((e as Error).message); } finally { setSaving(false); }
  }

  async function loadChanges() {
    const res = await fetch(`/api/jobs/${jobId}/field-reports/${row.id}`);
    if (res.ok) setChanges((await res.json()).changes);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/40">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <span className="font-medium">{row.log_number ? `Daily Log #${row.log_number}` : "Daily Log"}</span>
        <span className="text-sm text-muted-foreground">{fmtDate(row.log_date)}</span>
        {row.weather ? <span className="text-xs text-muted-foreground">{row.weather}{row.temperature ? ` · ${row.temperature}` : ""}</span> : null}
        <span className="ml-auto flex items-center gap-2">
          {flags.length && !submitted ? <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{flags.length} to look at</span> : null}
          <span className="text-xs text-muted-foreground">{count} item{count === 1 ? "" : "s"} · {(row.photos ?? []).length} photo{(row.photos ?? []).length === 1 ? "" : "s"}</span>
          {submitted ? <Badge tone="success"><Lock className="mr-1 h-3 w-3" />Submitted</Badge> : <Badge tone="warning">Draft</Badge>}
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {flags.length ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" /> Needs a look before you submit</div>
              <ul className="space-y-0.5 text-sm">{flags.map((f) => <li key={f.key}>{f.text}</li>)}</ul>
            </div>
          ) : count ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Nothing missing.</div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {SECTION_KEYS.map((k) => {
              const items = draft.items.filter((i) => i.section === k);
              return (
                <section key={k} className="rounded-md border border-border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_LABELS[k]}</h4>
                    {INTERNAL_SECTIONS.includes(k) ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Internal</span> : null}
                    {canEdit ? (
                      <button type="button" onClick={() => edit((all) => [...all, { id: newItemId(), section: k, text: "", source: "typed" }])}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Plus className="h-3 w-3" /> Add</button>
                    ) : null}
                  </div>
                  {!items.length ? <p className="text-xs text-muted-foreground">{HINT[k] ?? "Nothing yet."}</p> : (
                    <ul className="space-y-2">
                      {items.map((i) => <ItemRow key={i.id} item={i} canEdit={canEdit} onChange={(p) => patchItem(i.id, p)} onRemove={() => edit((all) => all.filter((x) => x.id !== i.id))} />)}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>

          {(row.photos ?? []).length ? (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Photos</h4>
              <div className="flex flex-wrap gap-2">
                {(row.photos ?? []).map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote job photos, same as the rest of Daily Logs
                  <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" className="h-20 w-28 rounded object-cover" /></a>
                ))}
              </div>
            </div>
          ) : null}

          {draft.raw.length ? (
            <div>
              <button type="button" onClick={() => setShowRaw((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                {showRaw ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Original words ({draft.raw.length})
              </button>
              {showRaw ? (
                <ul className="mt-2 space-y-2">
                  {draft.raw.map((c, n) => (
                    <li key={n} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                      <div className="mb-1 text-[11px] text-muted-foreground">{new Date(c.at).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit" })}{c.by ? ` · ${c.by}` : ""}{c.unsorted ? " · sorted by keywords" : ""}</div>
                      <p className="whitespace-pre-wrap">{c.text}</p>
                      {c.audio_url ? <audio controls src={c.audio_url} className="mt-1 h-8 w-full max-w-sm" /> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {submitted ? (
            <div>
              <button type="button" onClick={() => (changes ? setChanges(null) : void loadChanges())} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                {changes ? "Hide edits after submit" : "Edits after submit"}
              </button>
              {changes ? (changes.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {changes.map((c, n) => <li key={n}>{new Date(c.at).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {c.by ?? "Someone"} · {c.field}</li>)}
                </ul>
              ) : <p className="mt-1 text-xs text-muted-foreground">No edits since it was submitted.</p>) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {msg ? <span className="mr-auto text-xs text-muted-foreground">{msg}</span> : <span className="mr-auto" />}
            <a href={`/api/jobs/${jobId}/field-reports/${row.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"><FileText className="h-3.5 w-3.5" /> PDF</a>
            {canEdit && dirty ? <Button size="sm" variant="outline" onClick={() => void save()} disabled={saving}>Save changes</Button> : null}
            {canEdit && !submitted ? <Button size="sm" variant="accent" onClick={() => void act("submit")} disabled={saving || !count}>{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Submit</Button> : null}
            {canReopen && submitted ? <Button size="sm" variant="ghost" onClick={() => void act("reopen")} disabled={saving}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const field = "h-7 rounded border border-border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-accent";

function ItemRow({ item, canEdit, onChange, onRemove }: { item: LogItem; canEdit: boolean; onChange: (p: Partial<LogItem>) => void; onRemove: () => void }) {
  const t = item.section;
  return (
    <li className="group rounded border border-transparent hover:border-border/60">
      <div className="flex items-start gap-1.5">
        <button type="button" disabled={!canEdit} onClick={() => onChange({ star: !item.star })} title={item.star ? "Starred for the Executive Summary" : "Star for the Executive Summary"}
          aria-pressed={!!item.star} className={cn("mt-1 shrink-0", item.star ? "text-amber-500" : "text-muted-foreground/40 hover:text-amber-500")}>
          <Star className={cn("h-3.5 w-3.5", item.star && "fill-current")} />
        </button>
        {t === "onsite" ? (
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            <input className={cn(field, "min-w-0 flex-[2]")} placeholder="Company" value={item.company ?? ""} disabled={!canEdit} onChange={(e) => onChange({ company: e.target.value, text: e.target.value })} />
            <input className={cn(field, "min-w-0 flex-1")} placeholder="Trade" value={item.trade ?? ""} disabled={!canEdit} onChange={(e) => onChange({ trade: e.target.value })} />
            <input className={cn(field, "w-16")} placeholder="Crew" inputMode="numeric" value={item.crew ?? ""} disabled={!canEdit} onChange={(e) => onChange({ crew: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} />
            <input className={cn(field, "w-16")} placeholder="Hours" inputMode="decimal" value={item.hours ?? ""} disabled={!canEdit} onChange={(e) => onChange({ hours: e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        ) : (
          <textarea rows={1} value={item.text} disabled={!canEdit} onChange={(e) => onChange({ text: e.target.value })}
            className="min-h-7 min-w-0 flex-1 resize-y rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none hover:border-border focus:border-border focus:bg-background" />
        )}
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100">
            <select aria-label="Move to section" value={t} onChange={(e) => onChange({ section: e.target.value as SectionKey })} className="h-7 max-w-[7.5rem] rounded border border-border bg-background px-1 text-[11px]">
              {SECTION_KEYS.map((k) => <option key={k} value={k}>{SECTION_LABELS[k]}</option>)}
            </select>
            <button type="button" onClick={onRemove} aria-label="Remove" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ) : null}
      </div>
      {t === "inspections" ? <div className="ml-5 mt-1"><input className={cn(field, "w-full")} placeholder="Result (passed, failed: …)" value={item.result ?? ""} disabled={!canEdit} onChange={(e) => onChange({ result: e.target.value })} /></div> : null}
      {t === "delays" ? <div className="ml-5 mt-1"><input className={cn(field, "w-full")} placeholder="Impact (time lost, what it holds up)" value={item.impact ?? ""} disabled={!canEdit} onChange={(e) => onChange({ impact: e.target.value })} /></div> : null}
      {t === "actions" ? (
        <div className="ml-5 mt-1 flex flex-wrap gap-1.5">
          <input className={cn(field, "min-w-0 flex-1")} placeholder="Owner" value={item.owner ?? ""} disabled={!canEdit} onChange={(e) => onChange({ owner: e.target.value })} />
          <input className={cn(field, "w-36")} type="date" value={item.due ?? ""} disabled={!canEdit} onChange={(e) => onChange({ due: e.target.value || null })} />
          {item.commitment_id ? <span className="self-center text-[11px] text-emerald-700 dark:text-emerald-400">In Commitments</span> : null}
        </div>
      ) : null}
    </li>
  );
}
