// Work calendars, database side (Spec R2 §5): the company calendar (Settings →
// Scheduling), a job's overrides (Saturdays, weather / owner / jurisdiction
// days), and a schedule's own calendar when it has no job. Saving recalculates
// the schedules on the critical path engine that use it.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { countExceptions, mergeCalendars, type CalendarException, type CalendarLevel, type ExceptionType } from "./calendar.ts";
import { recalcSchedule } from "./engine";
import type { Workdays } from "./types";

export type CalendarScope = "company" | "job" | "schedule";
export type StoredCalendar = { workdays: Workdays | null; exceptions: CalendarException[]; version: number; updated_at: string | null };

const TYPES: ExceptionType[] = ["holiday", "weather", "jurisdiction", "owner", "other"];
const DAYS: (keyof Workdays)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

async function findRow(scope: CalendarScope, scopeId: string | null) {
  let q = getSupabaseAdmin().from("schedule_calendars").select("id, workdays, exceptions, version, updated_at").eq("scope", scope);
  q = scopeId ? q.eq("scope_id", scopeId) : q.is("scope_id", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCalendar(scope: CalendarScope, scopeId: string | null): Promise<StoredCalendar | null> {
  const row = await findRow(scope, scope === "company" ? null : scopeId);
  return row ? { workdays: (row.workdays ?? null) as Workdays | null, exceptions: (row.exceptions ?? []) as CalendarException[], version: row.version ?? 1, updated_at: row.updated_at } : null;
}

/** What a job or schedule calendar inherits (the company calendar). */
export async function inheritedFor(scope: CalendarScope): Promise<CalendarLevel | null> {
  if (scope === "company") return null;
  const c = await getCalendar("company", null);
  return c ? { workdays: c.workdays, exceptions: c.exceptions } : null;
}

/** Clean and check what someone typed: real dates, known types, one entry per date. */
export function cleanCalendar(input: { workdays?: unknown; exceptions?: unknown }): { workdays: Workdays | null; exceptions: CalendarException[] } {
  let workdays: Workdays | null = null;
  if (input.workdays && typeof input.workdays === "object") {
    const w = input.workdays as Record<string, unknown>;
    workdays = Object.fromEntries(DAYS.map((d) => [d, w[d] === true])) as Workdays;
    if (!DAYS.some((d) => workdays![d])) throw new Error("Pick at least one working day.");
  }
  const byDate = new Map<string, CalendarException>();
  for (const raw of Array.isArray(input.exceptions) ? input.exceptions : []) {
    const e = raw as Record<string, unknown>;
    const date = String(e.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T00:00:00Z`).getTime())) throw new Error(`“${e.date}” isn't a date.`);
    const type = TYPES.includes(e.type as ExceptionType) ? (e.type as ExceptionType) : "other";
    const label = String(e.label ?? "").trim().slice(0, 120) || null;
    byDate.set(date, { date, working: e.working === true, type, label });
  }
  return { workdays, exceptions: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

export type SaveResult = { recalculated: number; moved: number };

export async function saveCalendar(scope: CalendarScope, scopeId: string | null, input: { workdays?: unknown; exceptions?: unknown }, actor?: { id?: string | null }): Promise<SaveResult> {
  const sb = getSupabaseAdmin();
  const { workdays, exceptions } = cleanCalendar(input);
  const id = scope === "company" ? null : scopeId;
  if (scope !== "company" && !id) throw new Error("Which job or schedule?");
  const existing = await findRow(scope, id);
  const row = { workdays, exceptions, updated_by: actor?.id ?? null, updated_at: new Date().toISOString() };
  const res = existing
    ? await sb.from("schedule_calendars").update({ ...row, version: (existing.version ?? 1) + 1 }).eq("id", existing.id)
    : await sb.from("schedule_calendars").insert({ ...row, scope, scope_id: id, name: scope === "company" ? "CMI company calendar" : scope === "job" ? "Job calendar" : "Schedule calendar" });
  if (res.error) throw new Error(res.error.message);
  return recalcUsing(scope, id, actor);
}

/** Re-run every engine schedule the calendar touches (one run per job network). */
async function recalcUsing(scope: CalendarScope, scopeId: string | null, actor?: { id?: string | null }): Promise<SaveResult> {
  let q = getSupabaseAdmin().from("job_schedules").select("id, job_id").neq("scheduling_mode", "legacy").neq("status", "archived");
  if (scope === "job") q = q.eq("job_id", scopeId!);
  if (scope === "schedule") q = q.eq("id", scopeId!);
  const { data } = await q;
  const seenJobs = new Set<string>();
  let recalculated = 0, moved = 0;
  for (const s of data ?? []) {
    if (s.job_id) { if (seenJobs.has(s.job_id)) continue; seenJobs.add(s.job_id); }
    const r = await recalcSchedule(s.id, actor ?? undefined);
    recalculated++; moved += r.moved.length;
  }
  return { recalculated, moved };
}

/** Closed days by type over the calendar's dates (for time-extension requests). */
export function closedDayCounts(level: CalendarLevel | null) {
  const cal = mergeCalendars(level);
  return countExceptions(cal, "0000-01-01", "9999-12-31");
}
