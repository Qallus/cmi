// Sending the morning briefing.
//
// Who receives the 6 AM send is set by Super Admins on Dashboard →
// Notifications → Morning Briefing (the briefing_settings row): on/off, all
// staff or a chosen list, AI summary or plain. The BRIEFING_AUDIENCE env var,
// when set, still overrides that for emergencies without a database change:
//
//   BRIEFING_AUDIENCE unset            → use the dashboard settings
//   BRIEFING_AUDIENCE=all              → every staff member
//   BRIEFING_AUDIENCE=a@x.com,b@x.com  → just those staff members
//   BRIEFING_AUDIENCE=none             → nobody (manual and test sends still work)
//
// Every send is logged to automation_events (kind morning_briefing), which is
// both the history the dashboard shows and the once-a-day guard. Anyone who has
// turned email notifications off in their profile is skipped.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/messaging/send";
import { briefingEmailHtml, briefingEmailSubject } from "@/lib/email/briefing-email";
import { buildBriefing, loadBriefingStaff, BRIEFING_TZ, type BriefingStaff } from "./build";
import { briefingSummary } from "./summary";
import { loadBriefingSettings } from "./settings";

export type BriefingTrigger = "scheduled" | "manual" | "test";

export type BriefingRunResult = {
  audience: string;
  sent: string[];
  skipped: { email: string; reason: string }[];
  failed: { email: string; error: string }[];
};

export type BriefingRunOptions = {
  trigger?: BriefingTrigger;
  /** test: one staff member by email, ignoring audience and the daily limit. */
  testTo?: string | null;
  /** manual: who to send to. "all" = every staff member. */
  recipientIds?: string[] | "all";
  /** manual: send even if they already had today's. */
  force?: boolean;
  /** Overrides the saved AI-summary setting for this run. */
  includeAi?: boolean;
  /** Build everything, send nothing. */
  dryRun?: boolean;
  /** Who pressed the button, for the history. */
  actor?: { id: string; name: string } | null;
};

function envAudience(): "all" | "none" | string[] | null {
  const raw = (process.env.BRIEFING_AUDIENCE ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "all" || raw === "none") return raw;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function runBriefings(opts: BriefingRunOptions = {}): Promise<BriefingRunResult> {
  const trigger: BriefingTrigger = opts.testTo ? "test" : opts.trigger ?? "scheduled";
  const result: BriefingRunResult = { audience: "", sent: [], skipped: [], failed: [] };
  const [staff, settings] = await Promise.all([loadBriefingStaff(), loadBriefingSettings()]);

  let recipients: BriefingStaff[] = [];
  if (trigger === "test") {
    const test = (opts.testTo ?? "").trim().toLowerCase();
    recipients = staff.filter((s) => s.email.toLowerCase() === test);
    result.audience = `test: ${test}`;
    if (!recipients.length) result.skipped.push({ email: test, reason: "not a staff member" });
  } else if (trigger === "manual") {
    const ids = opts.recipientIds ?? [];
    recipients = ids === "all" ? staff : staff.filter((s) => ids.includes(s.id));
    result.audience = ids === "all" ? "all staff (manual)" : `${recipients.length} selected (manual)`;
  } else {
    const env = envAudience();
    if (env === "none") {
      result.audience = "nobody (BRIEFING_AUDIENCE=none)";
    } else if (env) {
      recipients = env === "all" ? staff : staff.filter((s) => env.includes(s.email.toLowerCase()));
      result.audience = env === "all" ? "all staff (env)" : `${env.join(", ")} (env)`;
    } else if (!settings.auto_enabled) {
      result.audience = "nobody (automatic send is paused)";
    } else {
      recipients = settings.audience === "all" ? staff : staff.filter((s) => settings.recipient_ids.includes(s.id));
      result.audience = settings.audience === "all" ? "all staff" : `${recipients.length} selected`;
    }
  }
  if (!recipients.length) return result;

  const optedOut = trigger === "test" ? new Set<string>() : await emailOptOuts(recipients.map((r) => r.id));
  const useAi = opts.includeAi ?? settings.include_ai;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: BRIEFING_TZ });
  // Scheduled sends, and manual ones that don't force, share the day's slot, so
  // a manual 5 AM send isn't followed by a second copy at 6.
  const oncePerDay = trigger === "scheduled" || (trigger === "manual" && !opts.force);
  const supabase = getSupabaseAdmin();

  for (const person of recipients) {
    if (optedOut.has(person.id)) { result.skipped.push({ email: person.email, reason: "email notifications off" }); continue; }
    try {
      const briefing = await buildBriefing(person);
      const summary = await briefingSummary(briefing, { useAi });
      const subject = briefingEmailSubject(briefing);
      if (opts.dryRun) { result.skipped.push({ email: person.email, reason: "dry run" }); continue; }

      // Claim the slot before sending, so two overlapping runs can't both send.
      const { data, error } = await supabase.from("automation_events").insert({
        kind: "morning_briefing",
        dedupe_key: oncePerDay ? `briefing:${person.id}:${today}` : `briefing:${person.id}:${today}:${trigger}:${Date.now()}`,
        subject_type: "staff_user",
        subject_id: person.id,
        channel: "email",
        recipient: person.email,
        payload: { subject, trigger, summary_from_ai: summary.fromAi, sent_by: opts.actor?.name ?? null, sent_by_id: opts.actor?.id ?? null },
        status: "pending",
      }).select("id").single();
      if (error) {
        if (error.code === "23505") { result.skipped.push({ email: person.email, reason: "already sent today" }); continue; }
        throw new Error(error.message);
      }
      const eventId = (data as { id: string }).id;

      const ok = await sendEmail(person.email, subject, briefingEmailHtml(briefing, summary.text));
      await supabase.from("automation_events")
        .update(ok ? { status: "sent", sent_at: new Date().toISOString() } : { status: "failed", error: "email provider rejected or not configured" })
        .eq("id", eventId);
      if (ok) result.sent.push(person.email);
      else result.failed.push({ email: person.email, error: "email provider rejected or not configured" });
    } catch (err) {
      result.failed.push({ email: person.email, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

export async function emailOptOuts(ids: string[]): Promise<Set<string>> {
  const { data } = await getSupabaseAdmin()
    .from("notification_prefs").select("user_id, email_enabled")
    .eq("user_kind", "staff").in("user_id", ids);
  return new Set(((data ?? []) as { user_id: string; email_enabled: boolean }[]).filter((p) => p.email_enabled === false).map((p) => p.user_id));
}

export type BriefingHistoryRow = {
  id: string; recipient: string; status: string; created_at: string; sent_at: string | null;
  error: string | null; subject: string | null; trigger: string | null; sent_by: string | null; summary_from_ai: boolean | null;
};

export async function loadBriefingHistory(limit = 60): Promise<BriefingHistoryRow[]> {
  const { data } = await getSupabaseAdmin()
    .from("automation_events")
    .select("id, recipient, status, created_at, sent_at, error, payload")
    .eq("kind", "morning_briefing")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { id: string; recipient: string; status: string; created_at: string; sent_at: string | null; error: string | null; payload: Record<string, unknown> | null }[])
    .map((r) => ({
      id: r.id, recipient: r.recipient, status: r.status, created_at: r.created_at, sent_at: r.sent_at, error: r.error,
      subject: (r.payload?.subject as string) ?? null,
      trigger: (r.payload?.trigger as string) ?? "scheduled",
      sent_by: (r.payload?.sent_by as string) ?? null,
      summary_from_ai: (r.payload?.summary_from_ai as boolean) ?? null,
    }));
}
