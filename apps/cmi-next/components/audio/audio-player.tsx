"use client";

import * as React from "react";
import { Download, Pause, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const SPEEDS = [1, 1.25, 1.5, 2];

// Branded audio player: play/pause, scrub, volume, playback speed, download.
export function AudioPlayer({ src, filename, className }: { src: string; filename?: string; className?: string }) {
  const ref = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [current, setCurrent] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(1);
  const [rate, setRate] = React.useState(1);

  function toggle() {
    const a = ref.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current; if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }
  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length];
    setRate(next); if (ref.current) ref.current.playbackRate = next;
  }

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div className={cn("rounded-xl border border-border bg-muted/30 p-3", className)}>
      <audio
        ref={ref}
        src={src}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground transition hover:bg-accent/90 active:scale-95">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
        </button>

        <div className="min-w-0 flex-1">
          <div onClick={seek} className="group relative h-2 cursor-pointer rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
            <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0 shadow transition-opacity group-hover:opacity-100" style={{ left: `${pct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        <button onClick={cycleSpeed} className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground" title="Playback speed">
          {rate}x
        </button>

        <div className="hidden items-center gap-1.5 sm:flex">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); if (ref.current) ref.current.volume = v; }}
            className="h-1 w-16 cursor-pointer accent-[var(--audio-accent,currentColor)] text-accent"
            aria-label="Volume"
          />
        </div>

        {src && (
          <a href={src} download={filename || "recording"} className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground" title="Download">
            <Download className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
