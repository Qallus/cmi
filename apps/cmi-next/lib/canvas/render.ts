// Pure Canvas-2D rendering of the vector annotation layers (strokes + shapes).
// Coordinates are fractional (0–1); callers pass the pixel rect to scale into.
// Pins and stamps are DOM overlays, not drawn here. Shared by the live stage and
// (Phase 5) the flatten-to-image step.
import type { SceneAnnotations } from "./types";

export type Rect = { width: number; height: number };

export function drawAnnotations(ctx: CanvasRenderingContext2D, ann: SceneAnnotations, rect: Rect): void {
  const sx = (x: number) => x * rect.width;
  const sy = (y: number) => y * rect.height;

  for (const s of ann.strokes) {
    if (s.points.length === 0) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    s.points.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    ctx.stroke();
  }

  for (const sh of ann.shapes) {
    if (sh.points.length === 0) continue;
    ctx.beginPath();
    sh.points.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
    if (sh.closed) ctx.closePath();
    ctx.fillStyle = sh.color + "33"; // 20% alpha fill
    if (sh.closed) ctx.fill();
    ctx.strokeStyle = sh.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.stroke();
    for (const p of sh.points) drawNode(ctx, sx(p.x), sy(p.y), sh.color, false);
  }
}

export function drawNode(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, hot: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, hot ? 8 : 5.5, 0, Math.PI * 2);
  ctx.fillStyle = hot ? color : "#fff";
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = color;
  ctx.stroke();
}
