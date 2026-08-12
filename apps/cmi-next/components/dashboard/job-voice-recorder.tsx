"use client";

import * as React from "react";
import { CheckCircle2, Eye, FileText, Loader2, Mic, Square, X } from "lucide-react";

type JobOpt = { id: string; label: string };

// Mobile voice-note recorder: record → optional transcribe → attach to a job
// (audio saved to Files + a job update with the note/transcript), with an
// optional client-visibility toggle.
export function JobVoiceRecorder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [audio, setAudio] = React.useState<{ blob: Blob; url: string } | null>(null);

  const [jobs, setJobs] = React.useState<JobOpt[]>([]);
  const [jobsLoaded, setJobsLoaded] = React.useState(false);
  const [jobId, setJobId] = React.useState("");
  const [note, setNote] = React.useState("");
  const [transcribing, setTranscribing] = React.useState(false);
  const [transcribed, setTranscribed] = React.useState(false);
  const [clientVisible, setClientVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState("");

  const reset = React.useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audio) URL.revokeObjectURL(audio.url);
    setRecording(false); setElapsed(0); setAudio(null);
    setJobId(""); setNote(""); setTranscribing(false); setTranscribed(false);
    setClientVisible(false); setSaving(false); setDone(false); setErr("");
  }, [audio]);

  function close() {
    if (mediaRef.current && recording) mediaRef.current.stop();
    reset();
    onClose();
  }

  async function ensureJobs() {
    if (jobsLoaded) return;
    try {
      const rows = await fetch("/api/jobs").then((r) => r.json());
      if (Array.isArray(rows)) setJobs(rows.map((r: { id: string; job_number?: string; job_name?: string }) => ({ id: r.id, label: [r.job_number, r.job_name].filter(Boolean).join(" · ") || r.job_name || "Job" })));
      setJobsLoaded(true);
    } catch { /* modal shows empty state */ }
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
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      void ensureJobs();
    } catch {
      setErr("Microphone access was blocked. Enable mic permission in your browser and try again.");
    }
  }

  function stopRec() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function transcribe() {
    if (!audio) return;
    setTranscribing(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("file", new File([audio.blob], "recording.webm", { type: audio.blob.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Transcription failed.");
      setNote((prev) => (prev.trim() ? prev : j.transcript));
      setTranscribed(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }

  async function save() {
    if (!audio || !jobId) return;
    setSaving(true); setErr("");
    try {
      const filename = `voice-note-${Date.now()}.webm`;
      const fd = new FormData();
      fd.append("file", new File([audio.blob], filename, { type: audio.blob.type || "audio/webm" }), filename);
      fd.append("folder", "Voice Notes");
      fd.append("category", "audio");
      const fres = await fetch(`/api/jobs/${jobId}/files`, { method: "POST", body: fd });
      if (!fres.ok) { const j = await fres.json().catch(() => ({})); throw new Error(j.error || "Upload failed."); }
      const rec = await fres.json();

      await fetch(`/api/jobs/${jobId}/updates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: note.trim() ? note.trim().slice(0, 80) : "Voice note",
          body: note.trim() || null,
          media: [{ url: rec.file_url, type: "audio", name: rec.name }],
          update_type: "photo_update",
          visibility: clientVisible ? "client_visible" : "internal",
        }),
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4 lg:hidden" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{done ? "Saved to job" : "Voice note"}</h2>
          <button type="button" onClick={close} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-accent" />
            <p className="text-sm font-medium">Voice note added to the job{clientVisible ? " and shared with the client" : ""}.</p>
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
            {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{err}</p>}
          </div>
        ) : (
          // Step 2 — transcribe (optional), assign, note, visibility, save
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
            <audio src={audio.url} controls className="w-full" />
            <button type="button" onClick={reset} className="text-xs font-medium text-accent hover:underline">Re-record</button>

            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Transcribe this recording?</div>
              {transcribed ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> Transcribed into the notes below</div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => void transcribe()} disabled={transcribing} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                    {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Yes, transcribe
                  </button>
                  <button type="button" onClick={() => setTranscribed(true)} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">No</button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Attach to job</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
                <option value="">Select a job…</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </select>
              {jobsLoaded && jobs.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No jobs available.</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes {transcribed && note ? "(transcript — edit as needed)" : "(optional)"}</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Add a note or transcript…" className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Visible to client <span className="text-muted-foreground">— posts to the client portal</span></span>
            </label>
            {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">{err}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={close} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-muted">Cancel</button>
              <button type="button" onClick={() => void save()} disabled={!jobId || saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
