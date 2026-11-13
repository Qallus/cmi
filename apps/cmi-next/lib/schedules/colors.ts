// Schedule colours: each phase gets its own colour by default (a phase's own
// colour, set in its menu, still wins; so does a bar colour set on a task).
// Past-due work turns red, and the next task coming up is marked so it pulses.
// Pure, so the Gantt, the grid and the tests agree.

/** Phase colours in order: Pre-Construction, Design & Permitting, Site Work… Earthy, distinct, white text reads on all. */
export const PHASE_PALETTE = [
  "#9e6f2e", // bronze (CMI accent)
  "#4f6d8a", // slate blue
  "#5f7f4f", // sage
  "#b3593a", // terracotta
  "#6d5a8c", // plum
  "#2f7a74", // teal
  "#a8842a", // ochre
  "#8a4f5f", // mulberry
  "#4a6b5e", // pine
  "#7a6a55", // taupe
] as const;

export const PAST_DUE_COLOR = "#c2410c";

export type ColorPhase = { id: string; color?: string | null };

/** phase id → colour: its own colour, else the palette by position. */
export function phaseColors(phases: ColorPhase[] | undefined): Map<string, string> {
  const m = new Map<string, string>();
  (phases ?? []).forEach((p, i) => m.set(p.id, p.color || PHASE_PALETTE[i % PHASE_PALETTE.length]));
  return m;
}

type ColorItem = {
  id: string; kind?: string | null; status?: string | null; percent_complete?: number | null;
  start_date?: string | null; end_date?: string | null; phase_id?: string | null; sort_order?: number;
};

const DONE = new Set(["complete", "cancelled"]);
const done = (i: ColorItem) => DONE.has(i.status ?? "") || (i.percent_complete ?? 0) >= 100;

/** Should have finished before today and isn't done. */
export function isPastDue(i: ColorItem, today: string): boolean {
  const end = i.end_date ?? i.start_date;
  return !!end && end < today && !done(i);
}

/** The next task or milestone coming up: the earliest start from today on that isn't done (schedule order breaks a tie). */
export function nextUpId(items: ColorItem[], today: string): string | null {
  let best: ColorItem | null = null;
  for (const i of items) {
    if (!i.start_date || i.start_date < today || done(i)) continue;
    if (!best || i.start_date < best.start_date! || (i.start_date === best.start_date && (i.sort_order ?? 0) < (best.sort_order ?? 0))) best = i;
  }
  return best?.id ?? null;
}

/** A bar's fill: the task's own colour, else (overlaying schedules) the schedule's, else its phase's; past due overrides. */
export function barFill(i: ColorItem & { bar_color?: string | null }, opts: { today: string; phases: Map<string, string>; scheduleColor?: string | null; fallback?: string }): { color: string; pastDue: boolean } {
  const pastDue = isPastDue(i, opts.today);
  if (pastDue) return { color: PAST_DUE_COLOR, pastDue };
  const color = i.bar_color || opts.scheduleColor || (i.phase_id ? opts.phases.get(i.phase_id) : undefined) || opts.fallback || PHASE_PALETTE[0];
  return { color, pastDue };
}
