// Schedule notifications: persisted per-recipient rows that feed the staff bell
// + web push. Events (assignment, date move, status) are inserted when they
// happen; "due soon" rows are generated lazily when the feed/count is read.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToStaff } from "@/lib/push/web-push";
import { canSendOutbound } from "@/lib/notifications/dispatch";
import { isFeatureEnabled } from "@/lib/flags";
import { fmtISO } from "./workdays";
import { DEFAULT_REMINDER_DAYS, reminderSubtitle, startReminders, type ReminderTask } from "./reminders.ts";
import type { Assignee } from "./types";

export function assigneeStaffIds(assignees: Assignee[] | null | undefined): string[] {
  return (assignees ?? []).filter((a) => a && a.id && (a.type == null || a.type === "staff")).map((a) => a.id);
}

const scheduleHref = (jobId: string | null) => (jobId ? `/dashboard/jobs/${jobId}/schedule` : "/dashboard/schedules");

// Insert notification rows for the given recipients (excluding the actor) + push.
export async function notifyScheduleEvent(opts: {
  kind: "assigned" | "moved" | "status";
  recipientIds: string[];
  jobId: string | null;
  scheduleId: string;
  itemId: string;
  title: string;
  subtitle: string;
  actorId?: string | null;
}): Promise<void> {
  const recipients = Array.from(new Set(opts.recipientIds.filter((id) => id && id !== opts.actorId)));
  if (!recipients.length) return;
  const sb = getSupabaseAdmin();
  try {
    await sb.from("schedule_notifications").insert(recipients.map((rid) => ({
      recipient_staff_id: rid, kind: opts.kind, title: opts.title, subtitle: opts.subtitle,
      job_id: opts.jobId, schedule_id: opts.scheduleId, item_id: opts.itemId,
    })));
  } catch { /* notifications must never block the operation */ }
  // Push reaches real phones, so it's held outside production like other notifications.
  if (!canSendOutbound()) return;
  try {
    await sendPushToStaff(recipients, { title: opts.title, body: opts.subtitle, url: scheduleHref(opts.jobId), tag: `sched-${opts.itemId}` });
  } catch { /* push is best-effort */ }
}

// Lazily create "due soon" rows for this staff member's open assigned items due
// within 3 days. Idempotent per (recipient, item, due-date) via dedupe_key.
export async function generateDueSoon(staffId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const today = fmtISO(new Date());
  const soon = fmtISO(new Date(Date.now() + 3 * 86400000));
  try {
    const { data: rows } = await sb.from("schedule_items")
      .select("id, job_id, schedule_id, title, end_date, status, assignees")
      .gte("end_date", today).lte("end_date", soon)
      .not("status", "in", "(complete,cancelled)")
      .limit(500);
    // Filter to items assigned to this staff member (JSON containment on an
    // array of objects is unreliable through PostgREST, so filter in JS).
    const items = (rows ?? []).filter((it) => assigneeStaffIds((it.assignees ?? []) as Assignee[]).includes(staffId));
    for (const it of items) {
      await sb.from("schedule_notifications").upsert({
        recipient_staff_id: staffId, kind: "due", title: `Due soon: ${it.title}`,
        subtitle: `Due ${it.end_date}`, job_id: it.job_id, schedule_id: it.schedule_id, item_id: it.id,
        dedupe_key: `due:${it.id}:${it.end_date}`,
      }, { onConflict: "recipient_staff_id,dedupe_key", ignoreDuplicates: true });
    }
  } catch { /* best-effort */ }
}

// "Starts soon" reminders (Phase 2 Step 6, flag schedule_progress): each staff
// assignee, N working days before a task starts (jobs.schedule_reminder_days,
// default 5, 0 = off). Lazily for one person's bell; the scheduled run does
// everyone and pushes the new ones to phones. One per task per start date.
export async function sendStartReminders(opts: { staffId?: string; push?: boolean; dryRun?: boolean } = {}): Promise<number> {
  if (!(await isFeatureEnabled("schedule_progress"))) return 0;
  const sb = getSupabaseAdmin();
  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // 30 working days is the most a job can ask for: about six weeks of calendar.
  const horizon = fmtISO(new Date(now.getTime() + 44 * 86400000));
  try {
    const { data: rows } = await sb.from("schedule_items")
      .select("id, title, job_id, schedule_id, status, start_date, percent_complete, actual_start, assignees")
      .gte("start_date", today).lte("start_date", horizon).not("status", "in", "(complete,cancelled)").limit(3000);
    let tasks = (rows ?? []) as ReminderTask[];
    if (opts.staffId) tasks = tasks.filter((x) => assigneeStaffIds((x.assignees ?? []) as Assignee[]).includes(opts.staffId!));
    if (!tasks.length) return 0;
    const jobIds = Array.from(new Set(tasks.map((x) => x.job_id).filter(Boolean))) as string[];
    const days = new Map<string, number>();
    if (jobIds.length) {
      const { data: jobs, error } = await sb.from("jobs").select("id, schedule_reminder_days").in("id", jobIds);
      if (!error) for (const j of jobs ?? []) days.set(j.id, (j as { schedule_reminder_days: number | null }).schedule_reminder_days ?? DEFAULT_REMINDER_DAYS);
    }
    let due = startReminders(tasks, (job) => (job ? days.get(job) ?? DEFAULT_REMINDER_DAYS : DEFAULT_REMINDER_DAYS), today);
    if (opts.staffId) due = due.filter((r) => r.staffId === opts.staffId);
    if (opts.dryRun || !due.length) return due.length;
    const { data: made } = await sb.from("schedule_notifications").upsert(due.map((r) => ({
      recipient_staff_id: r.staffId, kind: "starting", title: `Starting soon: ${r.title}`, subtitle: reminderSubtitle(r),
      job_id: r.jobId, schedule_id: r.scheduleId, item_id: r.itemId, dedupe_key: r.dedupe,
    })), { onConflict: "recipient_staff_id,dedupe_key", ignoreDuplicates: true }).select("recipient_staff_id, title, subtitle, job_id, item_id");
    // Phones only hear about the ones that are new, and only in production.
    if (opts.push && canSendOutbound()) {
      for (const m of made ?? []) {
        try { await sendPushToStaff([m.recipient_staff_id], { title: m.title, body: m.subtitle ?? "", url: scheduleHref(m.job_id), tag: `sched-start-${m.item_id}` }); }
        catch { /* push is best-effort */ }
      }
    }
    return (made ?? []).length;
  } catch { return 0; /* reminders are best-effort */ }
}

export type ScheduleFeedItem = { id: string; title: string; subtitle: string; time: string; href: string };

export async function listScheduleNotifications(staffId: string): Promise<ScheduleFeedItem[]> {
  await Promise.all([generateDueSoon(staffId), sendStartReminders({ staffId })]);
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_notifications")
    .select("id, title, subtitle, job_id, created_at")
    .eq("recipient_staff_id", staffId).is("read_at", null)
    .order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle ?? "", time: r.created_at, href: scheduleHref(r.job_id) }));
}

export async function countScheduleNotifications(staffId: string): Promise<number> {
  await Promise.all([generateDueSoon(staffId), sendStartReminders({ staffId })]);
  const sb = getSupabaseAdmin();
  const { count } = await sb.from("schedule_notifications").select("id", { count: "exact", head: true }).eq("recipient_staff_id", staffId).is("read_at", null);
  return count ?? 0;
}

export async function markScheduleNotificationRead(staffId: string, id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("schedule_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("recipient_staff_id", staffId);
}
