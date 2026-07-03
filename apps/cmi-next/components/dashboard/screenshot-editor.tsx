"use client";

import * as React from "react";
import {
  ArrowUpRight, Bold, Check, Crop, HelpCircle, Highlighter, Maximize2, Minimize2,
  Move, PaintBucket, Pen, RotateCcw, Square, Type, Undo2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tool = "crop" | "pen" | "arrow" | "rect" | "highlight" | "text";
type Pt = { x: number; y: number };
type FreeShape = { tool: "pen" | "highlight"; color: string; size: number; points: Pt[] };
type LineShape = { tool: "arrow" | "rect"; color: string; size: number; a: Pt; b: Pt };
type TextShape = { tool: "text"; color: string; size: number; x: number; y: number; text: string; bold: boolean; bg: boolean };
type Shape = FreeShape | LineShape | TextShape;
type DragShape = FreeShape | LineShape;
function isFree(s: DragShape): s is FreeShape { return s.tool === "pen" || s.tool === "highlight"; }

type TextDraft = { x: number; y: number; left: number; top: number; dispFont: number; fontPx: number; color: string; bold: boolean; bg: boolean };

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#111111", "#ffffff"];
const MAX_DIM = 1600; // clamp captured image for performance / upload size
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
// A background that contrasts the text color (dark box behind light text, light behind dark).
function bgFor(color: string): string { return luminance(color) > 0.6 ? "rgba(17,17,17,.62)" : "rgba(255,255,255,.88)"; }

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function textBounds(ctx: CanvasRenderingContext2D, s: TextShape) {
  ctx.font = `${s.bold ? 800 : 600} ${s.size}px ${FONT}`;
  const lines = s.text.split("\n"); const lh = s.size * 1.2;
  let maxW = 0; for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
  const pad = s.bg ? s.size * 0.3 : s.size * 0.15;
  return { x: s.x - pad, y: s.y - pad, w: maxW + pad * 2, h: lines.length * lh + pad * 2 };
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  switch (s.tool) {
    case "pen":
    case "highlight": {
      ctx.strokeStyle = s.tool === "highlight" ? hexA(s.color, 0.35) : s.color;
      ctx.lineWidth = s.tool === "highlight" ? s.size * 4 : s.size;
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
      ctx.strokeRect(s.a.x, s.a.y, s.b.x - s.a.x, s.b.y - s.a.y);
      break;
    }
    case "arrow": {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
      ctx.beginPath(); ctx.moveTo(s.a.x, s.a.y); ctx.lineTo(s.b.x, s.b.y); ctx.stroke();
      const ang = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x);
      const head = 10 + s.size * 2.5;
      ctx.beginPath();
      ctx.moveTo(s.b.x, s.b.y);
      ctx.lineTo(s.b.x - head * Math.cos(ang - Math.PI / 7), s.b.y - head * Math.sin(ang - Math.PI / 7));
      ctx.moveTo(s.b.x, s.b.y);
      ctx.lineTo(s.b.x - head * Math.cos(ang + Math.PI / 7), s.b.y - head * Math.sin(ang + Math.PI / 7));
      ctx.stroke();
      break;
    }
    case "text": {
      ctx.font = `${s.bold ? 800 : 600} ${s.size}px ${FONT}`;
      ctx.textBaseline = "top";
      const lines = s.text.split("\n"); const lh = s.size * 1.2;
      if (s.bg) {
        let maxW = 0; for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
        const pad = s.size * 0.3;
        ctx.fillStyle = bgFor(s.color);
        roundRect(ctx, s.x - pad, s.y - pad, maxW + pad * 2, lines.length * lh + pad * 2, s.size * 0.25);
        ctx.fill();
      }
      ctx.fillStyle = s.color;
      lines.forEach((ln, i) => ctx.fillText(ln, s.x, s.y + i * lh));
      break;
    }
  }
}

