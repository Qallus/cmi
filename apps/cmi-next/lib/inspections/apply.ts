// Inspection milestones, Step 3: load library rows into a job's schedule.
// candidatesForSchedule() feeds the "Add inspections" dialog; applyInspections()
// inserts the picked milestones and their Finish→Start links in one batch and
// re-forecasts once (createItem would recalc after every row).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listItems, logActivity, syncScheduleProgress } from "@/lib/schedules/data";
import { engineModeFor, recalcSchedule, nextActivityId } from "@/lib/schedules/engine";
import { cleanConditions, INSPECTION_SCOPES, type ConditionKey, type InspectionScope } from "./conditions";
import { loadLibrary, type InspectionJurisdiction } from "./data";
import { candidatesFor, buildPlan, type Candidate, type Link, type ScheduleTaskRef, type TaskHook } from "./plan";

type Actor = { id?: string | null; name?: string | null };

export class InspectionApplyError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type InspectionProfile = {
  job: { id: string; name: string | null };
  jurisdiction: Pick<InspectionJurisdiction, "code" | "name" | "cutoff_label" | "scheduling_method"> | null;
  scope: InspectionScope | null;
  conditions: ConditionKey[];
  /** What's missing before inspections can load, in plain words. */
  missing: string[];
};

async function loadContext(scheduleId: string) {
  const sb = getSupabaseAdmin();
  const { data: sched } = await sb.from("job_schedules").select("id, job_id, name").eq("id", scheduleId).maybeSingle();
  if (!sched) throw new InspectionApplyError("Schedule not found.", 404);
  if (!sched.job_id) throw new InspectionApplyError("Inspections load into job schedules only.");
  const { data: job } = await sb.from("jobs").select("id, name, jurisdiction_code, inspection_scope, inspection_conditions").eq("id", sched.job_id).maybeSingle();
  if (!job) throw new InspectionApplyError("Job not found.", 404);
  const code = (job.jurisdiction_code as string | null) ?? null;
  const scope = INSPECTION_SCOPES.some((s) => s.value === job.inspection_scope) ? (job.inspection_scope as InspectionScope) : null;
  const { data: jur } = code
    ? await sb.from("inspection_jurisdictions").select("code, name, cutoff_label, scheduling_method").eq("code", code).maybeSingle()
    : { data: null };
  const profile: InspectionProfile = {
    job: { id: job.id, name: job.name ?? null },
    jurisdiction: jur ?? null,
    scope,
    conditions: cleanConditions(job.inspection_conditions),
    missing: [!code ? "the job's jurisdiction" : !jur ? `a jurisdiction named ${code}` : null, !scope ? "the job's scope (New, Addition or Remodel)" : null].filter(Boolean) as string[],
  };
  const items = await listItems({ scheduleId });
  const refs: ScheduleTaskRef[] = items.map((i) => {
    const r = i as unknown as Record<string, unknown>;
    return {
      id: i.id, title: i.title, kind: i.kind, status: i.status ?? null, phase_id: i.phase_id ?? null,
      start_date: i.start_date ?? null, end_date: i.end_date ?? null,
      inspection_step_id: (r.inspection_step_id as string | null | undefined) ?? null,
    };
  });
  return { sched, profile, items: refs };
}

async function loadHooks(): Promise<TaskHook[]> {
  const { data, error } = await getSupabaseAdmin().from("inspection_task_hooks").select("phase_id, hook, role, match_kind, template_task");
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskHook[];
}

async function loadLinks(itemIds: string[]): Promise<Link[]> {
  if (!itemIds.length) return [];
  const sb = getSupabaseAdmin();
  const out: Link[] = [];
  for (let i = 0; i < itemIds.length; i += 200) {
    const ids = itemIds.slice(i, i + 200);
    const { data, error } = await sb.from("schedule_dependencies").select("source_item_id, target_item_id").in("target_item_id", ids);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Link[]));
  }
  return out;
}

/** The dialog's list: every library row this job's scope allows, with its starting state. */
export async function candidatesForSchedule(scheduleId: string): Promise<{ profile: InspectionProfile; candidates: Candidate[] }> {
  const { profile, items } = await loadContext(scheduleId);
  if (profile.missing.length || !profile.jurisdiction || !profile.scope) return { profile, candidates: [] };
  const [rows, hooks] = await Promise.all([loadLibrary(profile.jurisdiction.code), loadHooks()]);
  return { profile, candidates: candidatesFor(rows, profile.scope, profile.conditions, items, hooks) };
}

