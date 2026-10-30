// Create a schedule from the Add Schedule wizard: the schedule itself, then its
// items from a template or a copy of another schedule. Shared by the job
// Schedule tab and the global Schedules page.
import type { JobSchedule, ScheduleDraft, ScheduleItem } from "@/lib/schedules/types";
import type { ScheduleSource } from "./add-schedule-wizard";
import { fmtDate } from "./shared";

export async function createScheduleFromWizard(jobId: string, draft: ScheduleDraft, source: ScheduleSource): Promise<{ schedule: JobSchedule | null; message: string }> {
  const json = { "Content-Type": "application/json" };
  const res = await fetch(`/api/jobs/${jobId}/schedules`, { method: "POST", headers: json, body: JSON.stringify(draft) });
  if (!res.ok) return { schedule: null, message: "Could not create the schedule." };
  const schedule: JobSchedule = await res.json();

  if (source.mode === "copy" && source.copyFromId) {
    const src = await fetch(`/api/schedules/${source.copyFromId}`).then((r) => r.json()).catch(() => ({}));
    const items: ScheduleItem[] = src.items ?? [];
    for (const it of items) {
      const { id: _id, schedule_id: _s, phase_id: _p, created_at: _c, updated_at: _u, ...rest } = it;
      await fetch(`/api/schedules/${schedule.id}/items`, { method: "POST", headers: json, body: JSON.stringify(rest) });
    }
    return { schedule, message: `${items.length} item${items.length === 1 ? "" : "s"} copied.` };
  }
  if (source.mode === "template" && source.templateId) {
    const r = await fetch(`/api/schedules/${schedule.id}/apply-template`, { method: "POST", headers: json, body: JSON.stringify({ templateId: source.templateId, startDate: draft.start_date || null, autoCascade: source.autoCascade !== false }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return { schedule, message: d.error ? `Schedule created, but the template wasn't applied: ${d.error}` : "Schedule created, but the template wasn't applied." };
    const missing = d.unmatched_assignees?.length ? ` Not assigned (no staff account by that name): ${d.unmatched_assignees.join(", ")}.` : "";
    return { schedule, message: `${d.items} items added, ${fmtDate(d.start)} to ${fmtDate(d.finish)}.${missing}` };
  }
  return { schedule, message: "Schedule created." };
}
