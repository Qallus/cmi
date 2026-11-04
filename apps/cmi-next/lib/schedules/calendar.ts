// Work calendars for the schedule engine: company → job (or schedule) → task.
// Each level inherits from the one above and overrides only what it sets.
// Pure functions, no I/O, so the browser (instant recalc, what-if) and the
// server (save) run the same math. Dates are day numbers (days since
// 1970-01-01 UTC) inside the engine and ISO "YYYY-MM-DD" at the edges.
import type { Workdays } from "./types";

export type ExceptionType = "holiday" | "weather" | "jurisdiction" | "owner" | "other";
export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  holiday: "Holiday", weather: "Weather", jurisdiction: "Jurisdiction", owner: "Owner", other: "Other",
};

/** One dated exception. working=false closes a normal day (holiday, rain day);
 *  working=true opens a normally closed one (a worked Saturday) or cancels a
 *  holiday from a level above. */
export type CalendarException = { date: string; working: boolean; type: ExceptionType; label?: string | null };

/** A calendar level as stored. Fields left out inherit from the level above. */
export type CalendarLevel = { workdays?: Workdays | null; exceptions?: CalendarException[] | null };
export type WorkCalendar = { workdays: Workdays; exceptions: CalendarException[] };

/** What the engine needs: is this day a working day? */
export type DayCalendar = { isWorking(day: number): boolean };

const DOW: (keyof Workdays)[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MS_DAY = 86_400_000;
// Longest run of closed days we'll walk before calling a calendar broken.
const MAX_CLOSED_RUN = 3_700;

export function dayNum(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
}
export function isoOf(day: number): string {
  return new Date(day * MS_DAY).toISOString().slice(0, 10);
}
export function dayOfWeek(day: number): number {
  return (((day + 4) % 7) + 7) % 7; // 1970-01-01 was a Thursday
}

/** Merge levels top-down (company first). The lowest level that sets
 *  workdays wins; exceptions merge by date, lower levels overriding. */
export function mergeCalendars(...levels: (CalendarLevel | null | undefined)[]): WorkCalendar {
  let workdays: Workdays = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
  const byDate = new Map<string, CalendarException>();
  for (const level of levels) {
    if (!level) continue;
    if (level.workdays) workdays = { ...workdays, ...level.workdays };
    for (const e of level.exceptions ?? []) byDate.set(e.date.slice(0, 10), { ...e, date: e.date.slice(0, 10) });
  }
  return { workdays, exceptions: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export function makeCalendar(cal: WorkCalendar): DayCalendar {
  if (!DOW.some((k) => cal.workdays[k]) && !cal.exceptions.some((e) => e.working)) {
    throw new Error("This calendar has no working days.");
  }
  const override = new Map<number, boolean>();
  for (const e of cal.exceptions) override.set(dayNum(e.date), e.working);
  return {
    isWorking(day) {
      const o = override.get(day);
      return o ?? cal.workdays[DOW[dayOfWeek(day)]] === true;
    },
  };
}

/** Every day counts: concrete cure, permit review, lead times. */
export const CALENDAR_DAYS: DayCalendar = { isWorking: () => true };

/** First working day on or after `day`. */
export function nextW(cal: DayCalendar, day: number): number {
  let d = day;
  for (let i = 0; !cal.isWorking(d); i++, d++) if (i > MAX_CLOSED_RUN) throw new Error("This calendar has no working days.");
  return d;
}
/** Last working day on or before `day`. */
export function prevW(cal: DayCalendar, day: number): number {
  let d = day;
  for (let i = 0; !cal.isWorking(d); i++, d--) if (i > MAX_CLOSED_RUN) throw new Error("This calendar has no working days.");
  return d;
}

/** Step n working days from `day`. n > 0 lands on the nth working day after
 *  it; n < 0 the nth before it; n = 0 snaps forward to a working day. The
 *  start itself needn't be a working day. */
export function addW(cal: DayCalendar, day: number, n: number): number {
  let k = Math.round(n);
  if (k === 0) return nextW(cal, day);
  const step = k > 0 ? 1 : -1;
  let d = day;
  let closedRun = 0;
  while (k !== 0) {
    d += step;
    if (cal.isWorking(d)) { k -= step; closedRun = 0; }
    else if (++closedRun > MAX_CLOSED_RUN) throw new Error("This calendar has no working days.");
  }
  return d;
}

/** Signed working-day steps from a to b: addW(cal, a, workDiff(cal, a, b)) === b
 *  when b is a working day. */
export function workDiff(cal: DayCalendar, a: number, b: number): number {
  if (a === b) return 0;
  const [lo, hi, sign] = a < b ? [a, b, 1] : [b, a, -1];
  let n = 0;
  for (let d = lo + 1; d <= hi; d++) if (cal.isWorking(d)) n++;
  return n * sign;
}

/** Latest day F with addW(cal, F, n) <= target (the inverse of addW used by
 *  the backward pass). addW is non-decreasing in F, so nudge from a guess. */
export function latestFrom(cal: DayCalendar, target: number, n: number): number {
  let f = n === 0 ? target : addW(cal, target, -n);
  while (addW(cal, f, n) > target) f--;
  while (addW(cal, f + 1, n) <= target) f++;
  return f;
}

/** Inclusive working-day count of a task running a..b. */
export function spanW(cal: DayCalendar, a: number, b: number): number {
  return b < a ? 0 : workDiff(cal, a, b) + (cal.isWorking(a) ? 1 : 0);
}

/** Closed days between two dates, by type ("4 weather days this job"). */
export function countExceptions(cal: WorkCalendar, fromISO: string, toISO: string): Record<ExceptionType, number> {
  const out: Record<ExceptionType, number> = { holiday: 0, weather: 0, jurisdiction: 0, owner: 0, other: 0 };
  for (const e of cal.exceptions) {
    if (!e.working && e.date >= fromISO && e.date <= toISO) out[e.type] += 1;
  }
  return out;
}

/** CMI's observed holidays for a year (Spec R2 §5): New Year's Day, Memorial
 *  Day, July 4, Labor Day, Thanksgiving + Friday, Dec 24 through Jan 1.
 *  Weekend dates are kept; they're closed anyway. */
export function cmiHolidays(year: number): CalendarException[] {
  const iso = (m: number, d: number) => `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const nthDow = (m: number, dow: number, nth: number) => {
    const first = dayNum(iso(m, 1));
    return first + ((dow - dayOfWeek(first) + 7) % 7) + (nth - 1) * 7;
  };
  const lastDow = (m: number, dow: number) => {
    const last = (m === 12 ? dayNum(`${year + 1}-01-01`) : dayNum(iso(m + 1, 1))) - 1;
    return last - ((dayOfWeek(last) - dow + 7) % 7);
  };
  const h = (date: string, label: string): CalendarException => ({ date, working: false, type: "holiday", label });
  const thanksgiving = nthDow(11, 4, 4);
  return [
    h(iso(1, 1), "New Year's Day"),
    h(isoOf(lastDow(5, 1)), "Memorial Day"),
    h(iso(7, 4), "Independence Day"),
    h(isoOf(nthDow(9, 1, 1)), "Labor Day"),
    h(isoOf(thanksgiving), "Thanksgiving"),
    h(isoOf(thanksgiving + 1), "Day after Thanksgiving"),
    ...[24, 25, 26, 27, 28, 29, 30, 31].map((d) => h(iso(12, d), d === 25 ? "Christmas Day" : "Holiday shutdown")),
  ];
}
