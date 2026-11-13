// Inspection milestones, Step 5: reconcile a schedule's inspections with the
// permit's printed list, then apply what the PM confirmed. Rules in ./permit.ts.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listItems, logActivity, syncScheduleProgress } from "@/lib/schedules/data";
import { engineModeFor, recalcSchedule, nextActivityId } from "@/lib/schedules/engine";
import { todayAZ } from "@/lib/schedules/progress";
import { setInspectionStatus } from "./status-data";
import { parsePermitList, reconcile, permitTitle, permitStepId, isInspection, type PermitItem, type Reconcile } from "./permit";

export class PermitError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

const MIGRATION = "Apply 2026-11-12_inspection_permit_list.sql first.";

async function context(scheduleId: string) {
  const sb = getSupabaseAdmin();
  const { data: sched } = await sb.from("job_schedules").select("id, job_id, name").eq("id", scheduleId).maybeSingle();
  if (!sched) throw new PermitError("Schedule not found.", 404);
  if (!sched.job_id) throw new PermitError("Permit lists are for job schedules.");
  const items = await listItems({ scheduleId });
  return { sb, sched, items };
}

export type PermitState = {
  text: string;
  verified_on: string | null;
  verified_by: string | null;
  tasks: { id: string; title: string; end_date: string | null }[];
  inspections: number;
};

/** What's saved on the job, and the schedule's tasks (for "add after"). */
export async function permitState(scheduleId: string): Promise<PermitState> {
  const { sb, sched, items } = await context(scheduleId);
  const { data: job, error } = await sb.from("jobs").select("inspection_permit_list, inspection_list_verified_on, inspection_list_verified_by").eq("id", sched.job_id).maybeSingle();
  if (error) throw new PermitError(/inspection_/.test(error.message) ? MIGRATION : error.message, /inspection_/.test(error.message) ? 409 : 500);
  let by: string | null = null;
  if (job?.inspection_list_verified_by) {
    const { data: s } = await sb.from("staff_users").select("display_name, email").eq("id", job.inspection_list_verified_by).maybeSingle();
    by = s?.display_name || s?.email || null;
  }
  return {
    text: job?.inspection_permit_list ?? "",
    verified_on: job?.inspection_list_verified_on ?? null,
    verified_by: by,
    tasks: items.filter((i) => i.kind !== "milestone" && i.status !== "cancelled").map((i) => ({ id: i.id, title: i.title, end_date: i.end_date ?? null })),
    inspections: items.filter((i) => isInspection(i as unknown as PermitItem)).length,
  };
}

/** Compare a pasted permit list with the schedule's inspections (no changes). */
export async function permitPreview(scheduleId: string, text: string): Promise<Reconcile> {
  const { items } = await context(scheduleId);
  const lines = parsePermitList(text);
  if (!lines.length) throw new PermitError("Paste the permit's inspection list, one inspection per line.");
  return reconcile(lines, items as unknown as PermitItem[]);
}

export type PermitApply = {
  text: string;
  /** Permit line number → the schedule items it is (the PM can override the suggested match). */
  matches: { line: number; item_ids: string[] }[];
  /** Items not on the permit to mark N/A. */
  na: string[];
  /** Permit lines to add as new milestones, after a task (or on today's date). */
  adds: { line: number; after_item_id?: string | null }[];
};

export type PermitResult = { renamed: number; marked_na: number; added: number; linked: number; verified_on: string };

