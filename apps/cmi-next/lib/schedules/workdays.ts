// Workday-aware date math for cascading dependent items. Dates are ISO
// "YYYY-MM-DD" strings handled in UTC to avoid timezone drift.
import type { Workdays } from "./types";

const DOW: (keyof Workdays)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function parseISO(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}
export function fmtISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function isWorkday(d: Date, workdays: Workdays, holidays: Set<string> = new Set()): boolean {
  if (holidays.has(fmtISO(d))) return false;
  return workdays[DOW[d.getUTCDay()]] !== false;
}

/** Add N working days to a date (N may be 0). Skips non-workdays/holidays. */
export function addWorkdays(start: Date, days: number, workdays: Workdays, holidays?: Set<string>): Date {
  const d = new Date(start);
  let remaining = Math.max(0, Math.round(days));
  // Ensure the start itself lands on a workday.
  while (!isWorkday(d, workdays, holidays)) d.setUTCDate(d.getUTCDate() + 1);
  while (remaining > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkday(d, workdays, holidays)) remaining -= 1;
  }
  return d;
}

/** Inclusive count of working days between two dates. */
export function workdaysBetween(start: Date, end: Date, workdays: Workdays, holidays?: Set<string>): number {
  if (end < start) return 0;
  let n = 0;
  const d = new Date(start);
  while (d <= end) {
    if (isWorkday(d, workdays, holidays)) n += 1;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

/** Calendar-day duration (inclusive) between two ISO dates, min 1. */
export function durationDays(startISO: string | null, endISO: string | null): number | null {
  const s = parseISO(startISO), e = parseISO(endISO);
  if (!s || !e) return null;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
}
