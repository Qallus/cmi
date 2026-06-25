"use client";

import * as React from "react";
import {
  Archive, ArrowLeft, Check, FileText, Image as ImageIcon, Loader2, Mic, RotateCcw,
  Save, Sparkles, Trash2, Upload, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { AudioRecorder } from "@/components/audio/audio-recorder";
import { AudioPlayer } from "@/components/audio/audio-player";
import { cn } from "@/lib/utils";
import { MEETING_TYPES, MEETING_TYPE_LABELS, type Meeting, type MeetingActionItem, type MeetingStatus } from "@/lib/meetings/types";

export type LinkOption = { id: string; label: string };
type Options = { contacts: LinkOption[]; projects: LinkOption[]; quotes: LinkOption[] };

const STATUSES: MeetingStatus[] = ["draft", "processing", "transcribed", "reviewed", "action_items_created", "shared_with_client", "archived"];
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", processing: "Processing", transcribed: "Transcribed", reviewed: "Reviewed",
  action_items_created: "Action items created", shared_with_client: "Shared with client", archived: "Archived",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>{children}</div>;
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function MeetingDetail({ id, options, onBack, onDeleted }: { id: string; options: Options; onBack: () => void; onDeleted: () => void }) {
  const [meeting, setMeeting] = React.useState<Meeting | null>(null);
  const [playbackUrl, setPlaybackUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [summarizing, setSummarizing] = React.useState(false);
  const [recorderOpen, setRecorderOpen] = React.useState(false);
  const [savedDrawerOpen, setSavedDrawerOpen] = React.useState(false);
  const [imgBusy, setImgBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Editable form
  const [f, setF] = React.useState<Partial<Meeting>>({});

  const reload = React.useCallback(async () => {
    const res = await fetch(`/api/meetings/${id}`);
    const json = await res.json();
    if (res.ok) {
      setMeeting(json.meeting);
      setPlaybackUrl(json.playbackUrl ?? null);
      setF(json.meeting);
    } else {
      setError(json.error || "Failed to load meeting.");
    }
  }, [id]);

  React.useEffect(() => { (async () => { setLoading(true); await reload(); setLoading(false); })(); }, [reload]);

  function set<K extends keyof Meeting>(k: K, v: Meeting[K]) { setF((p) => ({ ...p, [k]: v })); }

  async function save() {
    setSaving(true); setError(null); setNotice(null);
    try {
      const payload = {
        title: f.title, meeting_type: f.meeting_type, meeting_date: f.meeting_date, location: f.location,
        contact_id: f.contact_id || null, project_item_id: f.project_item_id || null, quote_id: f.quote_id || null,
        attendees: f.attendees, status: f.status, follow_up_notes: f.follow_up_notes,
        internal_notes: f.internal_notes, client_notes: f.client_notes, client_visible: f.client_visible,
      };
      const res = await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setNotice("Saved.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally { setSaving(false); }
  }

  async function uploadBlob(blob: Blob, filename: string) {
    setUploading(true); setError(null);
    try {
      const u = await fetch("/api/meetings/upload-url", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ meetingId: id, filename }),
      }).then((r) => r.json());
      if (u.error) throw new Error(u.error);
      const put = await fetch(u.signedUrl, { method: "PUT", body: blob, headers: { "content-type": blob.type || "application/octet-stream", "x-upsert": "true" } });
      if (!put.ok) throw new Error("Upload to storage failed.");
      await fetch(`/api/meetings/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ recording_bucket: "meeting-recordings", recording_path: u.path, recording_filename: filename, recording_mime: blob.type || "application/octet-stream" }),
      });
      setNotice("Recording uploaded.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally { setUploading(false); }
  }

  async function removeRecordingFile() {
    if (!window.confirm("Delete this audio recording? The transcript and notes are kept.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/meetings/${id}/recording`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not remove recording.");
      setNotice("Recording removed.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove recording.");
    }
  }

  async function uploadImage(file: File) {
    setImgBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "meetings");
      const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error || "Image upload failed.");
      set("image_url", json.url);
      await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_url: json.url }) });
      setMeeting((m) => m ? { ...m, image_url: json.url } : m);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    } finally { setImgBusy(false); }
  }

  async function removeImage() {
    set("image_url", null);
    await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ image_url: null }) });
    setMeeting((m) => m ? { ...m, image_url: null } : m);
  }

  async function setArchived(archived: boolean) {
    await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: archived ? "archived" : "reviewed" }) });
    if (archived) onBack();
    else { set("status", "reviewed"); await reload(); }
  }

  async function onRecorded(blob: Blob) {
    setRecorderOpen(false);
    await uploadBlob(blob, `recording-${Date.now()}.webm`);
    setSavedDrawerOpen(true);
  }

  async function transcribe() {
    setTranscribing(true); setError(null);
    try {
      const res = await fetch(`/api/meetings/${id}/transcribe`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Transcription failed.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally { setTranscribing(false); }
  }

  async function summarize() {
    setSummarizing(true); setError(null);
    try {
      const res = await fetch(`/api/meetings/${id}/summarize`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Summary failed.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary failed.");
    } finally { setSummarizing(false); }
  }

  async function toggleActionItem(item: MeetingActionItem) {
    const next = (meeting?.action_items ?? []).map((a) => a.id === item.id ? { ...a, done: !a.done } : a);
    setMeeting((m) => m ? { ...m, action_items: next } : m);
    await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action_items: next }) });
  }

  async function remove() {
    if (!window.confirm("Delete this meeting and its recording? This cannot be undone.")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    onDeleted();
  }

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading meeting…</div>;
  if (!meeting) return <div className="p-8 text-sm text-destructive">{error || "Meeting not found."}</div>;

  const attendeesText = (f.attendees ?? []).map((a) => a.name).join("\n");

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col overflow-y-auto">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to recordings</button>
        <div className="flex items-center gap-2">
          {notice && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{notice}</span>}
          {error && <span className="max-w-[320px] truncate text-xs font-medium text-destructive">{error}</span>}
          <select value={f.status} onChange={(e) => set("status", e.target.value as MeetingStatus)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {meeting.status === "archived" ? (
            <Button size="sm" variant="outline" onClick={() => setArchived(false)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setArchived(true)}><Archive className="h-3.5 w-3.5" /> Archive</Button>
          )}
          <Button size="sm" variant="outline" onClick={remove} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
          <Button size="sm" variant="accent" onClick={save} disabled={saving}><Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="grid flex-1 gap-5 p-5 lg:grid-cols-[1fr_1fr]">
        {/* Left: details + recording */}
        <div className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">Overview</div>
            <Field label="Title"><Input value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <Select value={f.meeting_type} onChange={(e) => set("meeting_type", e.target.value)}>
                  {MEETING_TYPES.map((t) => <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>)}
                </Select>
              </Field>
              <Field label="Date & time"><Input type="datetime-local" value={toLocalInput(f.meeting_date ?? null)} onChange={(e) => set("meeting_date", e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
            </div>
            <Field label="Location / platform"><Input value={f.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="Office, job site, Zoom link…" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Contact / client">
                <Select value={f.contact_id ?? ""} onChange={(e) => set("contact_id", e.target.value || null)}>
                  <option value="">—</option>{options.contacts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Project">
                <Select value={f.project_item_id ?? ""} onChange={(e) => set("project_item_id", e.target.value || null)}>
                  <option value="">—</option>{options.projects.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Quote / lead">
              <Select value={f.quote_id ?? ""} onChange={(e) => set("quote_id", e.target.value || null)}>
                <option value="">—</option>{options.quotes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Attendees (one per line)">
              <Textarea rows={3} value={attendeesText} onChange={(e) => set("attendees", e.target.value.split("\n").map((s) => s.trim()).filter(Boolean).map((name) => ({ name })))} />
            </Field>
          </div>

          {/* Recording */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">Recording</div>
            {meeting.recording_path && playbackUrl ? (
              <div className="space-y-2">
                <AudioPlayer src={playbackUrl} filename={meeting.recording_filename ?? "recording"} />
                <div className="truncate text-[11px] text-muted-foreground">{meeting.recording_filename}</div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No recording yet — upload an audio file or record one in the browser.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : meeting.recording_path ? "Replace audio" : "Upload audio"}
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadBlob(file, file.name); e.target.value = ""; }} />
              </label>
              <Button size="sm" variant="outline" onClick={() => setRecorderOpen(true)} disabled={uploading}><Mic className="h-3.5 w-3.5" /> Record audio</Button>
              {meeting.recording_path && (
                <Button size="sm" variant="outline" onClick={removeRecordingFile} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove recording</Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Whisper transcribes files up to 25MB — audio-only keeps long meetings under the limit.</p>

            {/* Image / photo */}
            <div className="border-t border-border pt-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Photo / image (optional)</div>
              {f.image_url ? (
                <div className="space-y-2">
                  <img src={f.image_url} alt="Meeting" className="max-h-52 w-full rounded-lg border border-border object-contain" />
                  <div className="flex gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" /> {imgBusy ? "Uploading…" : "Replace"}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = ""; }} />
                    </label>
                    <Button size="sm" variant="outline" onClick={removeImage} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /> Remove</Button>
                  </div>
                </div>
              ) : (
                <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted">
                  <ImageIcon className="h-3.5 w-3.5" /> {imgBusy ? "Uploading…" : "Upload image"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="text-sm font-semibold">Notes</div>
            <Field label="Internal notes (staff only)"><Textarea rows={3} value={f.internal_notes ?? ""} onChange={(e) => set("internal_notes", e.target.value)} /></Field>
            <Field label="Follow-up notes"><Textarea rows={2} value={f.follow_up_notes ?? ""} onChange={(e) => set("follow_up_notes", e.target.value)} /></Field>
            <Field label="Client-facing notes"><Textarea rows={2} value={f.client_notes ?? ""} onChange={(e) => set("client_notes", e.target.value)} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(f.client_visible)} onChange={(e) => set("client_visible", e.target.checked)} /> Client-facing summary approved for sharing</label>
          </div>
        </div>

        {/* Right: intelligence */}
        <div className="space-y-5">
          {/* Transcript */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold"><FileText className="h-4 w-4 text-accent" /> Transcript</div>
              <Button size="sm" variant="outline" onClick={transcribe} disabled={transcribing || !meeting.recording_path}>
                {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} {meeting.transcript ? "Re-transcribe" : "Transcribe"}
              </Button>
            </div>
            {meeting.transcript ? (
              <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground/80">{meeting.transcript}</div>
            ) : (
              <p className="text-xs text-muted-foreground">{meeting.recording_path ? "Click Transcribe to generate the transcript." : "Add a recording first."}</p>
            )}
          </div>

          {/* AI summary */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-accent" /> Bolt summary &amp; action items</div>
              <Button size="sm" variant="accent" onClick={summarize} disabled={summarizing || !meeting.transcript}>
                {summarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {meeting.summary ? "Regenerate" : "Generate"}
              </Button>
            </div>
            {meeting.summary ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{meeting.summary}</p>
                {(meeting.action_items ?? []).length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Action items</div>
                    <div className="space-y-1.5">
                      {meeting.action_items.map((a) => (
                        <label key={a.id} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" checked={Boolean(a.done)} onChange={() => toggleActionItem(a)} className="mt-0.5" />
                          <span className={cn(a.done && "text-muted-foreground line-through")}>{a.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {(meeting.ai_suggestions ?? []).length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Suggestions</div>
                    <ul className="space-y-1">
                      {meeting.ai_suggestions.map((s, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground"><Check className="mt-0.5 h-3 w-3 text-accent" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{meeting.transcript ? "Generate an AI summary, action items, and suggestions from the transcript." : "Transcribe the meeting first."}</p>
            )}
          </div>
        </div>
      </div>

      {/* Voice recorder modal */}
      <AudioRecorder open={recorderOpen} onClose={() => setRecorderOpen(false)} onComplete={onRecorded} />

      {/* Recording-saved drawer with player */}
      <Drawer open={savedDrawerOpen} onClose={() => setSavedDrawerOpen(false)} title="Recording saved" description="Your audio is uploaded and ready to transcribe.">
        {playbackUrl && <AudioPlayer src={playbackUrl} filename={meeting.recording_filename ?? "recording"} />}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setSavedDrawerOpen(false)}>Close</Button>
          <Button size="sm" variant="accent" onClick={() => { setSavedDrawerOpen(false); transcribe(); }} disabled={transcribing}>
            {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Transcribe now
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