export async function applyPermit(scheduleId: string, body: PermitApply, actor: { id: string; name?: string | null; role: string | null }): Promise<PermitResult> {
  const { sb, sched, items } = await context(scheduleId);
  const lines = parsePermitList(body.text);
  if (!lines.length) throw new PermitError("Paste the permit's inspection list, one inspection per line.");
  const lineByN = new Map(lines.map((l) => [l.n, l]));
  const byId = new Map(items.map((i) => [i.id, i as unknown as PermitItem & { end_date?: string | null; phase_id?: string | null; kind: string }]));
  const mine = (id: string) => { if (!byId.has(id)) throw new PermitError("An item isn't on this schedule."); return byId.get(id)!; };
  const today = todayAZ();

  // Record the list first, so a missing migration stops before anything changes.
  const { error: jobErr } = await sb.from("jobs").update({ inspection_permit_list: body.text.slice(0, 20000), inspection_list_verified_on: today, inspection_list_verified_by: actor.id }).eq("id", sched.job_id);
  if (jobErr) throw new PermitError(/inspection_/.test(jobErr.message) ? MIGRATION : jobErr.message, /inspection_/.test(jobErr.message) ? 409 : 500);

  // Matched: the permit's name and code.
  let renamed = 0;
  for (const m of body.matches ?? []) {
    const line = lineByN.get(m.line);
    if (!line) continue;
    for (const id of m.item_ids ?? []) {
      const it = mine(id);
      const title = permitTitle(it.title, line);
      const code = line.code ?? it.inspection_code;
      if (title === it.title && code === it.inspection_code) continue;
      const { error } = await sb.from("schedule_items").update({ title, inspection_code: code, updated_by: actor.id, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw new Error(error.message);
      renamed++;
    }
  }

  // Not on the permit: N/A (kept on record).
  let markedNa = 0;
  for (const id of body.na ?? []) {
    const it = mine(id);
    if (it.inspection_status === "na") continue;
    await setInspectionStatus(id, { status: "na", note: "Not on the permit's inspection list" }, actor);
    markedNa++;
  }

  // Permit-only: new milestones after the chosen task.
  const adds = (body.adds ?? []).filter((a) => lineByN.has(a.line));
  let linked = 0;
  if (adds.length) {
    const { count } = await sb.from("schedule_items").select("id", { count: "exact", head: true }).eq("schedule_id", scheduleId);
    const first = count ?? 0;
    const ids = await nextActivityId(scheduleId, adds.length);
    const rows = adds.map((a, i) => {
      const line = lineByN.get(a.line)!;
      const after = a.after_item_id ? mine(a.after_item_id) : null;
      const date = after?.end_date ?? today;
      return {
        schedule_id: scheduleId, job_id: sched.job_id, phase_id: after?.phase_id ?? null,
        kind: "milestone", title: permitTitle("INSP · ", line), start_date: date, end_date: date, duration_days: null, duration_source: "template",
        milestone_type: "inspection", master_display: "milestone_only",
        internal_notes: `From the permit's inspection list: ${line.raw}`,
        inspection_step_id: permitStepId(line), inspection_code: line.code, inspection_status: "not_ready",
        status: "not_started", sort_order: first + i, activity_id: ids[i], created_by: actor.id, updated_by: actor.id,
      };
    });
    const { data: ins, error } = await sb.from("schedule_items").insert(rows).select("id, sort_order");
    if (error) throw new Error(error.message);
    const deps = (ins ?? []).flatMap((r) => {
      const a = adds[r.sort_order - first];
      return a?.after_item_id ? [{ job_id: sched.job_id, source_item_id: a.after_item_id, target_item_id: r.id, dependency_type: "finish_to_start", lag_days: 0, auto_cascade: true, created_by: actor.id }] : [];
    });
    if (deps.length) { const { error: e } = await sb.from("schedule_dependencies").insert(deps); if (e) throw new Error(e.message); }
    linked = deps.length;
    if (await engineModeFor(scheduleId)) await recalcSchedule(scheduleId, { id: actor.id, name: actor.name ?? null });
    await syncScheduleProgress(scheduleId).catch(() => null);
  }

  await logActivity({
    jobId: sched.job_id, scheduleId, action: "inspections_permit_reconciled", actor: { id: actor.id, name: actor.name ?? null },
    detail: { lines: lines.length, renamed, marked_na: markedNa, added: adds.length, linked },
  });
  return { renamed, marked_na: markedNa, added: adds.length, linked, verified_on: today };
}
