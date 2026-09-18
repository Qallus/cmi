// Pure Projections math: month helpers, even spread, allocation, status
// mapping and rollups. No imports with runtime effect, so it runs under
// `node --test` (see calc.test.mjs) as well as in the app.
import type { ProjectionStatus, AllocationState } from "./types";

// ── Months ───────────────────────────────────────────────────────────────
// A month is always its first day as "YYYY-MM-01" (matches the DB `month` date).

export function monthOf(value: string | Date): string {
  if (typeof value === "string") return `${value.slice(0, 7)}-01`;
  // Local calendar month (not UTC), so late-evening "today" stays in this month.
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-01`;
}

export function monthRange(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(start, i));
}

// Inclusive list of months from `start` to `end` (empty when end < start).
export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let m = monthOf(start); m <= monthOf(end); m = addMonths(m, 1)) out.push(m);
  return out;
}

// ── Spreading ─────────────────────────────────────────────────────────────

// Split `amount` into whole dollars across `months`; the rounding remainder
// lands on the last month. Nothing to spread (≤ 0 or no months) → {}.
export function evenSpread(amount: number, months: string[]): Record<string, number> {
  const total = Math.round(amount);
  if (total <= 0 || months.length === 0) return {};
  const base = Math.floor(total / months.length);
  const out: Record<string, number> = {};
  months.forEach((m, i) => { out[m] = i === months.length - 1 ? total - base * (months.length - 1) : base; });
  return out;
}

// Months a new forecast is spread over: from max(start, current month) to the
// finish. A finish already in the past collapses to the current month so the
// remaining revenue still lands somewhere visible. Missing dates → [].
export function spreadMonths(start: string | null, finish: string | null, currentMonth: string): string[] {
  if (!start || !finish) return [];
  const from = monthOf(start) > currentMonth ? monthOf(start) : currentMonth;
  const to = monthOf(finish) >= from ? monthOf(finish) : from;
  return monthsBetween(from, to);
}

// ── Allocation ────────────────────────────────────────────────────────────

// Remaining revenue vs what's forecast from the current month on. Within $1
// counts as balanced (whole-dollar spreads vs cents in contracts).
export function allocation(remaining: number, futureProjected: number): { unallocated: number; state: AllocationState } {
  const unallocated = round2(remaining - futureProjected);
  const state: AllocationState = Math.abs(unallocated) <= 1 ? "balanced" : unallocated > 0 ? "under" : "over";
  return { unallocated, state };
}

// ── Status ────────────────────────────────────────────────────────────────

// Default projection status from a job's status (used when no override).
export function statusFromJob(jobStatus: string | null | undefined): ProjectionStatus {
  switch (jobStatus) {
    case "active_project":
    case "warranty":
    case "closed":
      return "contracted";
    case "pre_construction_design":
      return "preconstruction";
    case "active_budget":
      return "proposal";
    case "on_hold":
    case "long_lead":
    case "not_moving_forward":
    case "cancelled":
      return "on_hold";
    default:
      return "likely";
  }
}

export function isCommitted(status: ProjectionStatus): boolean {
  return status === "contracted";
}

// ── Rollups ───────────────────────────────────────────────────────────────

export type RollupRow = {
  include: boolean;
  status: ProjectionStatus;
  remaining: number;
  months: Record<string, { projected: number; actual: number }>;
};

export type MonthTotal = { month: string; projected: number; actual: number; variance: number | null; projects: number; committed: number; potential: number };

// Per-month totals over included rows. Variance only for months that have
// started (≤ current month) — a future month has no actuals yet.
export function monthTotals(rows: RollupRow[], window: string[], currentMonth: string): MonthTotal[] {
  return window.map((month) => {
    let projected = 0, actual = 0, projects = 0, committed = 0, potential = 0;
    for (const r of rows) {
      if (!r.include) continue;
      const cell = r.months[month];
      if (!cell) continue;
      projected += cell.projected;
      actual += cell.actual;
      if (cell.projected > 0) projects += 1;
      if (isCommitted(r.status)) committed += cell.projected; else potential += cell.projected;
    }
    return {
      month, projected: round2(projected), actual: round2(actual),
      variance: month <= currentMonth ? round2(actual - projected) : null,
      projects, committed: round2(committed), potential: round2(potential),
    };
  });
}

// Forecast after the window, summed by calendar year.
export function beyondByYear(months: Record<string, number>, windowEnd: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [month, amount] of Object.entries(months)) {
    if (month <= windowEnd || !amount) continue;
    const year = month.slice(0, 4);
    out[year] = round2((out[year] ?? 0) + amount);
  }
  return out;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
