"use client";

import * as React from "react";
import { ImagePlus, Loader2, Mic } from "lucide-react";
import { drawAnnotations } from "@/lib/canvas/render";
import type { CanvasStore } from "./use-canvas-store";

// Rect (in container px) of an object-contain image, so the annotation canvas
// and DOM pins/stamps overlay exactly the media — the space fractional coords
// (0–1) map into.
function containRect(cw: number, ch: number, nw: number, nh: number) {
  if (!nw || !nh || !cw || !ch) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale;
  const height = nh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

export function CanvasStage({ store }: { store: CanvasStore }) {
  const { activeScene, mediaUrls, ensureMediaUrl } = store;
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = React.useState({ left: 0, top: 0, width: 0, height: 0 });

  const mediaPath = activeScene?.media_path ?? null;
  const mediaUrl = mediaPath ? mediaUrls[mediaPath] : null;

  React.useEffect(() => { ensureMediaUrl(mediaPath); setNatural(null); }, [mediaPath, ensureMediaUrl]);

  // Track container size → recompute the contain box.
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const recompute = () => {
      const r = el.getBoundingClientRect();
      setBox(containRect(r.width, r.height, natural?.w ?? r.width, natural?.h ?? r.height));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [natural]);

  // Redraw the vector layer whenever annotations or the box change.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeScene) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, box.width * dpr);
    canvas.height = Math.max(1, box.height * dpr);
    canvas.style.width = `${box.width}px`;
    canvas.style.height = `${box.height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.width, box.height);
    drawAnnotations(ctx, activeScene.annotations, { width: box.width, height: box.height });
  }, [activeScene, box]);

  if (!activeScene) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#20261f] text-center text-white/80">
        <ImagePlus className="h-8 w-8 opacity-70" />
        <p className="max-w-xs text-sm">Add a scene from the strip below — snap a photo, record a video, or upload an image of your space.</p>
      </div>
    );
  }

  const pins = activeScene.annotations.pins;
  const stamps = activeScene.annotations.stamps;

  return (
    <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-[#20261f]" style={{ minHeight: 0 }}>
      {mediaPath && !mediaUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl}
          alt={store.canvas?.title ?? "Scene"}
          className="absolute inset-0 h-full w-full object-contain"
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        />
      )}
      {!mediaPath && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">This scene has no media yet.</div>
      )}

      {/* Vector layer (strokes + shapes), aligned to the media box */}
      <canvas ref={canvasRef} className="pointer-events-none absolute" style={{ left: box.left, top: box.top }} />

      {/* DOM overlay: pins + stamps */}
      <div className="pointer-events-none absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height }}>
        {stamps.map((s) => (
          <div key={s.id} className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border border-dashed border-white/85 bg-[rgba(176,132,39,0.22)] px-3 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm"
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, transform: `translate(-50%,-50%) rotate(${s.rotation}deg) scale(${s.scale})` }}>
            {s.label}
          </div>
        ))}
        {pins.map((p) => (
          <div key={p.id} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
            <div className={`grid h-6 w-6 place-items-center rounded-[50%_50%_50%_4px] ${p.kind === "voice" ? "bg-[#2e7d5b]" : "bg-[#b08427]"}`} style={{ transform: "rotate(-45deg)" }}>
              <span className="text-[11px] font-bold text-white" style={{ transform: "rotate(45deg)" }}>
                {p.kind === "voice" ? <Mic className="h-3 w-3" /> : (p.number ?? "•")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
