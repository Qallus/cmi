// Schedule health, database side (Phase 2 Step 5, flag schedule_progress).
// One schedule's tiles for the schedule page, and the job schedules that need
// a look for the Today page. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import { mergeCalendars } from "./calendar.ts";
import { calendarFor } from "./engine-core.ts";
import { ENGINE_FLAG, PROGRESS_FLAG, loadNetwork } from "./engine";
import { listItems } from "./data";
import { todayAZ } from "./progress.ts";
import { scheduleHealth, type Health, type HealthSelection } from "./health.ts";

export async function loadHealth(scheduleId: string, today = todayAZ()): Promise<Health> {
  const [net, items, engineOn] = await Promise.all([loadNetwork(scheduleId), listItems({ scheduleId }), isFeatureEnabled(ENGINE_FLAG)]);
  const me = net.schedules.find((s) => s.id === scheduleId);
  if (!me) throw Object.assign(new Error("Schedule not found."), { status: 404 });
  const { data: row } = await getSupabaseAdmin().from("job_schedules").select("status_date, engine_finish, target_completion, start_date").eq("id", scheduleId).maybeSingle();
  const selIds = Array.from(new Set(items.filter((i) => i.link_type === "selection" && i.link_id).map((i) => i.link_id!)));
  const { data: sels } = selIds.length
    ? await getSupabaseAdmin().from("project_selections").select("id, name, status, target_decision_date").in("id", selIds)
    : { data: [] };
  return scheduleHealth({
    items, selections: (sels ?? []) as HealthSelection[],
    cal: calendarFor(net, me), workCalendar: mergeCalendars(net.company, { workdays: me.workdays }, net.job, net.scheduleCals?.[me.id]),
    onEngine: engineOn && (me.scheduling_mode ?? "legacy") !== "legacy",
    statusDate: row?.status_date ?? null, today, engineFinish: row?.engine_finish ?? null,
    targetCompletion: row?.target_completion ?? null, startDate: row?.start_date ?? null,
  });
}

export type ScheduleNeedingLook = { scheduleId: string; scheduleName: string; jobId: string; jobLabel: string; issues: number; tiles: Health["tiles"] };

/** Job schedules with a warning or a problem, worst first (Today page). */
export async function schedulesNeedingALook(limit = 6): Promise<ScheduleNeedingLook[]> {
  if (!(await isFeatureEnabled(PROGRESS_FLAG))) return [];
  const sb = getSupabaseAdmin();
  const { data: scheds } = await sb.from("job_schedules").select("id, name, job_id, is_master, jobs(job_number, job_name)")
    .not("job_id", "is", null).neq("status", "archived").order("is_master", { ascending: false }).limit(25);
  type Row = { id: string; name: string; job_id: string; jobs: { job_number: string | null; job_name: string | null } | null };
  const rows = (scheds ?? []) as unknown as Row[];
  const out = await Promise.all(rows.map(async (s) => {
    try {
      const h = await loadHealth(s.id);
      return { scheduleId: s.id, scheduleName: s.name, jobId: s.job_id, jobLabel: s.jobs?.job_number || s.jobs?.job_name || "Job", issues: h.issues, tiles: h.tiles.filter((t) => t.tone === "bad" || t.tone === "warn") };
    } catch { return null; }
  }));
  return out.filter((x): x is ScheduleNeedingLook => !!x && x.issues > 0).sort((a, b) => b.issues - a.issues).slice(0, limit);
}
