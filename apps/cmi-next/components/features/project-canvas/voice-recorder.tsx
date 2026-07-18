"use client";

import * as React from "react";
import { Check, Loader2, Mic, X } from "lucide-react";

// Records a short voice note via MediaRecorder and hands back the blob. Falls
// back gracefully where MediaRecorder / getUserMedia isn't available (iOS < 14.3
// and some in-app browsers) by surfacing an error and letting the caller cancel.
export function VoiceRecorder({ onDone, onCancel }: { onDone: (blob: Blob) => void; onCancel: () => void }) {
  const [seconds, setSeconds] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Voice recording isn't supported on this device/browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
        const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
        rec.start();
        recorderRef.current = rec;
        timer = setInterval(() => setSeconds((s) => s + 1), 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start recording.");
      }
    })();
    return () => {
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function finish() {
    const rec = recorderRef.current;
    if (!rec) { onCancel(); return; }
    setSaving(true);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      stopTracks();
      onDone(blob);
    };
    rec.stop();
  }

  function cancel() {
    try { recorderRef.current?.stop(); } catch { /* noop */ }
    stopTracks();
    onCancel();
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={cancel} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card p-5 text-center shadow-2xl">
        {error ? (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={cancel} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-semibold">Close</button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#2e7d5b]/15 text-[#2e7d5b]">
              <Mic className="h-6 w-6 motion-safe:animate-pulse" />
            </div>
            <div className="mt-3 font-mono text-lg">{mm}:{ss}</div>
            <p className="mt-1 text-xs text-muted-foreground">Recording your voice note…</p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button type="button" onClick={cancel} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">
                <X className="h-4 w-4" /> Cancel
              </button>
              <button type="button" onClick={finish} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-[#2e7d5b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Stop &amp; save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
