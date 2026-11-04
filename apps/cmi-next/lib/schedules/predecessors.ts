// P6-style shorthand for the grid's Predecessors / Successors / Duration
// cells (Spec R2 §4.1): "120, 120FS+2, 150SS, 180FF-1" and "7" / "7cd".
import type { DependencyType } from "./types";

export type LinkRef = { id: number; type: DependencyType; lag: number };

const TYPE_BY_ABBR: Record<string, DependencyType> = {
  FS: "finish_to_start", SS: "start_to_start", FF: "finish_to_finish", SF: "start_to_finish",
};
const ABBR_BY_TYPE: Record<DependencyType, string> = {
  finish_to_start: "FS", start_to_start: "SS", finish_to_finish: "FF", start_to_finish: "SF",
};

/** Parse a predecessor cell. Returns the links and any tokens it couldn't read. */
export function parseLinks(text: string): { links: LinkRef[]; errors: string[] } {
  const links: LinkRef[] = [];
  const errors: string[] = [];
  for (const raw of text.split(/[,;]/)) {
    const tok = raw.trim().replace(/\s+/g, "");
    if (!tok) continue;
    const m = /^(\d+)(FS|SS|FF|SF)?(?:([+-])(\d+)d?)?$/i.exec(tok);
    if (!m) { errors.push(`"${raw.trim()}" isn't a predecessor. Use an activity ID like 120, 120FS+2, 150SS or 180FF-1.`); continue; }
    const lag = m[4] ? Number(m[4]) * (m[3] === "-" ? -1 : 1) : 0;
    links.push({ id: Number(m[1]), type: TYPE_BY_ABBR[(m[2] ?? "FS").toUpperCase()], lag });
  }
  return { links, errors };
}

/** "120", "120FS+2", "150SS", "180FF-1". Plain FS with no lag prints as the bare ID. */
export function formatLink(l: LinkRef): string {
  const abbr = ABBR_BY_TYPE[l.type];
  const lag = l.lag ? `${l.lag > 0 ? "+" : ""}${l.lag}` : "";
  return l.type === "finish_to_start" && !lag ? String(l.id) : `${l.id}${abbr}${lag}`;
}
export function formatLinks(links: LinkRef[]): string {
  return [...links].sort((a, b) => a.id - b.id).map(formatLink).join(", ");
}

/** Check parsed links against the schedule: unknown IDs and self-links. */
export function validateLinks(selfId: number, links: LinkRef[], knownIds: Set<number>): string[] {
  const errs: string[] = [];
  for (const l of links) {
    if (l.id === selfId) errs.push(`A task can't depend on itself (${l.id}).`);
    else if (!knownIds.has(l.id)) errs.push(`No activity ${l.id} in this schedule.`);
  }
  return errs;
}

/** Successor shorthand for each activity, from everyone's predecessors. */
export function successorsOf(preds: Map<number, LinkRef[]>): Map<number, LinkRef[]> {
  const out = new Map<number, LinkRef[]>();
  for (const [succ, links] of preds) {
    for (const l of links) {
      const list = out.get(l.id) ?? [];
      list.push({ id: succ, type: l.type, lag: l.lag });
      out.set(l.id, list);
    }
  }
  return out;
}

export type DurationInput = { days: number; unit: "workdays" | "calendar" };

/** "7" → 7 working days, "7cd" → 7 calendar days, "0" → milestone. "7d"/"7wd" are working days. */
export function parseDuration(text: string): DurationInput | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(cd|wd|d)?\s*$/i.exec(text);
  if (!m) return null;
  return { days: Math.round(Number(m[1])), unit: m[2]?.toLowerCase() === "cd" ? "calendar" : "workdays" };
}
export function formatDuration(days: number, unit: "workdays" | "calendar"): string {
  return unit === "calendar" ? `${days}cd` : String(days);
}

/** Next free activity ID between two neighbours (25 between 20 and 30, then
 *  22 or 27). Null when there's no gap left: offer Renumber by Tens. */
export function idBetween(before: number | null, after: number | null): number | null {
  const lo = before ?? 0;
  if (after == null) return (Math.floor(lo / 10) + 1) * 10;
  if (after - lo < 2) return null;
  return lo + Math.floor((after - lo) / 2);
}
