// Inspection milestones, Step 4: "Call today for tomorrow's inspections" on the
// Today page. Open inspection milestones (Not Ready / Ready to Call) whose
// request-by date (the jurisdiction's cutoff on the working day before) is today
// or already past. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { todayAZ } from "@/lib/schedules/progress";
import { inspectionsEnabled } from "./data";
import { requestBy, inspectionStatusLabel } from "./status";

export type InspectionToCall = {
  itemId: string; scheduleId: string; jobId: string; jobLabel: string; title: string; date: string;
  status: string; requestBy: string; overdue: boolean; jurisdiction: string | null;
};

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export async function inspectionsToCall(today = todayAZ(), limit = 20): Promise<InspectionToCall[]> {
  if (!(await inspectionsEnabled())) return [];
  const sb = getSupabaseAdmin();
  // Anything due to be requested by today sits within the next few days (a Monday inspection is requested Friday).
  const { data: items, error } = await sb.from("schedule_items")
    .select("id, schedule_id, job_id, title, start_date, status, inspection_status")
    .not("inspection_step_id", "is", null).neq("status", "cancelled")
    .or("inspection_status.is.null,inspection_status.in.(not_ready,ready_to_call)")
    .gte("start_date", addDays(today, -14)).lte("start_date", addDays(today, 5))
    .order("start_date").limit(200);
  if (error || !items?.length) return [];
  const jobIds = Array.from(new Set(items.map((i) => i.job_id).filter(Boolean))) as string[];
  const { data: jobs } = jobIds.length ? await sb.from("jobs").select("id, job_number, job_name, jurisdiction_code, status").in("id", jobIds) : { data: [] };
  const codes = Array.from(new Set((jobs ?? []).map((j) => j.jurisdiction_code).filter(Boolean))) as string[];
  const { data: jurs } = codes.length ? await sb.from("inspection_jurisdictions").select("code, name, cutoff_minutes, scheduling_method").in("code", codes) : { data: [] };
  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
  const jurByCode = new Map((jurs ?? []).map((j) => [j.code, j]));
  const out: InspectionToCall[] = [];
  for (const i of items) {
    const job = i.job_id ? jobById.get(i.job_id) : null;
    if (!job || !i.start_date) continue;
    const jur = job.jurisdiction_code ? jurByCode.get(job.jurisdiction_code) : null;
    // No published cutoff: ask the day before, by end of day.
    const by = requestBy(i.start_date, jur?.cutoff_minutes ?? 1440, jur?.scheduling_method ?? null);
    if (!by || by.date > today) continue;
    out.push({
      itemId: i.id, scheduleId: i.schedule_id, jobId: job.id,
      jobLabel: [job.job_number, job.job_name].filter(Boolean).join(" · ") || "Job",
      title: i.title, date: i.start_date, status: inspectionStatusLabel(i.inspection_status),
      requestBy: jur?.cutoff_minutes == null ? `${by.label.replace("midnight", "end of day")} (cutoff to confirm)` : by.label,
      overdue: by.date < today, jurisdiction: jur?.name ?? null,
    });
  }
  return out.slice(0, limit);
}
