// The banner after an edit ripples (Grid Addendum §2.4): "3 tasks moved ·
// finish now Mar 11, 2027 (2 days later)". Pure, so it's tested.

type Dated = { start_date?: string | null; end_date?: string | null };

/** The schedule's finish: the latest end (or start, for a milestone). */
export function finishOf(items: Dated[]): string | null {
  let out: string | null = null;
  for (const i of items) { const e = i.end_date ?? i.start_date; if (e && (!out || e > out)) out = e; }
  return out;
}

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

export function movedBanner(moved: number, before: string | null, after: string | null, fmt: (iso: string) => string): string {
  const head = `${moved} task${moved === 1 ? "" : "s"} moved`;
  if (!after) return `${head}.`;
  if (!before || before === after) return `${head} · finish still ${fmt(after)}.`;
  const d = days(before, after);
  return `${head} · finish now ${fmt(after)} (${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} ${d > 0 ? "later" : "earlier"}).`;
}
