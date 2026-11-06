// Start reminders (Phase 2 Step 6, Spec R2 §7.6). Pure, so the bell, the
// scheduled run and the tests agree on who's reminded about what: each staff
// assignee of an open task, once it's within the job's reminder window
// (working days, Monday–Friday; default 5, 0 = off). The dedupe key carries
// the start date, so a task that moves is reminded again for its new date.

export type ReminderTask = {
  id: string; title: string; job_id: string | null; schedule_id: string; status: string | null;
  start_date: string | null; percent_complete?: number | null; actual_start?: string | null;
  assignees?: { id: string; name?: string; type?: string | null }[] | null;
};
export type StartReminder = { itemId: string; staffId: string; jobId: string | null; scheduleId: string; title: string; start: string; inDays: number; dedupe: string };

export const DEFAULT_REMINDER_DAYS = 5;

/** Weekdays from `today` to `date` (0 = today, 1 = next weekday…); negative if past. */
export function weekdaysUntil(today: string, date: string): number {
  const a = Date.parse(`${today}T12:00:00Z`), b = Date.parse(`${date}T12:00:00Z`);
  if (b < a) return -1;
  let n = 0;
  for (let d = new Date(a); d.getTime() < b; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

export function startReminders(tasks: ReminderTask[], daysForJob: (jobId: string | null) => number, today: string): StartReminder[] {
  const out: StartReminder[] = [];
  for (const t of tasks) {
    if (!t.start_date || t.status === "complete" || t.status === "cancelled" || t.actual_start || (t.percent_complete ?? 0) > 0) continue;
    const window = daysForJob(t.job_id);
    if (!window) continue;
    const inDays = weekdaysUntil(today, t.start_date);
    if (inDays < 0 || inDays > window) continue;
    const staff = new Set((t.assignees ?? []).filter((a) => a?.id && (a.type == null || a.type === "staff")).map((a) => a.id));
    for (const staffId of staff) out.push({ itemId: t.id, staffId, jobId: t.job_id, scheduleId: t.schedule_id, title: t.title, start: t.start_date, inDays, dedupe: `start:${t.id}:${t.start_date}` });
  }
  return out;
}

export function reminderSubtitle(r: Pick<StartReminder, "start" | "inDays">): string {
  const day = new Date(`${r.start}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return r.inDays === 0 ? `Starts today (${day})` : r.inDays === 1 ? `Starts tomorrow (${day})` : `Starts ${day}, in ${r.inDays} working days`;
}
