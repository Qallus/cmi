// Client-side scene flattening: composite the media + annotations into a single
// JPEG snapshot for the submitted brief (stored as flattened_path). Runs in the
// browser at submit — avoids a server-side canvas dependency. Pins/stamps are
// drawn as simple markers so the snapshot reads on its own.
import { drawAnnotations } from "./render";
import { COLOR_MEANING, type SceneAnnotations } from "./types";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load scene image."));
    img.src = url;
  });
}

export async function flattenScene(mediaUrl: string, ann: SceneAnnotations): Promise<Blob> {
  const img = await loadImage(mediaUrl);
  const w = img.naturalWidth || 1280;
  const h = img.naturalHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");

  ctx.drawImage(img, 0, 0, w, h);
  drawAnnotations(ctx, ann, { width: w, height: h });

  // Stamps → labeled dashed boxes
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  for (const s of ann.stamps) {
    ctx.save();
    ctx.translate(s.x * w, s.y * h);
    ctx.rotate((s.rotation * Math.PI) / 180);
    ctx.scale(s.scale, s.scale);
    ctx.font = "600 16px sans-serif";
    const tw = ctx.measureText(s.label).width + 24;
    ctx.fillStyle = "rgba(176,132,39,0.28)";
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    roundRect(ctx, -tw / 2, -16, tw, 32, 8);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    ctx.fillText(s.label, 0, 1);
    ctx.restore();
  }

  // Pins → numbered / mic markers
  for (const p of ann.pins) {
    const x = p.x * w, y = p.y * h;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = p.kind === "voice" ? "#2e7d5b" : "#b08427";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 13px sans-serif";
    ctx.fillText(p.kind === "voice" ? "♪" : String(p.number ?? "•"), x, y + 1);
  }

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not flatten this scene.");
  return blob;
}

export { COLOR_MEANING };

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
