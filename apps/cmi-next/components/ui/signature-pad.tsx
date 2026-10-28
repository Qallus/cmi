"use client";

// A drawn signature (mouse, pen or finger). Reports a PNG data URL after each
// stroke, or null when cleared. Used by the MSA step of the trade partner
// application; generic enough for any "sign here" box.
import * as React from "react";
import { Eraser } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignaturePad({ onChange, className, disabled }: { onChange: (png: string | null) => void; className?: string; disabled?: boolean }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const last = React.useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = React.useState(true);
  const inked = React.useRef(false);

  // Size the backing store to the element at device pixel ratio, so strokes are crisp.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!inked.current) { inked.current = true; setEmpty(false); }
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (inked.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    inked.current = false;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        aria-label="Signature pad: draw your signature"
        className={cn("h-36 w-full touch-none rounded-lg border border-border bg-white", disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair")}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
      />
      {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">Sign here</span>}
      <div className="pointer-events-none absolute bottom-7 left-6 right-6 border-b border-dashed border-border" />
      <button type="button" onClick={clear} disabled={disabled}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-muted-foreground shadow-sm hover:text-foreground">
        <Eraser className="h-3.5 w-3.5" /> Clear
      </button>
    </div>
  );
}
