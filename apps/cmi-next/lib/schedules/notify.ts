// Schedule notifications: persisted per-recipient rows that feed the staff bell
// + web push. Events (assignment, date move, status) are inserted when they
// happen; "due soon" rows are generated lazily when the feed/count is read.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToStaff } from "@/lib/push/web-push";
import { fmtISO } from "./workdays";
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

export type ScheduleFeedItem = { id: string; title: string; subtitle: string; time: string; href: string };

export async function listScheduleNotifications(staffId: string): Promise<ScheduleFeedItem[]> {
  await generateDueSoon(staffId);
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("schedule_notifications")
    .select("id, title, subtitle, job_id, created_at")
    .eq("recipient_staff_id", staffId).is("read_at", null)
    .order("created_at", { ascending: false }).limit(50);
  return (data ?? []).map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle ?? "", time: r.created_at, href: scheduleHref(r.job_id) }));
}

export async function countScheduleNotifications(staffId: string): Promise<number> {
  await generateDueSoon(staffId);
  const sb = getSupabaseAdmin();
  const { count } = await sb.from("schedule_notifications").select("id", { count: "exact", head: true }).eq("recipient_staff_id", staffId).is("read_at", null);
  return count ?? 0;
}

export async function markScheduleNotificationRead(staffId: string, id: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("schedule_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("recipient_staff_id", staffId);
}
