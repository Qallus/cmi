"use client";

// Add a daily log from anywhere, in five steps:
//   1. Add to: Pipeline | Pre-Con | Jobs
//   2. Pick the deal / Pre-Con / Job (search; more than one is fine)
//   3–4. What happened: Compose (rich text), Record (voice → transcribed),
//        Camera (phone camera), Upload (photos/video, drag & drop) — mix freely
//   5. Visibility: Client visible (Jobs), My Daily Brief, CMI Team, Private
// The date and time are set automatically, and the weather and temperature
// are looked up for the site — no fields for them.
//
// Full-screen on phones (this is used on site), a centred dialog on desktop.
import * as React from "react";
import {
  BriefcaseBusiness, Camera, Check, HardHat, ImagePlus, Loader2, Mic, NotebookPen, PenLine,
  Search, Trash2, Upload, Workflow, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/notes/rich-text-editor";
import { AudioRecorder } from "@/components/audio/audio-recorder";
import { htmlToText } from "@/lib/notes/html";

type Kind = "deal" | "opportunity" | "job";
type Target = { kind: Kind; id: string; label: string; sub: string };
type Mode = "compose" | "record" | "camera" | "upload";
type Media = { key: number; file: File; preview: string; type: "image" | "video" };
type Voice = { key: number; blob: Blob; transcript: string | null; state: "transcribing" | "done" | "error" };

const KINDS: { kind: Kind; label: string; icon: typeof HardHat }[] = [
  { kind: "deal", label: "Pipeline", icon: Workflow },
  { kind: "opportunity", label: "Pre-Con", icon: BriefcaseBusiness },
  { kind: "job", label: "Jobs", icon: HardHat },
];
const MODES: { mode: Mode; label: string; hint: string; icon: typeof PenLine }[] = [
  { mode: "compose", label: "Compose", hint: "Write it", icon: PenLine },
  { mode: "record", label: "Record", hint: "Voice, transcribed", icon: Mic },
  { mode: "camera", label: "Camera", hint: "Take photos", icon: Camera },
  { mode: "upload", label: "Upload", hint: "Photos & video", icon: Upload },
];
let seq = 1;

export function AddDailyLogDialog({ onClose, onSaved, preselect }: {
  onClose: () => void;
  onSaved: (count: number) => void;
  preselect?: { kind: Kind; id: string } | null;
}) {
  const [targets, setTargets] = React.useState<Target[] | null>(null);
  const [kind, setKind] = React.useState<Kind | null>(preselect?.kind ?? null);
  const [picked, setPicked] = React.useState<Target[]>([]);
  const [q, setQ] = React.useState("");
  const [mode, setMode] = React.useState<Mode>("compose");
  const [notes, setNotes] = React.useState("");
  const [editorKey, setEditorKey] = React.useState(0);
  const [media, setMedia] = React.useState<Media[]>([]);
  const [voices, setVoices] = React.useState<Voice[]>([]);
  const [recording, setRecording] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const [vis, setVis] = React.useState({ client: false, brief: false, team: true, private: false });
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const uploadRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    let live = true;
    fetch("/api/daily-logs/targets").then((r) => (r.ok ? r.json() : [])).then((list: Target[]) => {
      if (!live) return;
      setTargets(list);
      const pre = preselect && list.find((t) => t.kind === preselect.kind && t.id === preselect.id);
      if (pre) setPicked([pre]);
    }).catch(() => { if (live) setTargets([]); });
    return () => { live = false; };
  }, [preselect]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !recording) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, recording]);

  // Release photo previews when the dialog closes.
  const mediaRef = React.useRef(media);
  React.useEffect(() => { mediaRef.current = media; }, [media]);
  React.useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.preview)), []);

  const key = (t: { kind: string; id: string }) => `${t.kind}:${t.id}`;
  const isPicked = (t: Target) => picked.some((p) => key(p) === key(t));
  const toggle = (t: Target) => setPicked((p) => (isPicked(t) ? p.filter((x) => key(x) !== key(t)) : [...p, t]));
  function chooseKind(k: Kind) {
    setKind(k);
    setPicked((p) => p.filter((x) => x.kind === k));
    setQ("");
  }

  const needle = q.trim().toLowerCase();
  const options = (targets ?? []).filter((t) => t.kind === kind && (!needle || `${t.label} ${t.sub}`.toLowerCase().includes(needle))).slice(0, 50);
  const anyJob = picked.some((p) => p.kind === "job");

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) return;
    setMedia((m) => [...m, ...files.map((file) => ({ key: seq++, file, preview: URL.createObjectURL(file), type: file.type.startsWith("video/") ? "video" as const : "image" as const }))]);
  }

  async function onRecorded(blob: Blob) {
    setRecording(false);
    const v: Voice = { key: seq++, blob, transcript: null, state: "transcribing" };
    setVoices((x) => [...x, v]);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], "daily-log.webm", { type: blob.type || "audio/webm" }));
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Transcription failed.");
      setVoices((x) => x.map((y) => (y.key === v.key ? { ...y, transcript: j.transcript, state: "done" } : y)));
      // The transcript lands in the log text so it can be read and edited.
      if (j.transcript?.trim()) {
        setNotes((n) => `${n}<p>${escapeHtml(j.transcript.trim())}</p>`);
        setEditorKey((k) => k + 1);
      }
    } catch {
      setVoices((x) => x.map((y) => (y.key === v.key ? { ...y, state: "error" } : y)));
    }
  }

  function setVisibility(which: keyof typeof vis, on: boolean) {
    setVis((v) => {
      const next = { ...v, [which]: on };
      // CMI Team and Private are either/or; a private log can't go to a client.
      if (which === "private" && on) { next.team = false; next.client = false; }
      if (which === "team" && on) next.private = false;
      if (which === "client" && on) { next.private = false; next.team = true; }
      if (!next.team && !next.private) next.team = true;
      return next;
    });
  }

  async function upload(file: File, folder: string): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", folder);
    const res = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.url) throw new Error(j.error || `Couldn't upload ${file.name}.`);
    return j.url as string;
  }

  async function save() {
    if (!picked.length) { setError(kind ? "Choose where this log goes (step 2)." : "Choose Pipeline, Pre-Con or Jobs (step 1)."); return; }
    const text = htmlToText(notes);
    if (!text && !media.length && !voices.length) { setError("Add what happened — write it, record it, or add photos."); return; }
    if (voices.some((v) => v.state === "transcribing")) { setError("Still transcribing your recording — one moment."); return; }
    setError(null);
    try {
      const folder = `daily-logs/${picked[0].kind}-${picked[0].id}`;
      const photos: string[] = [];
      const attachments: { url: string; type: string; name?: string }[] = [];
      for (const [i, m] of media.entries()) {
        setSaving(`Uploading ${i + 1} of ${media.length + voices.length}…`);
        const url = await upload(m.file, folder);
        if (m.type === "image") photos.push(url); else attachments.push({ url, type: "video", name: m.file.name });
      }
      for (const [i, v] of voices.entries()) {
        setSaving(`Uploading ${media.length + i + 1} of ${media.length + voices.length}…`);
        const name = `voice-note-${Date.now()}.webm`;
        attachments.push({ url: await upload(new File([v.blob], name, { type: v.blob.type || "audio/webm" }), folder), type: "audio", name });
      }
      setSaving("Saving…");
      const res = await fetch("/api/daily-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targets: picked.map(({ kind: k, id }) => ({ kind: k, id })),
          notes: text ? notes : null,
          photos, attachments,
          client_visible: anyJob && vis.client,
          include_in_brief: vis.brief,
          visibility: vis.private ? "private" : "team",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't save the log.");
      onSaved(picked.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/Phoenix", weekday: "short", month: "short", day: "numeric" });
  const step = (n: number, title: string, done?: boolean) => (
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
      <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", done ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>{done ? <Check className="h-3 w-3" /> : n}</span>
      {title}
    </div>
  );
  const attachedCount = media.length + voices.length;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !recording) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Add daily log"
        className="flex h-full w-full flex-col bg-card shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl sm:border sm:border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><NotebookPen className="h-4 w-4 text-accent" /> Add daily log</h2>
            <p className="text-[11px] text-muted-foreground">{today} · date, time and weather are added automatically</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          {/* 1. Add to */}
          <section>
            {step(1, "Add daily log to", !!kind)}
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(({ kind: k, label, icon: Icon }) => (
                <button key={k} type="button" onClick={() => chooseKind(k)}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm font-medium transition",
                    kind === k ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted")}>
                  <Icon className="h-5 w-5" /> {label}
                </button>
              ))}
            </div>
          </section>

          {/* 2. Which one */}
          {kind && (
            <section>
              {step(2, `Select the ${KINDS.find((k) => k.kind === kind)!.label === "Jobs" ? "Job" : KINDS.find((k) => k.kind === kind)!.label}`, picked.length > 0)}
              {picked.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {picked.map((p) => (
                    <span key={key(p)} className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-2.5 pr-1 text-xs font-medium text-accent">
                      {p.label}
                      <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.label}`} className="rounded-full p-0.5 hover:bg-accent/20"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or number"
                  className="h-11 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-accent sm:h-9" />
              </div>
              <ul className="mt-2 max-h-44 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {targets === null && <li className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</li>}
                {targets !== null && options.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Nothing matches.</li>}
                {options.map((t) => (
                  <li key={key(t)}>
                    <button type="button" onClick={() => toggle(t)}
                      className={cn("flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted", isPicked(t) && "bg-accent/10")}>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{t.sub}</span>
                      </span>
                      {isPicked(t) && <Check className="h-4 w-4 shrink-0 text-accent" />}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 3. Log type */}
          <section>
            {step(3, "How do you want to log it?", !!htmlToText(notes) || attachedCount > 0)}
            <div className="grid grid-cols-4 gap-2">
              {MODES.map(({ mode: m, label, hint, icon: Icon }) => (
                <button key={m} type="button"
                  onClick={() => { setMode(m); if (m === "record") setRecording(true); if (m === "camera") cameraRef.current?.click(); }}
                  className={cn("flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2.5 text-xs font-medium transition",
                    mode === m ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted")}>
                  <Icon className="h-5 w-5" /> {label}
                  <span className="hidden text-[10px] font-normal text-muted-foreground sm:block">{hint}</span>
                </button>
              ))}
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={uploadRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </section>

          {/* 4. What happened today */}
          <section>
            {step(4, "What happened today")}
            {mode === "compose" && (
              <RichTextEditor key={editorKey} value={notes} onChange={setNotes} placeholder="Work completed, deliveries, decisions — anything the team should know" />
            )}
            {mode === "record" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">Talk through the day; it&apos;s transcribed into the log text, and the recording is attached.</p>
                <Button size="sm" variant="accent" className="mt-3" onClick={() => setRecording(true)}><Mic className="h-4 w-4" /> {voices.length ? "Record another" : "Start recording"}</Button>
              </div>
            )}
            {mode === "camera" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center">
                <p className="text-sm text-muted-foreground">Opens your phone&apos;s camera. Take as many as you need.</p>
                <Button size="sm" variant="accent" className="mt-3" onClick={() => cameraRef.current?.click()}><Camera className="h-4 w-4" /> {media.length ? "Take another" : "Take a photo"}</Button>
              </div>
            )}
            {mode === "upload" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                className={cn("rounded-lg border-2 border-dashed p-6 text-center transition", dragOver ? "border-accent bg-accent/5" : "border-border")}>
                <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Drag & drop photos or video here, or</p>
                <Button size="sm" variant="outline" className="mt-2" onClick={() => uploadRef.current?.click()}><Upload className="h-4 w-4" /> Choose from gallery</Button>
              </div>
            )}

            {/* Everything attached so far, whichever way it was added */}
            {(attachedCount > 0 || (mode !== "compose" && htmlToText(notes))) && (
              <div className="mt-3 space-y-2">
                {mode !== "compose" && htmlToText(notes) && (
                  <button type="button" onClick={() => setMode("compose")} className="block w-full rounded-md bg-muted/50 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted">
                    <span className="font-medium text-foreground">Log text:</span> {htmlToText(notes).slice(0, 140)}{htmlToText(notes).length > 140 ? "…" : ""} <span className="text-accent">Edit</span>
                  </button>
                )}
                {voices.map((v) => (
                  <div key={v.key} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
                    <Mic className="h-4 w-4 text-accent" />
                    <span className="flex-1">{v.state === "transcribing" ? "Transcribing…" : v.state === "error" ? "Recording attached (couldn't transcribe)" : "Voice note — transcribed into the log text"}</span>
                    {v.state === "transcribing" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <button type="button" onClick={() => setVoices((x) => x.filter((y) => y.key !== v.key))} aria-label="Remove recording" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
                {media.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {media.map((m) => (
                      <div key={m.key} className="relative overflow-hidden rounded-md border border-border">
                        {m.type === "image"
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.preview} alt="" className="aspect-square w-full object-cover" />
                          : <video src={m.preview} className="aspect-square w-full object-cover" muted />}
                        <button type="button" onClick={() => { URL.revokeObjectURL(m.preview); setMedia((x) => x.filter((y) => y.key !== m.key)); }}
                          aria-label="Remove" className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 5. Visibility */}
          <section>
            {step(5, "Who sees it")}
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ["client", "Client visible", anyJob ? "Shows on the client's portal" : "Jobs only", !anyJob || vis.private],
                ["brief", "My Daily Brief", "Remind me in tomorrow's email", false],
                ["team", "CMI Team", "Every CMI staff member", false],
                ["private", "Private", "Only you", false],
              ] as const).map(([k, label, hint, disabled]) => (
                <label key={k} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5", vis[k] ? "border-accent bg-accent/5" : "border-border", disabled && "cursor-not-allowed opacity-50")}>
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--accent)]" disabled={disabled}
                    checked={vis[k] && !disabled} onChange={(e) => setVisibility(k, e.target.checked)} />
                  <span className="text-sm">
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
          <span className="text-xs text-muted-foreground">{saving ?? (attachedCount ? `${attachedCount} attachment${attachedCount === 1 ? "" : "s"}` : "")}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={!!saving}>Cancel</Button>
            <Button variant="accent" onClick={() => void save()} disabled={!!saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {picked.length > 1 ? `Save to ${picked.length}` : "Save log"}
            </Button>
          </div>
        </div>
      </div>

      <AudioRecorder open={recording} onClose={() => setRecording(false)} onComplete={(blob) => void onRecorded(blob)} />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