export type ApplyInspectionsResult = {
  created: number;
  linked: number;
  unlinked: { step_id: string; note: string }[];
  skipped: { step_id: string; note: string }[];
};

/** Insert the picked library rows as milestones, link them, then re-forecast once. */
export async function applyInspections(
  scheduleId: string, picks: { step_id: string; count?: number }[], actor?: Actor,
): Promise<ApplyInspectionsResult> {
  const clean = picks.filter((p) => typeof p?.step_id === "string" && p.step_id.trim());
  if (!clean.length) throw new InspectionApplyError("Pick at least one inspection.");
  if (clean.length > 400) throw new InspectionApplyError("That's more inspections than one jurisdiction has.");
  const { sched, profile, items } = await loadContext(scheduleId);
  if (!profile.jurisdiction || !profile.scope) throw new InspectionApplyError(`Set ${profile.missing.join(" and ")} in Job Info first.`);

  const [rows, hooks, links] = await Promise.all([loadLibrary(profile.jurisdiction.code), loadHooks(), loadLinks(items.map((i) => i.id))]);
  const byId = new Map(rows.map((r) => [r.milestone_id, r]));
  const unknown = clean.filter((p) => !byId.has(p.step_id)).map((p) => p.step_id);
  if (unknown.length) throw new InspectionApplyError(`Not in the ${profile.jurisdiction.name} library: ${unknown.join(", ")}.`);

  const plan = buildPlan(clean.map((p) => ({ row: byId.get(p.step_id)!, count: p.count ?? 1 })), items, hooks, links);
  const sb = getSupabaseAdmin();
  const { count: itemCount } = await sb.from("schedule_items").select("id", { count: "exact", head: true }).eq("schedule_id", scheduleId);
  const firstSort = itemCount ?? 0;
  const activityIds = await nextActivityId(scheduleId, plan.milestones.length);
  const rowsToInsert = plan.milestones.map((m, i) => ({
    schedule_id: scheduleId, job_id: sched.job_id, phase_id: m.schedule_phase_id,
    kind: "milestone", title: m.title, start_date: m.date, end_date: m.date, duration_days: null,
    milestone_type: m.milestone_type, master_display: "milestone_only", wbs: m.phase_id,
    internal_notes: m.hold_point ? `Hold point: the work after this waits for a pass.\n${m.internal_notes}` : m.internal_notes,
    inspection_step_id: m.step_id, inspection_phase_id: m.phase_id, inspection_code: m.code,
    inspection_status: m.milestone_type === "inspection" ? "not_ready" : null,
    status: "not_started", sort_order: firstSort + i, activity_id: activityIds[i],
    created_by: actor?.id ?? null, updated_by: actor?.id ?? null,
  }));
  const { data: inserted, error } = await sb.from("schedule_items").insert(rowsToInsert).select("id, sort_order");
  if (error) {
    if (/inspection_(step_id|status|code|phase_id)/.test(error.message)) throw new InspectionApplyError("The inspection columns aren't on schedules yet: apply 2026-11-11_inspection_schedule_items.sql first.", 409);
    throw new Error(error.message);
  }
  const idByKey = new Map<string, string>();
  for (const r of inserted ?? []) idByKey.set(`new:${plan.milestones[r.sort_order - firstSort].key}`, r.id);
  const resolve = (ref: string) => (ref.startsWith("new:") ? idByKey.get(ref) : ref);

  const deps = plan.links.flatMap((l) => {
    const source = resolve(l.source), target = resolve(l.target);
    return source && target ? [{
      job_id: sched.job_id, source_item_id: source, target_item_id: target, dependency_type: "finish_to_start",
      lag_days: l.lag, auto_cascade: true, created_by: actor?.id ?? null,
    }] : [];
  });
  if (deps.length) { const { error: depErr } = await sb.from("schedule_dependencies").insert(deps); if (depErr) throw new Error(depErr.message); }

  if (await engineModeFor(scheduleId)) await recalcSchedule(scheduleId, actor);
  await syncScheduleProgress(scheduleId).catch(() => null);
  await logActivity({
    jobId: sched.job_id, scheduleId, action: "inspections_loaded", actor,
    detail: { jurisdiction: profile.jurisdiction.code, scope: profile.scope, milestones: rowsToInsert.length, links: deps.length, unlinked: plan.unlinked.length, skipped: plan.skipped.length },
  });
  return { created: rowsToInsert.length, linked: deps.length, unlinked: plan.unlinked, skipped: plan.skipped };
}
