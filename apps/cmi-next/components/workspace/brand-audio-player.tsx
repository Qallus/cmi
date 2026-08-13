"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, SkipBack, Volume2, VolumeX, FileText } from "lucide-react";
import { useDashboardActionToken } from "@/components/workspace/ui/action-token";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

const GOLD = "var(--accent)";

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full text-background/80 transition-colors hover:bg-background/10 hover:text-background">{children}</button>
  );
}

/** Branded, theme-aware audio player. The control pill inverts with the theme (dark on
 * light, light on dark) and uses the MJG gold accent throughout.
 * - onTranscript: when provided, shows a "Transcribe to text" button.
 * - width / onWidthChange: when provided, the player is resizable via a right-edge handle. */
export function BrandAudioPlayer({ src, onTranscript, width, onWidthChange }: { src?: string | null; onTranscript?: (text: string) => void; width?: number; onWidthChange?: (w: number) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const actionToken = useDashboardActionToken();
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [rate, setRate] = useState(1);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(width ?? null);

  useEffect(() => setLiveWidth(width ?? null), [width]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => setCur(a.currentTime);
    const onMeta = () => setDur(a.duration || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => { a.removeEventListener("timeupdate", onTime); a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("ended", onEnd); };
  }, [src]);

  function toggle() { const a = audio.current; if (!a) return; if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); } }
  function skip(delta: number) { const a = audio.current; if (a) a.currentTime = Math.max(0, Math.min((a.duration || 0), a.currentTime + delta)); }
  function restart() { const a = audio.current; if (a) { a.currentTime = 0; setCur(0); } }
  function seek(v: number) { const a = audio.current; if (a) { a.currentTime = v; setCur(v); } }
  function setVolume(v: number) { const a = audio.current; if (a) { a.volume = v; setVol(v); } }
  function cycleRate() { const next = rate >= 2 ? 1 : rate === 1 ? 1.5 : 2; setRate(next); if (audio.current) audio.current.playbackRate = next; }

  async function transcribe() {
    if (!src || !onTranscript) return;
    setTranscribing(true); setError(null);
    try {
      const res = await fetch("/api/workspace/transcribe", { method: "POST", headers: { "Content-Type": "application/json", "x-mjg-action-token": actionToken }, body: JSON.stringify({ url: src }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Transcription failed."); return; }
      if (data.text) onTranscript(data.text);
    } catch { setError("Transcription failed. Please try again."); } finally { setTranscribing(false); }
  }

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = wrap.current?.offsetWidth ?? 480;
    const onMove = (ev: MouseEvent) => setLiveWidth(Math.max(300, Math.min(960, startW + (ev.clientX - startX))));
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      onWidthChange?.(Math.max(300, Math.min(960, startW + (ev.clientX - startX))));
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <div ref={wrap} className="not-prose relative select-none rounded-2xl border bg-card p-3" style={{ width: liveWidth ? `${liveWidth}px` : undefined, maxWidth: "100%" }}>
      <audio ref={audio} src={src ?? undefined} preload="metadata" />

      {/* progress */}
      <div className="mb-3 flex items-center gap-3 px-1">
        <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(cur)}</span>
        <input type="range" min={0} max={dur || 0} step={0.1} value={cur} onChange={(e) => seek(Number(e.target.value))} className="h-1.5 w-full cursor-pointer" style={{ accentColor: GOLD }} />
        <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{fmt(dur)}</span>
      </div>

      {/* controls: pill centered; transcribe + volume on the right */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <div className="hidden flex-1 sm:block" />
        <div className="flex items-center gap-2 rounded-full bg-foreground px-3 py-1.5">
          <IconBtn onClick={restart} label="Restart"><SkipBack className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => skip(-10)} label="Back 10 seconds"><span className="relative flex items-center"><RotateCcw className="h-5 w-5" /><span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">10</span></span></IconBtn>
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground shadow transition-transform hover:scale-105">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
          </button>
          <IconBtn onClick={() => skip(10)} label="Forward 10 seconds"><span className="relative flex items-center"><RotateCw className="h-5 w-5" /><span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">10</span></span></IconBtn>
          <button type="button" onClick={cycleRate} aria-label="Playback speed" className="flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-xs font-semibold text-background/80 transition-colors hover:bg-background/10 hover:text-background">{rate}x</button>
        </div>
        <div className="flex flex-1 items-center justify-end gap-3">
          {onTranscript ? (
            <button type="button" onClick={transcribe} disabled={transcribing || !src} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-50">
              <FileText className="h-3.5 w-3.5" /> {transcribing ? "Transcribing…" : "Transcribe to text"}
            </button>
          ) : null}
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setVolume(vol > 0 ? 0 : 1)} aria-label="Mute" className="text-muted-foreground hover:text-foreground">{vol > 0 ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
            <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => setVolume(Number(e.target.value))} className={cn("h-1 w-20 cursor-pointer")} style={{ accentColor: GOLD }} />
          </div>
        </div>
      </div>

      {error ? <p className="mt-2 px-1 text-xs text-destructive">{error}</p> : null}

      {/* resize handle (only when width is controlled) */}
      {onWidthChange ? (
        <span onMouseDown={startResize} title="Drag to resize" className="absolute right-0 top-1/2 flex h-8 w-3 -translate-y-1/2 cursor-ew-resize items-center justify-center text-muted-foreground/50 hover:text-muted-foreground">
          <span className="h-6 w-0.5 rounded bg-current" />
        </span>
      ) : null}
    </div>
  );
}
