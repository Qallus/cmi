// Order-by dates (Phase 2 Step 8): a task with a lead time (working days to
// get the material) must be ordered that many working days before the work
// that needs it starts: its earliest successor's start, or its own start when
// nothing follows it. Monday–Friday working days. Pure.

const at = (s: string) => Date.parse(`${s}T12:00:00Z`);
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** `n` weekdays before `date`. */
export function weekdaysBefore(date: string, n: number): string {
  const d = new Date(at(date));
  for (let left = Math.max(0, Math.round(n)); left > 0; ) {
    d.setUTCDate(d.getUTCDate() - 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) left--;
  }
  return iso(d.getTime());
}

export function orderByDate(item: { start_date: string | null; lead_time_days?: number | null }, successorStarts: (string | null | undefined)[]): string | null {
  const lead = item.lead_time_days ?? 0;
  if (!lead || lead < 0) return null;
  const needed = successorStarts.filter((s): s is string => !!s).sort()[0] ?? item.start_date;
  return needed ? weekdaysBefore(needed, lead) : null;
}
