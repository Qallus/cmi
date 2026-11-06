// Three-week lookahead, database side (Phase 2 Step 3, flag schedule_progress).
// Loads a schedule's tasks, phases and the selections they wait on, then
// builds the rows with lookahead.ts. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs/data";
import { getSchedule, listItems, listPhases, scopeLabel } from "./data";
import { todayAZ } from "./progress.ts";
import { buildLookahead, type LookaheadAudience, type LookaheadSelection } from "./lookahead.ts";

export async function loadLookahead(scheduleId: string, audience: LookaheadAudience, today = todayAZ()) {
  const schedule = await getSchedule(scheduleId);
  if (!schedule) throw Object.assign(new Error("Schedule not found."), { status: 404 });
  const sb = getSupabaseAdmin();
  const [items, phases, job] = await Promise.all([
    listItems({ scheduleId }), listPhases(scheduleId),
    schedule.job_id ? getJob(schedule.job_id) : Promise.resolve(null),
  ]);
  const selIds = Array.from(new Set(items.filter((i) => i.link_type === "selection" && i.link_id).map((i) => i.link_id!)));
  const { data: sels } = selIds.length
    ? await sb.from("project_selections").select("id, name, status, target_decision_date, client_visible").in("id", selIds)
    : { data: [] };
  const lookahead = buildLookahead(items, phases, (sels ?? []) as LookaheadSelection[], today, audience);
  const project = job
    ? { name: job.job_name, number: job.job_number ?? null, address: job.full_address ?? null }
    : { name: schedule.scope_id ? await scopeLabel({ type: schedule.scope_type ?? "job", id: schedule.scope_id }) : "Project", number: null, address: null };
  return { schedule: { id: schedule.id, name: schedule.name, status_date: schedule.status_date ?? null }, project, audience, today, lookahead };
}

export type LookaheadData = Awaited<ReturnType<typeof loadLookahead>>;
