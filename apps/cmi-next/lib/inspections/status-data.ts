// Inspection milestones, Step 4: read and change one milestone's inspection
// status. The rules are in ./status.ts; who may change it is Settings →
// Scheduling → Inspections (mayUpdateInspectionStatus).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { updateItem, logActivity } from "@/lib/schedules/data";
import { todayAZ } from "@/lib/schedules/progress";
import { mayUpdateInspectionStatus } from "./data";
import { inspectionPatch, requestBy, inspectionStatusLabel, unpassedInspectionsBefore, type HoldItem } from "./status";

export class InspectionStatusError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type InspectionInfo = {
  item_id: string;
  step_id: string;
  status: string;
  status_label: string;
  date: string | null;
  hold_point: boolean;
  request_rule: string | null;
  ready_checklist: string | null;
  jurisdiction: { code: string; name: string; cutoff_label: string | null; scheduling_method: string | null; portal_url: string | null; phone: string | null } | null;
  request_by: { date: string; label: string } | null;
  can_update: boolean;
};

type ItemRow = {
  id: string; title: string; schedule_id: string; job_id: string | null; kind: string; status: string | null;
  start_date: string | null; internal_notes: string | null; actual_start: string | null; actual_finish: string | null;
  inspection_step_id: string | null; inspection_status: string | null;
};

async function loadItem(itemId: string): Promise<ItemRow> {
  const { data, error } = await getSupabaseAdmin().from("schedule_items")
    .select("id, title, schedule_id, job_id, kind, status, start_date, internal_notes, actual_start, actual_finish, inspection_step_id, inspection_status")
    .eq("id", itemId).maybeSingle();
  if (error) {
    if (/inspection_/.test(error.message)) throw new InspectionStatusError("Apply 2026-11-11_inspection_schedule_items.sql first.", 409);
    throw new Error(error.message);
  }
  if (!data) throw new InspectionStatusError("Item not found.", 404);
  if (!data.inspection_step_id) throw new InspectionStatusError("This isn't an inspection milestone.");
  return data as ItemRow;
}

/** The milestone's status, hold point, how to request it and by when. */
export async function inspectionInfo(itemId: string, role: string | null | undefined): Promise<InspectionInfo> {
  const sb = getSupabaseAdmin();
  const item = await loadItem(itemId);
  const [{ data: lib }, { data: job }, canUpdate] = await Promise.all([
    sb.from("inspection_library").select("hold_point, request_rule, ready_checklist, jurisdiction_code").eq("milestone_id", item.inspection_step_id!).maybeSingle(),
    item.job_id ? sb.from("jobs").select("jurisdiction_code").eq("id", item.job_id).maybeSingle() : Promise.resolve({ data: null }),
    mayUpdateInspectionStatus(role),
  ]);
  const code = (job?.jurisdiction_code as string | null) ?? (lib?.jurisdiction_code as string | null) ?? null;
  const { data: jur } = code
    ? await sb.from("inspection_jurisdictions").select("code, name, cutoff_minutes, cutoff_label, scheduling_method, portal_url, phone").eq("code", code).maybeSingle()
    : { data: null };
  const status = item.inspection_status ?? "not_ready";
  const open = !["passed", "na"].includes(status);
  const by = open ? requestBy(item.start_date, jur?.cutoff_minutes ?? null, jur?.scheduling_method ?? null) : null;
  return {
    item_id: item.id, step_id: item.inspection_step_id!, status, status_label: inspectionStatusLabel(status), date: item.start_date,
    hold_point: !!lib?.hold_point, request_rule: lib?.request_rule ?? null, ready_checklist: lib?.ready_checklist ?? null,
    jurisdiction: jur ? { code: jur.code, name: jur.name, cutoff_label: jur.cutoff_label, scheduling_method: jur.scheduling_method, portal_url: jur.portal_url, phone: jur.phone } : null,
    request_by: by ? { date: by.date, label: by.label } : null,
    can_update: canUpdate,
  };
}

/** Change the status (with a date and note where it needs one), then re-forecast through updateItem. */
export async function setInspectionStatus(
  itemId: string, change: { status: string; date?: string | null; note?: string | null },
  actor: { id: string; name?: string | null; role: string | null },
) {
  if (!(await mayUpdateInspectionStatus(actor.role))) throw new InspectionStatusError("Your role can't update inspection status (Settings → Scheduling → Inspections).", 403);
  const item = await loadItem(itemId);
  const r = inspectionPatch(item, change, { today: todayAZ(), who: actor.name ?? null });
  if ("error" in r) throw new InspectionStatusError(r.error);
  const result = await updateItem(itemId, r.patch, { id: actor.id, name: actor.name ?? null }, { inspectionStatus: true });
  await logActivity({
    jobId: item.job_id, scheduleId: item.schedule_id, itemId, action: "inspection_status", actor: { id: actor.id, name: actor.name ?? null },
    detail: { step_id: item.inspection_step_id, from: item.inspection_status ?? "not_ready", to: change.status, date: change.date ?? null, note: change.note ?? null },
  });
  return result;
}

/** Inspections linked before an item that haven't passed (for the hold point warning). */
export async function holdPointsBefore(itemId: string): Promise<{ id: string; title: string; status: string }[]> {
  const sb = getSupabaseAdmin();
  const { data: links } = await sb.from("schedule_dependencies").select("source_item_id, target_item_id").eq("target_item_id", itemId);
  const ids = (links ?? []).map((l) => l.source_item_id as string);
  if (!ids.length) return [];
  const { data: items, error } = await sb.from("schedule_items").select("id, title, kind, status, inspection_step_id, inspection_status").in("id", ids);
  if (error) return []; // columns not there yet: nothing to warn about
  return unpassedInspectionsBefore(itemId, links ?? [], (items ?? []) as HoldItem[])
    .map((i) => ({ id: i.id, title: i.title, status: inspectionStatusLabel(i.inspection_status) }));
}
