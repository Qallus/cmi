// Turn free text (typed, dictated or a .txt file) into punch item drafts.
// Deterministic so it works without Bolt: one item per line or bullet, and a
// dictated paragraph splits on sentences. "Kitchen: fix cabinet door" or
// "Kitchen - fix cabinet door" puts the room in `location`.
// Client-safe.
import type { PunchItemDraft } from "./types";

const ROOMS = /^(kitchen|primary bath(room)?|master bath(room)?|bath(room)?|powder( room)?|laundry|garage|living( room)?|family room|dining( room)?|bedroom( \d+)?|primary bedroom|master bedroom|office|hall(way)?|entry|foyer|patio|exterior|yard|backyard|front yard|pool|roof|attic|basement|stairs?|closet|mudroom|casita|adu)\b/i;

function clean(s: string): string {
  return s
    .replace(/^\s*(?:[-*•▪◦]|\d+[.)]|\[\s?[xX ]?\s?\])\s*/, "") // bullets, numbers, [ ] boxes
    .replace(/\s+/g, " ")
    .replace(/[.;,]+$/, "")
    .trim();
}

function toDraft(raw: string): PunchItemDraft | null {
  let text = clean(raw);
  if (!text) return null;
  let location: string | null = null;
  const m = text.match(/^([^:–—-]{2,30})\s*[:–—-]\s+(.+)$/);
  if (m && ROOMS.test(m[1].trim())) { location = m[1].trim(); text = m[2].trim(); }
  if (text.length < 2) return null;
  return { title: text.charAt(0).toUpperCase() + text.slice(1), location };
}

export function parsePunchText(text: string): PunchItemDraft[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // A single dictated paragraph: split into sentences / "next," / "also" clauses.
  const pieces = lines.length <= 1
    ? (lines[0] ?? "").split(/(?<=[.!?])\s+|;\s+|\s+(?:next|also|and then)[,:]?\s+/i)
    : lines;
  return pieces.map(toDraft).filter((d): d is PunchItemDraft => !!d).slice(0, 200);
}
