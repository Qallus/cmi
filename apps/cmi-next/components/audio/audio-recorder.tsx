"use client";

import * as React from "react";
import { Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Branded voice recorder modal with a live waveform visualizer.
export function AudioRecorder({
  open, onClose, onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (blob: Blob) => void;
}) {
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState("");

  const streamRef = React.useRef<MediaStream | null>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const ctxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = React.useRef(0);

  const cleanup = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null; recorderRef.current = null; analyserRef.current = null; ctxRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!open) { cleanup(); setRecording(false); setElapsed(0); setError(""); }
    return () => cleanup();
  }, [open, cleanup]);

  function draw() {
    const canvas = canvasRef.current, analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const cctx = canvas.getContext("2d");
    if (!cctx) return;
    const probe = document.createElement("span");
    probe.className = "text-accent"; probe.style.display = "none";
    document.body.appendChild(probe);
    const color = getComputedStyle(probe).color || "#c8a35b";
    probe.remove();

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      analyser.getByteFrequencyData(buf);
      const w = canvas.width, h = canvas.height;
      cctx.clearRect(0, 0, w, h);
      const bars = 40;
      const step = Math.floor(buf.length / bars);
      const bw = w / bars;
      cctx.fillStyle = color;
      for (let i = 0; i < bars; i++) {
        const v = buf[i * step] / 255;
        const bh = Math.max(3, v * h);
        const x = i * bw + bw * 0.2;
        cctx.beginPath();
        const radius = bw * 0.3;
        const y = (h - bh) / 2;
        cctx.roundRect(x, y, bw * 0.6, bh, radius);
        cctx.fill();
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        cleanup();
        onComplete(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      startRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 200);
      draw();
    } catch {
      setError("Microphone access was blocked. Allow mic permission to record.");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { cleanup(); onClose(); }} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <button onClick={() => { cleanup(); onClose(); }} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        <h3 className="text-left font-display text-lg font-semibold">Voice Recorder</h3>
        <p className="mb-4 text-left text-sm text-muted-foreground">Record a voice memo for this meeting.</p>

        <div className="my-3 text-5xl font-bold tabular-nums tracking-tight">{fmt(elapsed)}</div>

        <div className="mx-auto my-4 h-16 w-full max-w-[260px]">
          {recording ? (
            <canvas ref={canvasRef} width={260} height={64} className="h-16 w-full" />
          ) : (
            <div className="flex h-16 items-center justify-center gap-1">
              {Array.from({ length: 22 }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted" />)}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          {recording ? (
            <button onClick={stop} className="grid h-16 w-16 place-items-center rounded-full bg-red-500/20 ring-4 ring-red-500/30 transition active:scale-95" aria-label="Stop">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-red-500 text-white"><Square className="h-5 w-5 fill-current" /></span>
            </button>
          ) : (
            <button onClick={start} className="grid h-16 w-16 place-items-center rounded-full bg-accent/15 ring-4 ring-accent/20 transition hover:bg-accent/25 active:scale-95" aria-label="Record">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><Mic className="h-5 w-5" /></span>
            </button>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end">
          <button onClick={() => { cleanup(); onClose(); }} className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-muted">Cancel</button>
        </div>
      </div>
    </div>
  );
}
