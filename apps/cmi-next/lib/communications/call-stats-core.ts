// Call counts for the dashboard: this month vs last, by direction, missed,
// and a 30-day series. Pure (tested); lib/communications/call-stats.ts feeds
// it the calls from Twilio. Days are Arizona days.

export type CallRow = { direction: string | null; status: string | null; dateCreated: string | Date | null };
export type Count = { now: number; last: number };
export type DayPoint = { day: string; a: number; b: number };
export type CallSummary = {
  total: Count; inbound: Count; outbound: Count; missed: Count;
  /** a = inbound, b = outbound, per day for the last 30 days. */
  series: DayPoint[];
  outcomes: { name: string; value: number }[];
};

const TZ = "America/Phoenix";
const ymd = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const ym = (d: Date) => ymd(d).slice(0, 7);

/** "2026-01" → "2025-12". */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Inbound calls nobody picked up. */
export const MISSED_STATUSES = new Set(["no-answer", "busy", "failed", "canceled"]);

export function isOutbound(direction: string | null): boolean {
  return (direction ?? "").startsWith("outbound");
}

export function summarizeCalls(calls: CallRow[], now = new Date()): CallSummary {
  const thisMonth = ym(now);
  const lastMonth = previousMonth(thisMonth);
  const c = () => ({ now: 0, last: 0 });
  const total = c(), inbound = c(), outbound = c(), missed = c();
  const days = new Map<string, DayPoint>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    days.set(ymd(d), { day: ymd(d), a: 0, b: 0 });
  }
  const outcomes = new Map<string, number>();

  for (const call of calls) {
    if (!call.dateCreated) continue;
    const at = new Date(call.dateCreated);
    if (Number.isNaN(at.getTime())) continue;
    const month = ym(at);
    const bucket = month === thisMonth ? "now" : month === lastMonth ? "last" : null;
    const out = isOutbound(call.direction);
    const status = (call.status ?? "").toLowerCase();
    if (bucket) {
      total[bucket]++;
      (out ? outbound : inbound)[bucket]++;
      if (!out && MISSED_STATUSES.has(status)) missed[bucket]++;
    }
    if (bucket === "now") {
      const label = status === "completed" ? "Answered" : MISSED_STATUSES.has(status) ? (out ? "No answer" : "Missed") : status ? "Other" : "Other";
      outcomes.set(label, (outcomes.get(label) ?? 0) + 1);
    }
    const p = days.get(ymd(at));
    if (p) { if (out) p.b++; else p.a++; }
  }
  return {
    total, inbound, outbound, missed,
    series: [...days.values()],
    outcomes: [...outcomes.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}
