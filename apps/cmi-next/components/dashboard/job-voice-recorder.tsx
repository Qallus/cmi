"use client";

import * as React from "react";
import { CheckCircle2, Eye, FileText, Loader2, Mic, Square, X } from "lucide-react";
import {
  MediaDestinationPicker, useMediaTargets, EMPTY_DEST, destReady, canShareWithClient, destPhrase, type MediaDestState,
} from "./media-destination";

// Mobile voice-note recorder: record → transcribe (automatic by default) →
// save to a Job, a Pre-Con project or a Daily Log, with the transcript as the
// note. Same destinations as the Camera sheet.
export function JobVoiceRecorder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [audio, setAudio] = React.useState<{ blob: Blob; url: string } | null>(null);

  const targets = useMediaTargets();
  const [where, setWhere] = React.useState<MediaDestState>(EMPTY_DEST);
  const [note, setNote] = React.useState("");
  const [autoTranscribe, setAutoTranscribe] = React.useState(true);
  const [transcribing, setTranscribing] = React.useState(false);
  const [transcribed, setTranscribed] = React.useState(false);
  const [clientVisible, setClientVisible] = React.useState(false);
  // Saving to a Job also files it in that job's daily log unless unticked.
  const [alsoLog, setAlsoLog] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState("");

  const reset = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audio) URL.revokeObjectURL(audio.url);
    setRecording(false); setElapsed(0); setAudio(null);
    setWhere(EMPTY_DEST); setNote(""); setTranscribing(false); setTranscribed(false);
    setClientVisible(false); setSaving(false); setDone(false); setErr("");
  }, [audio]);

  function close() {
    if (mediaRef.current && recording) mediaRef.current.stop();
    reset();
    onClose();
  }

  async function transcribe(blob: Blob) {
    setTranscribing(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "recording.webm", { type: blob.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Transcription failed.");
      setNote((prev) => (prev.trim() ? `${prev.trim()}\n\n${j.transcript}` : j.transcript));
      setTranscribed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function startRec() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setAudio({ blob, url: URL.createObjectURL(blob) });
        stream.getTracks().forEach((t) => t.stop());
        if (autoTranscribe) void transcribe(blob);
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      void targets.load();
    } catch {
      setErr("Microphone access was blocked. Enable mic permission in your browser and try again.");
    }
  }

  function stopRec() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  /** Upload the recording: into the job's Files for a job, else the media bucket. */
  async function upload(jobId: string | null, folder: string): Promise<{ url: string; name: string }> {
    const filename = `voice-note-${Date.now()}.webm`;
    const fd = new FormData();
    // Drop codec parameters ("audio/webm;codecs=opus"): storage matches on the bare type.
    const type = (audio!.blob.type || "audio/webm").split(";")[0];
    fd.append("file", new File([audio!.blob], filename, { type }), filename);
    fd.append("folder", folder);
    if (jobId) {
      fd.append("category", "audio");
      const res = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || "Upload failed."); }
      const rec = await res.json();
      return { url: rec.file_url, name: rec.name };
    }
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.message || "Upload failed.");
    return { url: j.url, name: j.name };
  }

  async function save() {
    if (!audio || !destReady(where)) return;
    setSaving(true); setErr("");
    const title = note.trim() ? note.trim().slice(0, 80) : "Voice note";
    try {
      if (where.dest === "job") {
        const rec = await upload(where.jobId, "Voice Notes");
        await fetch(`/api/jobs/${where.jobId}/updates`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title, body: note.trim() || null,
            media: [{ url: rec.url, type: "audio", name: rec.name }],
            update_type: "photo_update",
            visibility: clientVisible ? "client_visible" : "internal",
          }),
        });
        if (alsoLog) {
          const res = await fetch("/api/daily-logs", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targets: [{ kind: "job", id: where.jobId }],
              title, notes: note.trim() || null,
              attachments: [{ url: rec.url, type: "audio", name: rec.name }],
              client_visible: clientVisible,
            }),
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Saved to the job, but the daily log didn't save.");
        }
      } else if (where.dest === "precon") {
        const rec = await upload(null, `pre-con/${where.oppId}`);
        const res = await fetch(`/api/pipeline/${where.oppId}/media`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media: [{ url: rec.url, type: "audio", name: rec.name }], note }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
      } else {
        const [kind, id] = where.logTarget.split(":") as ["job" | "opportunity", string];
        const rec = await upload(kind === "job" ? id : null, kind === "job" ? "Voice Notes" : `daily-logs/${id}`);
        const res = await fetch("/api/daily-logs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targets: [{ kind, id }],
            title, notes: note.trim() || null,
            attachments: [{ url: rec.url, type: "audio", name: rec.name }],
            client_visible: kind === "job" && clientVisible,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const share = canShareWithClient(where);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 lg:hidden" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{done ? "Saved" : "Voice note"}</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-accent" />
            <p className="text-sm font-medium">Voice note {destPhrase(where)}{share && clientVisible ? " and shared with the client" : ""}.</p>
            <div className="flex gap-2">
              <button type="button" onClick={close} className="rounded-lg border border-border px-4 py-2 text-sm">Done</button>
              <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Record another</button>
            </div>
          </div>
        ) : !audio ? (
          // Step 1 — record
          <div className="flex flex-col items-center gap-4 p-8">
            <div className={`grid h-24 w-24 place-items-center rounded-full ${recording ? "animate-pulse bg-red-500/15 text-red-500" : "bg-accent/10 text-accent"}`}>
              <Mic className="h-10 w-10" />
            </div>
            <div className="font-display text-2xl font-semibold tabular-nums">{mmss}</div>
            {recording ? (
              <button type="button" onClick={stopRec} className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600">
                <Square className="h-4 w-4" /> Stop
              </button>
            ) : (
              <button type="button" onClick={() => void startRec()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90">
                <Mic className="h-4 w-4" /> Start recording
              </button>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoTranscribe} onChange={(e) => setAutoTranscribe(e.target.checked)} disabled={recording} className="h-4 w-4 accent-[var(--accent)]" />
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Transcribe automatically when I stop
            </label>
            {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{err}</p>}
          </div>
        ) : (
          // Step 2 — transcript, destination, note, visibility, save
          <div className="max-h-[75vh] space-y-3 overflow-y-auto p-4">
            <audio src={audio.url} controls className="w-full" />
            <button type="button" onClick={reset} className="text-xs font-medium text-accent hover:underline">Re-record</button>

            {transcribing ? (
              <p className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Transcribing…</p>
            ) : transcribed ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Transcript added to the notes below. Edit as needed.</p>
            ) : (
              <button type="button" onClick={() => void transcribe(audio.blob)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold transition hover:border-accent hover:text-accent">
                <FileText className="h-3.5 w-3.5" /> Transcribe this recording
              </button>
            )}

            <MediaDestinationPicker value={where} onChange={setWhere} jobs={targets.jobs} opps={targets.opps} loaded={targets.loaded} />

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes {transcribed && note ? "(transcript, edit as needed)" : "(optional)"}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Add a note, or transcribe the recording" className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            {where.dest === "job" && (
              <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <input type="checkbox" checked={alsoLog} onChange={(e) => setAlsoLog(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                <span>Also add to today&apos;s daily log</span>
              </label>
            )}
            {share && (
              <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Visible to client <span className="text-muted-foreground">— posts to the client portal</span></span>
              </label>
            )}
            {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={close} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void save()} disabled={!destReady(where) || saving || transcribing} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
