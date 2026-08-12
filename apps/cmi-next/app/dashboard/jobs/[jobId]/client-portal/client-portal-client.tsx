"use client";

import * as React from "react";
import Link from "next/link";
import { Megaphone, Mic, Send, Trash2, UserPlus, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { UPDATE_TYPES } from "@/lib/job-updates/types";
import type { JobUpdate } from "@/lib/job-updates/types";
import type { JobWithRelations, JobContact } from "@/lib/jobs/types";
import { JobModuleShell, Field, inputCls, fmtDate } from "../job-module-shell";

export function ClientPortalClient({ job, initialUpdates, clients }: { job: JobWithRelations; initialUpdates: JobUpdate[]; clients: JobContact[] }) {
  const [enabled, setEnabled] = React.useState(!!job.client_portal_enabled);
  const [settings, setSettings] = React.useState({
    progress_percentage: job.progress_percentage?.toString() ?? "", current_phase: job.current_phase ?? "",
    next_milestone: job.next_milestone ?? "", client_description: job.client_description ?? "", cover_image_url: job.cover_image_url ?? "",
  });
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [savingSettings, setSavingSettings] = React.useState(false);

  const [updates, setUpdates] = React.useState<JobUpdate[]>(initialUpdates);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [upd, setUpd] = React.useState({ title: "", body: "", update_type: "general", visibility: "client_visible", client_action_required: false });
  const [posting, setPosting] = React.useState(false);

  const [inviting, setInviting] = React.useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = React.useState<string | null>(null);

  const clientUrl = typeof window !== "undefined" ? `${window.location.origin}/client/jobs/${job.id}` : `/client/jobs/${job.id}`;

  async function saveSettings() {
    setSavingSettings(true); setSavedMsg(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_portal_enabled: enabled,
          progress_percentage: settings.progress_percentage ? Number(settings.progress_percentage) : null,
          current_phase: settings.current_phase || null, next_milestone: settings.next_milestone || null,
          client_description: settings.client_description || null, cover_image_url: settings.cover_image_url || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSavedMsg("Saved.");
    } catch (e) { setSavedMsg(e instanceof Error ? e.message : "Save failed."); } finally { setSavingSettings(false); }
  }

  async function publish() {
    if (!upd.title.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/updates`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(upd) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setUpdates((u) => [j, ...u]); setUpd({ title: "", body: "", update_type: "general", visibility: "client_visible", client_action_required: false });
    } catch { /* noop */ } finally { setPosting(false); }
  }
  async function deleteUpdate(id: string) {
    const res = await fetch(`/api/jobs/${job.id}/updates/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setUpdates((u) => u.filter((x) => x.id !== id));
  }

  async function invite(jc: JobContact) {
    setInviting(jc.id); setInviteMsg(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/clients/${jc.id}/invite`, { method: "POST" });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setInviteMsg(`Invite sent to ${j.email}.`);
    } catch (e) { setInviteMsg(e instanceof Error ? e.message : "Invite failed."); } finally { setInviting(null); }
  }

  return (
    <JobModuleShell jobId={job.id} jobName={job.job_name} active="client-portal" title="Client Portal">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Enable + settings */}
        <Section title="Portal Settings">
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Client portal enabled for this job</label>
          <p className="mt-1 text-xs text-muted-foreground">When enabled, invited clients can view the client-visible parts of this job at their portal.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Progress %"><input type="number" min={0} max={100} className={inputCls} value={settings.progress_percentage} onChange={(e) => setSettings({ ...settings, progress_percentage: e.target.value })} /></Field>
            <Field label="Current Phase"><input className={inputCls} value={settings.current_phase} onChange={(e) => setSettings({ ...settings, current_phase: e.target.value })} placeholder="e.g. Framing" /></Field>
            <Field label="Next Milestone" className="sm:col-span-2"><input className={inputCls} value={settings.next_milestone} onChange={(e) => setSettings({ ...settings, next_milestone: e.target.value })} /></Field>
            <Field label="Cover Image URL" className="sm:col-span-2"><input className={inputCls} value={settings.cover_image_url} onChange={(e) => setSettings({ ...settings, cover_image_url: e.target.value })} placeholder="https://…" /></Field>
            <Field label="Client-Facing Description" className="sm:col-span-2"><Textarea value={settings.client_description} onChange={(e) => setSettings({ ...settings, client_description: e.target.value })} /></Field>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground">Client link: <span className="font-mono">{clientUrl}</span></div>
            <div className="flex items-center gap-3">{savedMsg && <span className="text-sm text-muted-foreground">{savedMsg}</span>}<Button size="sm" variant="accent" onClick={() => void saveSettings()} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save"}</Button></div>
          </div>
        </Section>

        {/* Clients / invites */}
        <Section title="Client Access">
          {inviteMsg && <div className="mb-2 rounded-md bg-muted px-3 py-2 text-sm">{inviteMsg}</div>}
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No client contacts on this job yet. Add them in <Link href={`/dashboard/jobs/${job.id}/info`} className="text-accent hover:underline">Job Info → Clients</Link>.</p>
          ) : (
            <div className="space-y-2">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim() || "Client"}</div>
                    <div className="text-xs text-muted-foreground">{c.contact?.email ?? "No email"} {c.portal_access_enabled && <Badge tone="success">Portal on</Badge>}</div>
                  </div>
                  <Button size="sm" variant="outline" disabled={!c.contact?.email || inviting === c.id} onClick={() => void invite(c)}><UserPlus className="h-3.5 w-3.5" /> {inviting === c.id ? "Sending…" : "Invite"}</Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">Fine-grained visibility (financials, schedule, submit permissions) is set per client in Job Info → Clients.</p>
        </Section>

        {/* Publish update */}
        <Section title="Publish Client Update">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2"><input className={inputCls} value={upd.title} onChange={(e) => setUpd({ ...upd, title: e.target.value })} /></Field>
            <Field label="Type"><Select value={upd.update_type} onChange={(e) => setUpd({ ...upd, update_type: e.target.value })}>{UPDATE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}</Select></Field>
            <Field label="Visibility"><Select value={upd.visibility} onChange={(e) => setUpd({ ...upd, visibility: e.target.value })}><option value="client_visible">Client visible</option><option value="internal">Internal only</option><option value="team">Team</option></Select></Field>
          </div>
          <Field label="Message" className="mt-3"><Textarea value={upd.body} onChange={(e) => setUpd({ ...upd, body: e.target.value })} /></Field>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={upd.client_action_required} onChange={(e) => setUpd({ ...upd, client_action_required: e.target.checked })} /> Client action required</label>
          <div className="mt-3 flex justify-end"><Button size="sm" variant="accent" onClick={() => void publish()} disabled={posting || !upd.title.trim()}><Megaphone className="h-3.5 w-3.5" /> {posting ? "Posting…" : "Publish"}</Button></div>

          <div className="mt-4 space-y-2">
            {updates.map((u) => (
              <div key={u.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="flex min-w-0 items-start gap-3">
                  {((u.media && u.media.length > 0) || u.photo_url) && (() => {
                    const cover = u.media?.find((m) => m.type === "image")?.url ?? u.photo_url;
                    const count = u.media?.length ?? (u.photo_url ? 1 : 0);
                    return (
                      <button type="button" onClick={() => { if (cover) setPreview(cover); }} className="relative shrink-0">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt={u.title} className="h-12 w-12 rounded border border-border object-cover" />
                        ) : (
                          <span className="grid h-12 w-12 place-items-center rounded border border-border bg-muted text-muted-foreground">
                            {u.media?.some((m) => m.type === "audio") ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                          </span>
                        )}
                        {count > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-accent px-1 text-[9px] font-semibold text-white">{count}</span>}
                      </button>
                    );
                  })()}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm"><span className="font-medium">{u.title}</span><Badge tone={u.visibility === "client_visible" ? "success" : "default"}>{u.visibility.replace(/_/g, " ")}</Badge></div>
                    {u.body && <div className="text-xs text-muted-foreground line-clamp-2">{u.body}</div>}
                    {u.media?.filter((m) => m.type === "audio").map((m, i) => (
                      <audio key={i} src={m.url} controls preload="none" className="mt-1.5 h-9 w-full max-w-[260px]" />
                    ))}
                    <div className="text-[11px] text-muted-foreground">{fmtDate(u.created_at)}</div>
                  </div>
                </div>
                <button type="button" onClick={() => void deleteUpdate(u.id)} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </Section>

        {/* Action items, warranty + messages management */}
        <ActionItemsPanel jobId={job.id} clients={clients} />
        <WarrantyPanel jobId={job.id} />
        <MessagesPanel jobId={job.id} />
      </div>

      {preview && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/85 p-4" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <div className="flex justify-end text-white">
            <button type="button" aria-label="Close" className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="" className="mx-auto my-auto max-h-[85vh] max-w-full rounded object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </JobModuleShell>
  );
}

// ── Action items ──
type ActionItemRow = { id: string; title: string; status: string; priority: string; due_date: string | null; assigned_contact_id: string | null; assigned_contact?: { first_name: string | null; last_name: string | null } | null };
function ActionItemsPanel({ jobId, clients }: { jobId: string; clients: JobContact[] }) {
  const [rows, setRows] = React.useState<ActionItemRow[] | null>(null);
  const [f, setF] = React.useState({ title: "", assigned_contact_id: "", priority: "normal", due_date: "" });
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { fetch(`/api/jobs/${jobId}/action-items`).then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([])); }, [jobId]);
  async function add() {
    if (!f.title.trim()) return; setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/action-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, assigned_contact_id: f.assigned_contact_id || null, due_date: f.due_date || null }) });
      const j = await res.json(); if (res.ok) { setRows((r) => [j, ...(r ?? [])]); setF({ title: "", assigned_contact_id: "", priority: "normal", due_date: "" }); }
    } finally { setBusy(false); }
  }
  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/jobs/${jobId}/action-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { const j = await res.json(); setRows((r) => (r ?? []).map((x) => (x.id === id ? j : x))); }
  }
  async function remove(id: string) {
    const res = await fetch(`/api/jobs/${jobId}/action-items/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((r) => (r ?? []).filter((x) => x.id !== id));
  }
  return (
    <Section title="Client Action Items">
      <div className="grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto]">
        <input className={inputCls} placeholder="What does the client need to do?" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <Select value={f.assigned_contact_id} onChange={(e) => setF({ ...f, assigned_contact_id: e.target.value })}><option value="">— Assign client —</option>{clients.map((c) => <option key={c.id} value={c.contact_id ?? ""}>{`${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim() || "Client"}</option>)}</Select>
        <Select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></Select>
        <Button size="sm" variant="accent" onClick={() => void add()} disabled={busy || !f.title.trim()}>Add</Button>
      </div>
      <div className="mt-3 space-y-2">
        {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No action items.</p> : rows.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
            <div>
              <span className={a.status === "completed" ? "text-muted-foreground line-through" : "font-medium"}>{a.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">{a.assigned_contact ? `${a.assigned_contact.first_name ?? ""} ${a.assigned_contact.last_name ?? ""}`.trim() : "Unassigned"}{a.due_date ? ` · due ${fmtDate(a.due_date)}` : ""}</span>
            </div>
            <div className="flex items-center gap-2">
              {a.status !== "completed" && <button type="button" onClick={() => void patch(a.id, { status: "completed" })} className="text-xs text-accent hover:underline">Complete</button>}
              <button type="button" onClick={() => void remove(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Warranty triage ──
type Warranty = { id: string; request_title: string; status: string; category: string | null; submitted_by: string | null; submitted_at: string; resolution_notes: string | null };
const W_STATUSES = ["submitted", "under_review", "scheduled", "in_progress", "resolved", "closed"];
function WarrantyPanel({ jobId }: { jobId: string }) {
  const [rows, setRows] = React.useState<Warranty[] | null>(null);
  React.useEffect(() => { fetch(`/api/jobs/${jobId}/warranty`).then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d : [])).catch(() => setRows([])); }, [jobId]);
  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/jobs/${jobId}/warranty`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: id, ...body }) });
    if (res.ok) { const j = await res.json(); setRows((r) => (r ?? []).map((x) => (x.id === id ? j : x))); }
  }
  return (
    <Section title="Warranty Requests">
      {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No warranty requests.</p> : (
        <div className="space-y-2">
          {rows.map((w) => (
            <div key={w.id} className="rounded-md border border-border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{w.request_title}</div>
                <select value={w.status} onChange={(e) => void patch(w.id, { status: e.target.value })} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                  {W_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="text-xs text-muted-foreground">{[w.category, w.submitted_by].filter(Boolean).join(" · ")} · {fmtDate(w.submitted_at)}</div>
              <input defaultValue={w.resolution_notes ?? ""} onBlur={(e) => { if (e.target.value !== (w.resolution_notes ?? "")) void patch(w.id, { resolution_notes: e.target.value }); }} placeholder="Resolution note (visible to client)" className={`${inputCls} mt-2`} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── Client messages ──
type Msg = { id: string; sender_type: string; sender_name: string | null; body: string; created_at: string };
function MessagesPanel({ jobId }: { jobId: string }) {
  const [msgs, setMsgs] = React.useState<Msg[] | null>(null);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { fetch(`/api/jobs/${jobId}/messages`).then((r) => r.json()).then((d) => setMsgs(Array.isArray(d) ? d : [])).catch(() => setMsgs([])); }, [jobId]);
  async function reply() {
    if (!body.trim()) return; setBusy(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const j = await res.json(); if (res.ok) { setMsgs((m) => [...(m ?? []), j]); setBody(""); }
    } finally { setBusy(false); }
  }
  return (
    <Section title="Client Messages">
      {msgs === null ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {msgs.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
            {msgs.map((m) => (
              <div key={m.id} className={`rounded-md px-3 py-2 text-sm ${m.sender_type === "staff" ? "bg-accent/10" : "border border-border bg-background"}`}>
                <div className="text-[11px] font-medium text-muted-foreground">{m.sender_name ?? (m.sender_type === "staff" ? "CMI" : "Client")} · {fmtDate(m.created_at)}</div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-end gap-2">
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Reply to client…" className={`${inputCls} h-auto flex-1 py-2`} />
            <Button size="sm" variant="accent" onClick={() => void reply()} disabled={busy || !body.trim()}><Send className="h-3.5 w-3.5" /> Reply</Button>
          </div>
        </>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</div><div className="rounded-lg border border-border bg-card p-4">{children}</div></div>;
}
