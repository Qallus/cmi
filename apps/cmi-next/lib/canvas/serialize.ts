// Serialize a canvas into a compact, human-readable context block that Bolt
// receives with every message. Built server-side from the DB so it's
// authoritative (never trusts client-sent state).
import { COLOR_MEANING, type CanvasProject, type CanvasScene } from "./types";

export type CanvasContext = {
  summary: string;
  counts: { scenes: number; pins: number; voiceNotes: number; strokes: number; shapes: number; stamps: number };
};

export function buildCanvasContext(canvas: CanvasProject, scenes: CanvasScene[]): CanvasContext {
  const counts = { scenes: scenes.length, pins: 0, voiceNotes: 0, strokes: 0, shapes: 0, stamps: 0 };
  const lines: string[] = [`Canvas: "${canvas.title}" (status: ${canvas.status}). ${scenes.length} scene(s).`];

  scenes.forEach((s, i) => {
    const a = s.annotations;
    counts.strokes += a.strokes.length;
    counts.shapes += a.shapes.length;
    counts.stamps += a.stamps.length;
    counts.pins += a.pins.length;
    counts.voiceNotes += a.pins.filter((p) => p.kind === "voice").length;

    const parts: string[] = [];
    if (a.strokes.length) {
      const byMeaning = a.strokes.reduce<Record<string, number>>((m, st) => {
        const key = COLOR_MEANING[st.color] ?? "general";
        m[key] = (m[key] ?? 0) + 1;
        return m;
      }, {});
      parts.push("drawings: " + Object.entries(byMeaning).map(([k, n]) => `${n} ${k}`).join(", "));
    }
    if (a.shapes.length) {
      const shapeMeanings = a.shapes.map((sh) => COLOR_MEANING[sh.color] ?? "general");
      parts.push(`${a.shapes.length} outlined area(s) (${shapeMeanings.join(", ")})`);
    }
    if (a.stamps.length) parts.push("elements: " + a.stamps.map((st) => st.label).join(", "));
    for (const p of a.pins) {
      const label = p.kind === "voice" ? "voice note" : `note ${p.number ?? ""}`.trim();
      const text = (p.text ?? "").trim();
      parts.push(text ? `${label}: "${text}"` : `${label}: (empty)`);
    }
    lines.push(`Scene ${i + 1}${s.media_path ? "" : " (no media yet)"}: ${parts.length ? parts.join("; ") : "no annotations yet"}.`);
  });

  return { summary: lines.join("\n"), counts };
}