export function ScreenshotEditor({ src, onSave, onCancel }: { src: string; onSave: (dataUrl: string) => void; onCancel: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [tool, setTool] = React.useState<Tool>("pen");
  const [color, setColor] = React.useState(COLORS[0]);
  const [shapes, setShapes] = React.useState<Shape[]>([]);
  const shapesRef = React.useRef<Shape[]>([]); // mirror for race-free compositing
  const [crop, setCrop] = React.useState<{ a: Pt; b: Pt } | null>(null);
  const draft = React.useRef<DragShape | null>(null);
  const dragging = React.useRef(false);
  const moving = React.useRef<{ index: number; offX: number; offY: number } | null>(null);
  const [showHelp, setShowHelp] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  // Text tool
  const [textDraft, setTextDraft] = React.useState<TextDraft | null>(null);
  const textDraftRef = React.useRef<TextDraft | null>(null);
  const textInputRef = React.useRef<HTMLTextAreaElement>(null);
  const [textKey, setTextKey] = React.useState(0);
  const [textScale, setTextScale] = React.useState(1);
  const [textBold, setTextBold] = React.useState(false);
  const [textBg, setTextBg] = React.useState(false);

  function updateShapes(next: Shape[] | ((p: Shape[]) => Shape[])) {
    setShapes((prev) => {
      const v = typeof next === "function" ? (next as (p: Shape[]) => Shape[])(prev) : next;
      shapesRef.current = v;
      return v;
    });
  }

  React.useEffect(() => {
    const image = new Image();
    image.onload = () => {
      if (Math.max(image.width, image.height) <= MAX_DIM) { setImg(image); return; }
      const scale = MAX_DIM / Math.max(image.width, image.height);
      const c = document.createElement("canvas");
      c.width = Math.round(image.width * scale); c.height = Math.round(image.height * scale);
      c.getContext("2d")?.drawImage(image, 0, 0, c.width, c.height);
      const scaled = new Image();
      scaled.onload = () => setImg(scaled);
      scaled.src = c.toDataURL("image/jpeg", 0.9);
    };
    image.src = src;
  }, [src]);

  function pendingTextShape(): TextShape | null {
    const d = textDraftRef.current;
    const v = textInputRef.current?.value.trim();
    if (d && v) return { tool: "text", color: d.color, size: d.fontPx, x: d.x, y: d.y, text: v, bold: d.bold, bg: d.bg };
    return null;
  }

  function compositeCanvas(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = img?.width ?? 1; c.height = img?.height ?? 1;
    const ctx = c.getContext("2d")!;
    if (img) ctx.drawImage(img, 0, 0);
    const all = [...shapesRef.current];
    const p = pendingTextShape(); if (p) all.push(p);
    for (const s of all) drawShape(ctx, s);
    return c;
  }

  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || !img) return;
    if (canvas.width !== img.width) { canvas.width = img.width; canvas.height = img.height; }
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const all: Shape[] = draft.current ? [...shapes, draft.current] : shapes;
    for (const s of all) drawShape(ctx, s);
    if (crop) {
      const x = Math.min(crop.a.x, crop.b.x), y = Math.min(crop.a.y, crop.b.y);
      const w = Math.abs(crop.b.x - crop.a.x), h = Math.abs(crop.b.y - crop.a.y);
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);
      ctx.strokeStyle = "#C87A3A"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
  }, [img, shapes, crop]);

  React.useEffect(() => { redraw(); }, [redraw]);

  // Focus the text box AFTER the placing click settles, so the browser's default
  // mousedown focus handling doesn't blur it out from under us.
  React.useEffect(() => {
    if (!textDraft) return;
    const id = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [textKey, textDraft]);

  function pos(e: React.PointerEvent): Pt {
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  }

  function hitTextAt(p: Pt): number {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return -1;
    for (let i = shapesRef.current.length - 1; i >= 0; i--) {
      const s = shapesRef.current[i];
      if (s.tool !== "text") continue;
      const b = textBounds(ctx, s);
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return i;
    }
    return -1;
  }

  function commitText() {
    const s = pendingTextShape();
    textDraftRef.current = null;
    setTextDraft(null);
    if (s) updateShapes((prev) => [...prev, s]);
  }

  function placeText(e: React.PointerEvent) {
    commitText();
    const canvas = canvasRef.current!;
    const r = canvas.getBoundingClientRect();
    const p = pos(e);
    const fontPx = Math.max(12, Math.round((canvas.width / 40) * textScale));
    const d: TextDraft = { x: p.x, y: p.y, left: e.clientX, top: e.clientY, fontPx, dispFont: fontPx * (r.width / canvas.width), color, bold: textBold, bg: textBg };
    textDraftRef.current = d;
    setTextDraft(d);
    setTextKey((k) => k + 1);
  }

  function down(e: React.PointerEvent) {
    if (!img) return;
    if (tool === "text") {
      const p = pos(e);
      const hit = hitTextAt(p);
      if (hit >= 0) { // drag an existing label
        commitText();
        const s = shapesRef.current[hit] as TextShape;
        moving.current = { index: hit, offX: p.x - s.x, offY: p.y - s.y };
        dragging.current = true;
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }
      placeText(e); return;
    }
    dragging.current = true;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (tool === "crop") { setCrop({ a: p, b: p }); return; }
    draft.current = (tool === "pen" || tool === "highlight")
      ? { tool, color, size: 3, points: [p] }
      : { tool, color, size: 3, a: p, b: p };
  }
  function move(e: React.PointerEvent) {
    if (moving.current) {
      const p = pos(e); const { index, offX, offY } = moving.current;
      updateShapes((prev) => prev.map((s, i) => (i === index && s.tool === "text" ? { ...s, x: p.x - offX, y: p.y - offY } : s)));
      return;
    }
    if (!dragging.current) return;
    const p = pos(e);
    if (tool === "crop") { setCrop((c) => (c ? { a: c.a, b: p } : null)); return; }
    const d = draft.current; if (!d) return;
    if (isFree(d)) d.points.push(p); else d.b = p;
    redraw();
  }
  function up() {
    if (moving.current) { moving.current = null; dragging.current = false; return; }
    dragging.current = false;
    if (draft.current) {
      const d = draft.current;
      const ok = isFree(d) ? d.points.length > 1 : Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y) > 3;
      if (ok) updateShapes((prev) => [...prev, d]);
      draft.current = null;
      redraw();
    }
  }

  function applyCrop() {
    if (!crop || !img) return;
    const x = Math.round(Math.min(crop.a.x, crop.b.x)), y = Math.round(Math.min(crop.a.y, crop.b.y));
    const w = Math.round(Math.abs(crop.b.x - crop.a.x)), h = Math.round(Math.abs(crop.b.y - crop.a.y));
    if (w < 8 || h < 8) { setCrop(null); return; }
    const comp = compositeCanvas();
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d")!.drawImage(comp, x, y, w, h, 0, 0, w, h);
    const next = new Image();
    next.onload = () => { textDraftRef.current = null; setTextDraft(null); updateShapes([]); setImg(next); setCrop(null); setTool("pen"); };
    next.src = c.toDataURL("image/jpeg", 0.92);
  }

  // Toggles that also update the label currently being typed.
  function toggleBold() {
    const nv = !textBold; setTextBold(nv);
    if (textDraftRef.current) { textDraftRef.current.bold = nv; setTextDraft((d) => (d ? { ...d, bold: nv } : d)); }
  }
  function toggleBg() {
    const nv = !textBg; setTextBg(nv);
    if (textDraftRef.current) { textDraftRef.current.bg = nv; setTextDraft((d) => (d ? { ...d, bg: nv } : d)); }
  }

  const cropSize = crop ? { w: Math.round(Math.abs(crop.b.x - crop.a.x)), h: Math.round(Math.abs(crop.b.y - crop.a.y)) } : null;

  const TOOLS: { key: Tool; icon: React.ReactNode; label: string }[] = [
    { key: "crop", icon: <Crop className="h-4 w-4" />, label: "Crop" },
    { key: "pen", icon: <Pen className="h-4 w-4" />, label: "Pen" },
    { key: "arrow", icon: <ArrowUpRight className="h-4 w-4" />, label: "Arrow" },
    { key: "rect", icon: <Square className="h-4 w-4" />, label: "Box" },
    { key: "highlight", icon: <Highlighter className="h-4 w-4" />, label: "Highlight" },
    { key: "text", icon: <Type className="h-4 w-4" />, label: "Text" },
  ];

  return (
    <div data-fab-ignore className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" onClick={() => { commitText(); onCancel(); }} />
      <div className={cn("relative z-10 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl", expanded ? "h-[96vh] w-[98vw] max-w-none" : "max-h-[94vh] w-full max-w-5xl")}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {TOOLS.map((t) => (
              <button key={t.key} type="button" title={t.label} onClick={() => { if (t.key !== "text") commitText(); setTool(t.key); }}
                className={cn("inline-flex h-8 items-center gap-1 rounded px-2 text-xs font-medium", tool === t.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>
                {t.icon}<span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} title={c}
                className={cn("h-6 w-6 rounded-full border", color === c ? "ring-2 ring-accent ring-offset-1 ring-offset-card" : "border-border")}
                style={{ background: c }} />
            ))}
          </div>
          {tool === "text" && (
            <div className="flex items-center gap-1">
              <div className="inline-flex items-center rounded-md border border-border p-0.5" title="Text size">
                {([["S", 0.7], ["M", 1], ["L", 1.7]] as const).map(([lbl, mul]) => (
                  <button key={lbl} type="button" onClick={() => setTextScale(mul)}
                    className={cn("h-7 w-7 rounded text-xs font-semibold", textScale === mul ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}>{lbl}</button>
                ))}
              </div>
              <button type="button" title="Bold" onClick={toggleBold}
                className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border border-border", textBold ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><Bold className="h-3.5 w-3.5" /></button>
              <button type="button" title="Background behind text" onClick={toggleBg}
                className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border border-border", textBg ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}><PaintBucket className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {tool === "crop" && crop && <Button size="sm" variant="outline" onClick={applyCrop}><Crop className="h-3.5 w-3.5" /> Apply {cropSize ? `${cropSize.w}×${cropSize.h}` : ""}</Button>}
            <Button size="sm" variant="outline" onClick={() => updateShapes((p) => p.slice(0, -1))} disabled={!shapes.length}><Undo2 className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={() => { textDraftRef.current = null; setTextDraft(null); updateShapes([]); setCrop(null); }}><RotateCcw className="h-3.5 w-3.5" /></Button>
            <button type="button" title={expanded ? "Shrink editor" : "Expand editor"} onClick={() => setExpanded((v) => !v)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-accent">{expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
            <button type="button" title="How the tools work" onClick={() => setShowHelp(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-accent"><HelpCircle className="h-4 w-4" /></button>
            <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={() => { commitText(); onCancel(); }}><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-3">
          {!img ? (
            <div className="py-20 text-center text-sm text-muted-foreground">Loading capture…</div>
          ) : (
            <canvas
              ref={canvasRef}
              onPointerDown={down} onPointerMove={move} onPointerUp={up}
              className={cn("mx-auto block max-w-full rounded border border-border bg-white", tool === "text" ? "cursor-text" : "cursor-crosshair")}
              style={{ touchAction: "none" }}
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
          <div className="text-[11px] text-muted-foreground">
            {tool === "crop" ? "Drag to select an area, then Apply." : tool === "text" ? "Click and type · Enter places · Shift+Enter new line · drag a placed label to move it." : "Drag on the image to annotate."}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => { commitText(); onCancel(); }}>Cancel</Button>
            <Button size="sm" variant="accent" onClick={() => onSave(compositeCanvas().toDataURL("image/jpeg", 0.9))} disabled={!img}><Check className="h-3.5 w-3.5" /> Use screenshot</Button>
          </div>
        </div>
      </div>

      {/* Floating text box — Enter places, Shift+Enter adds a line */}
      {textDraft && (
        <textarea
          key={textKey}
          ref={textInputRef}
          rows={1}
          defaultValue=""
          placeholder="Type…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
            else if (e.key === "Escape") { textDraftRef.current = null; setTextDraft(null); }
          }}
          onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }}
          onBlur={() => { if (pendingTextShape()) commitText(); }}
          className="z-[85]"
          style={{
            position: "fixed", left: textDraft.left, top: textDraft.top,
            color: textDraft.color, font: `${textDraft.bold ? 800 : 600} ${textDraft.dispFont}px ${FONT}`, lineHeight: 1.2,
            background: textDraft.bg ? bgFor(textDraft.color) : "rgba(255,255,255,.9)",
            border: `1px dashed ${textDraft.color}`, outline: "none", padding: "0 4px", borderRadius: 4, minWidth: 80,
            resize: "none", overflow: "hidden",
          }}
        />
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  const items: { icon: React.ReactNode; title: string; body: string }[] = [
    { icon: <Crop className="h-4 w-4" />, title: "Crop", body: "Drag a box over the area you want, then Apply. Trims the screenshot to that region (shows live W×H)." },
    { icon: <Pen className="h-4 w-4" />, title: "Pen", body: "Freehand draw. Drag to sketch on the image." },
    { icon: <ArrowUpRight className="h-4 w-4" />, title: "Arrow", body: "Drag from start to end to point at something." },
    { icon: <Square className="h-4 w-4" />, title: "Box", body: "Drag to draw a rectangle outline around an area." },
    { icon: <Highlighter className="h-4 w-4" />, title: "Highlight", body: "Drag a translucent marker stroke to emphasize an area." },
    { icon: <Type className="h-4 w-4" />, title: "Text", body: "Click anywhere and type. Enter places it, Shift+Enter adds a line. Use S/M/L for size, Bold for weight, and the fill button for a readable background. Drag a placed label to move it." },
    { icon: <PaintBucket className="h-4 w-4" />, title: "Colors", body: "Pick the color used for the next annotation or text label." },
    { icon: <Move className="h-4 w-4" />, title: "Move text", body: "With the Text tool active, drag any label you've placed to reposition it." },
    { icon: <Undo2 className="h-4 w-4" />, title: "Undo / Reset", body: "Undo removes the last annotation; Reset clears them all (and any crop selection)." },
    { icon: <Check className="h-4 w-4" />, title: "Use screenshot", body: "Bakes the crop and every annotation into the image and attaches it to your request." },
  ];
  return (
    <div className="fixed inset-0 z-[88] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-accent" /><h2 className="text-base font-semibold">Screenshot tools</h2></div>
          <button type="button" className="rounded p-1 text-muted-foreground hover:text-foreground" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <p className="text-sm text-muted-foreground">Mark up your screenshot before attaching it. Pick a tool and a color, then work on the image. Everything is baked into the saved picture.</p>
          {items.map((it) => (
            <div key={it.title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">{it.icon}</span>
              <div><div className="text-sm font-semibold">{it.title}</div><div className="text-[13px] text-muted-foreground">{it.body}</div></div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-5 py-3 text-right">
          <Button size="sm" variant="accent" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}
