"use client";

import * as React from "react";
import { ImagePlus, Loader2, Mic, RotateCcw, RotateCw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { drawAnnotations, drawNode } from "@/lib/canvas/render";
import type { CanvasColor, Point } from "@/lib/canvas/types";
import { StampTray } from "./stamp-tray";
import { VoiceRecorder } from "./voice-recorder";
import type { CanvasStore } from "./use-canvas-store";

const SNAP_PX = 14;
const uid = () => { try { return crypto.randomUUID(); } catch { return `id-${Date.now()}-${Math.round(Math.random() * 1e6)}`; } };
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function containRect(cw: number, ch: number, nw: number, nh: number) {
  if (!nw || !nh || !cw || !ch) return { left: 0, top: 0, width: cw, height: ch };
  const scale = Math.min(cw / nw, ch / nh);
  const width = nw * scale, height = nh * scale;
  return { left: (cw - width) / 2, top: (ch - height) / 2, width, height };
}

export function CanvasStage({ store }: { store: CanvasStore }) {
  const { activeScene, mediaUrls, ensureMediaUrl, tool, color, readOnly } = store;
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = React.useState({ left: 0, top: 0, width: 0, height: 0 });

  // In-progress interaction state
  const [draftStroke, setDraftStroke] = React.useState<{ color: CanvasColor; points: Point[] } | null>(null);
  const [shapePts, setShapePts] = React.useState<Point[]>([]);
  const [hoverPt, setHoverPt] = React.useState<Point | null>(null);
  const [selected, setSelected] = React.useState<{ kind: "pin" | "stamp"; id: string } | null>(null);
  const [cardPin, setCardPin] = React.useState<string | null>(null);
  const [voiceTarget, setVoiceTarget] = React.useState<string | null>(null);
  const [transcribing, setTranscribing] = React.useState<Set<string>>(new Set());
  const dragRef = React.useRef<{ kind: "pin" | "stamp"; id: string; moved: boolean } | null>(null);

  const mediaPath = activeScene?.media_path ?? null;
  const mediaUrl = mediaPath ? mediaUrls[mediaPath] : null;
  const ann = activeScene?.annotations;
  const mutate = store.mutateActiveAnnotations;

  React.useEffect(() => { ensureMediaUrl(mediaPath); setNatural(null); }, [mediaPath, ensureMediaUrl]);

  // Switching tools or scenes discards any unfinished shape/stroke and selection.
  React.useEffect(() => {
    setShapePts([]); setHoverPt(null); setDraftStroke(null); setSelected(null); setCardPin(null);
  }, [tool, activeScene?.id]);

  // Escape cancels an unfinished shape/stroke and closes any open card/selection.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setShapePts([]); setHoverPt(null); setDraftStroke(null); setSelected(null); setCardPin(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const distPx = React.useCallback((a: Point, b: Point) => Math.hypot((a.x - b.x) * box.width, (a.y - b.y) * box.height), [box]);
  const nearFirst = React.useCallback((p: Point) => shapePts.length > 2 && distPx(p, shapePts[0]) < SNAP_PX, [shapePts, distPx]);

  // Redraw vector layers + live previews.
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
    const sx = (x: number) => x * box.width, sy = (y: number) => y * box.height;
    drawAnnotations(ctx, activeScene.annotations, { width: box.width, height: box.height });

    if (shapePts.length) {
      ctx.beginPath();
      shapePts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
      if (hoverPt) ctx.lineTo(sx(hoverPt.x), sy(hoverPt.y));
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); ctx.stroke(); ctx.setLineDash([]);
      shapePts.forEach((p, i) => drawNode(ctx, sx(p.x), sy(p.y), color, i === 0 && !!hoverPt && nearFirst(hoverPt)));
    }
    if (draftStroke && draftStroke.points.length) {
      ctx.strokeStyle = draftStroke.color; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath();
      draftStroke.points.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
      ctx.stroke();
    }
  }, [activeScene, box, shapePts, hoverPt, draftStroke, color, nearFirst]);

  function posFromEvent(e: React.PointerEvent): Point {
    const wrap = wrapRef.current;
    if (!wrap) return { x: 0, y: 0 };
    const r = wrap.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left - box.left) / (box.width || 1)), y: clamp01((e.clientY - r.top - box.top) / (box.height || 1)) };
  }

  // ── Drawing surface pointer handlers (active when tool ≠ select) ──
  function onDown(e: React.PointerEvent) {
    if (readOnly) return;
    const p = posFromEvent(e);
    if (tool === "draw") {
      setDraftStroke({ color, points: [p] });
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    } else if (tool === "shape") {
      if (nearFirst(p)) { commitShape([...shapePts]); setShapePts([]); setHoverPt(null); }
      else setShapePts((prev) => [...prev, p]);
    } else if (tool === "pin") {
      placeNote(p);
    } else if (tool === "voice") {
      placeVoice(p);
    }
  }
  function onMove(e: React.PointerEvent) {
    if (tool === "draw" && draftStroke) {
      const p = posFromEvent(e);
      setDraftStroke((d) => (d ? { ...d, points: [...d.points, p] } : d));
    } else if (tool === "shape" && shapePts.length) {
      setHoverPt(posFromEvent(e));
    }
  }
  function onUp() {
    if (tool === "draw" && draftStroke) {
      if (draftStroke.points.length > 1) {
        const stroke = { id: uid(), color: draftStroke.color, points: draftStroke.points };
        mutate((a) => ({ ...a, strokes: [...a.strokes, stroke] }));
      }
      setDraftStroke(null);
    }
  }
  function commitShape(pts: Point[]) {
    if (pts.length < 3) return;
    const shape = { id: uid(), color, points: pts, closed: true };
    mutate((a) => ({ ...a, shapes: [...a.shapes, shape] }));
  }

  function placeNote(p: Point) {
    const id = uid();
    const nextNum = Math.max(0, ...(ann?.pins.filter((x) => x.kind === "note").map((x) => x.number ?? 0) ?? [0])) + 1;
    mutate((a) => ({ ...a, pins: [...a.pins, { id, kind: "note", x: p.x, y: p.y, number: nextNum, text: "" }] }));
    setSelected({ kind: "pin", id });
    setCardPin(id);
  }
  function placeVoice(p: Point) {
    const id = uid();
    mutate((a) => ({ ...a, pins: [...a.pins, { id, kind: "voice", x: p.x, y: p.y }] }));
    setVoiceTarget(id);
  }

  function addStamp(kind: string, label: string) {
    const id = uid();
    mutate((a) => ({ ...a, stamps: [...a.stamps, { id, kind, label, x: 0.5, y: 0.5, rotation: 0, scale: 1 }] }));
    setSelected({ kind: "stamp", id });
  }

  // ── Selection-mode drag (pins + stamps) ──
  function startDrag(e: React.PointerEvent, kind: "pin" | "stamp", id: string) {
    if (tool !== "select") return;
    e.stopPropagation(); // keep the empty-area deselect from firing
    if (readOnly) { if (kind === "pin") setCardPin(id); return; } // view-only tap
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, id, moved: false };
    setSelected({ kind, id });
  }
  function dragMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    d.moved = true;
    const p = posFromEvent(e);
    if (d.kind === "pin") mutate((a) => ({ ...a, pins: a.pins.map((pn) => (pn.id === d.id ? { ...pn, x: p.x, y: p.y } : pn)) }));
    else mutate((a) => ({ ...a, stamps: a.stamps.map((st) => (st.id === d.id ? { ...st, x: p.x, y: p.y } : st)) }));
  }
  function dragEnd() {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved && d.kind === "pin") {
      const pin = ann?.pins.find((p) => p.id === d.id);
      if (pin?.kind === "note") setCardPin(d.id);
    }
  }

  function updatePinText(id: string, text: string) { mutate((a) => ({ ...a, pins: a.pins.map((p) => (p.id === id ? { ...p, text } : p)) })); }
  function removePin(id: string) { mutate((a) => ({ ...a, pins: a.pins.filter((p) => p.id !== id) })); setCardPin(null); setSelected(null); }
  function updateStamp(id: string, patch: Partial<{ rotation: number; scale: number }>) { mutate((a) => ({ ...a, stamps: a.stamps.map((s) => (s.id === id ? { ...s, ...patch } : s)) })); }
  function removeStamp(id: string) { mutate((a) => ({ ...a, stamps: a.stamps.filter((s) => s.id !== id) })); setSelected(null); }

  async function onVoiceDone(blob: Blob) {
    const id = voiceTarget;
    setVoiceTarget(null);
    if (!id) return;
    setTranscribing((prev) => new Set(prev).add(id));
    const transcript = await store.uploadVoiceNote(id, blob);
    if (transcript) updatePinText(id, transcript);
    setTranscribing((prev) => { const n = new Set(prev); n.delete(id); return n; });
  }
  function onVoiceCancel() {
    if (voiceTarget) removePin(voiceTarget);
    setVoiceTarget(null);
  }

  if (!activeScene) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#20261f] text-center text-white/80">
        <ImagePlus className="h-8 w-8 opacity-70" />
        <p className="max-w-xs text-sm">Add a scene from the strip below — snap a photo, record a video, or upload an image of your space.</p>
      </div>
    );
  }

  const pins = ann?.pins ?? [];
  const stamps = ann?.stamps ?? [];
  const interactive = !readOnly && tool !== "select";
  const cardPinObj = pins.find((p) => p.id === cardPin) ?? null;
  const selectedStamp = selected?.kind === "stamp" ? stamps.find((s) => s.id === selected.id) ?? null : null;

  return (
    <div ref={wrapRef} className="relative flex-1 overflow-hidden bg-[#20261f]" style={{ minHeight: 0 }}
      onPointerDown={() => { if (tool === "select") { setSelected(null); setCardPin(null); } }}>
      {mediaPath && !mediaUrl && <div className="absolute inset-0 flex items-center justify-center text-white/70"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {mediaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl} alt={store.canvas?.title ?? "Scene"} className="absolute inset-0 h-full w-full object-contain" onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      )}
      {!mediaPath && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">This scene has no media yet.</div>}

      {/* Vector + interaction layer */}
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{ left: box.left, top: box.top, touchAction: "none", cursor: interactive ? "crosshair" : "default", pointerEvents: interactive ? "auto" : "none" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      />

      {/* DOM overlay: stamps + pins */}
      <div className="absolute" style={{ left: box.left, top: box.top, width: box.width, height: box.height, pointerEvents: "none" }}>
        {stamps.map((s) => (
          <div
            key={s.id}
            onPointerDown={(e) => startDrag(e, "stamp", s.id)}
            onPointerMove={dragMove}
            onPointerUp={dragEnd}
            className={`absolute flex items-center gap-1.5 rounded-lg border border-dashed border-white/85 bg-[rgba(176,132,39,0.22)] px-3 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm ${selected?.id === s.id ? "outline outline-2 outline-accent" : ""}`}
            style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, transform: `translate(-50%,-50%) rotate(${s.rotation}deg) scale(${s.scale})`, pointerEvents: tool === "select" ? "auto" : "none", cursor: readOnly ? "default" : "grab", touchAction: "none" }}
          >
            {s.label}
          </div>
        ))}

        {pins.map((p) => (
          <div
            key={p.id}
            onPointerDown={(e) => startDrag(e, "pin", p.id)}
            onPointerMove={dragMove}
            onPointerUp={dragEnd}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, pointerEvents: tool === "select" ? "auto" : "none", cursor: readOnly ? "pointer" : "grab", touchAction: "none" }}
          >
            <div className={`grid h-6 w-6 place-items-center rounded-[50%_50%_50%_4px] shadow ${p.kind === "voice" ? "bg-[#2e7d5b]" : "bg-[#b08427]"} ${selected?.id === p.id ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ transform: "rotate(-45deg)" }}>
              <span className="text-[11px] font-bold text-white" style={{ transform: "rotate(45deg)" }}>
                {transcribing.has(p.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : p.kind === "voice" ? <Mic className="h-3 w-3" /> : (p.number ?? "•")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Note-pin card */}
      {cardPinObj && (
        <div className="absolute z-20 w-60 -translate-x-1/2 rounded-lg border border-border bg-card p-3 shadow-xl"
          onPointerDown={(e) => e.stopPropagation()}
          style={{ left: `${box.left + cardPinObj.x * box.width}px`, top: `${box.top + cardPinObj.y * box.height + 12}px` }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#c87f3a]">{cardPinObj.kind === "voice" ? "Voice note" : `Pin ${cardPinObj.number ?? ""}`}</span>
            {!readOnly && <button type="button" onClick={() => removePin(cardPinObj.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
          <textarea
            autoFocus={!readOnly}
            value={cardPinObj.text ?? ""}
            disabled={readOnly}
            placeholder={cardPinObj.kind === "voice" ? "Transcription will appear here…" : "Type your note…"}
            onChange={(e) => updatePinText(cardPinObj.id, e.target.value)}
            className="h-20 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
          />
          <div className="mt-1 text-right"><button type="button" onClick={() => setCardPin(null)} className="text-[11px] font-semibold text-accent">Done</button></div>
        </div>
      )}

      {/* Selected-stamp controls */}
      {selectedStamp && !readOnly && tool === "select" && (
        <div className="absolute z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card px-1.5 py-1 shadow-xl"
          onPointerDown={(e) => e.stopPropagation()}
          style={{ left: `${box.left + selectedStamp.x * box.width}px`, top: `${box.top + selectedStamp.y * box.height - 46}px` }}>
          <Ctrl onClick={() => updateStamp(selectedStamp.id, { rotation: selectedStamp.rotation - 15 })}><RotateCcw className="h-3.5 w-3.5" /></Ctrl>
          <Ctrl onClick={() => updateStamp(selectedStamp.id, { rotation: selectedStamp.rotation + 15 })}><RotateCw className="h-3.5 w-3.5" /></Ctrl>
          <Ctrl onClick={() => updateStamp(selectedStamp.id, { scale: Math.max(0.4, selectedStamp.scale - 0.15) })}><ZoomOut className="h-3.5 w-3.5" /></Ctrl>
          <Ctrl onClick={() => updateStamp(selectedStamp.id, { scale: Math.min(3, selectedStamp.scale + 0.15) })}><ZoomIn className="h-3.5 w-3.5" /></Ctrl>
          <Ctrl onClick={() => removeStamp(selectedStamp.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Ctrl>
        </div>
      )}

      {/* Stamp tray */}
      {tool === "stamp" && !readOnly && <StampTray onAdd={addStamp} />}

      {/* Voice recorder */}
      {voiceTarget && <VoiceRecorder onDone={onVoiceDone} onCancel={onVoiceCancel} />}
    </div>
  );
}

function Ctrl({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground">{children}</button>;
}
