// Sending the morning briefing.
//
// Who receives it is controlled by one env var, so widening it from a test
// inbox to the whole team is a config change, not a deploy:
//
//   BRIEFING_AUDIENCE unset or "all"   → every active staff member
//   BRIEFING_AUDIENCE=a@x.com,b@x.com  → just those staff members
//   BRIEFING_AUDIENCE=none             → nobody (pauses it; test sends still work)
//
// Each person gets at most one per day (an automation_events dedupe key), and
// anyone who has turned email notifications off in their profile is skipped.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/messaging/send";
import { briefingEmailHtml, briefingEmailSubject } from "@/lib/email/briefing-email";
import { buildBriefing, loadBriefingStaff, BRIEFING_TZ, type BriefingStaff } from "./build";
import { briefingSummary } from "./summary";

export type BriefingRunResult = {
  audience: string;
  sent: string[];
  skipped: { email: string; reason: string }[];
  failed: { email: string; error: string }[];
};

function audience(): "all" | string[] {
  const raw = (process.env.BRIEFING_AUDIENCE ?? "").trim();
  if (!raw || raw.toLowerCase() === "all") return "all";
  if (raw.toLowerCase() === "none") return [];
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Send today's briefings.
 *
 * `testTo` sends one briefing to one staff member right now, regardless of the
 * audience setting or whether they already had today's — it's how a layout is
 * reviewed before anyone else sees it. `dryRun` builds everything and sends
 * nothing.
 */
export async function runBriefings(opts: { testTo?: string | null; dryRun?: boolean } = {}): Promise<BriefingRunResult> {
  const result: BriefingRunResult = { audience: "", sent: [], skipped: [], failed: [] };
  const staff = await loadBriefingStaff();
  const test = opts.testTo?.trim().toLowerCase() || null;

  let recipients: BriefingStaff[];
  if (test) {
    recipients = staff.filter((s) => s.email.toLowerCase() === test);
    result.audience = `test: ${test}`;
    if (!recipients.length) result.skipped.push({ email: test, reason: "not an active staff member" });
  } else {
    const a = audience();
    result.audience = a === "all" ? "all staff" : a.length ? a.join(", ") : "nobody (BRIEFING_AUDIENCE=none)";
    recipients = a === "all" ? staff : staff.filter((s) => a.includes(s.email.toLowerCase()));
  }
  if (!recipients.length) return result;

  const optedOut = test ? new Set<string>() : await emailOptOuts(recipients.map((r) => r.id));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: BRIEFING_TZ });
  const supabase = getSupabaseAdmin();

  for (const person of recipients) {
    if (optedOut.has(person.id)) { result.skipped.push({ email: person.email, reason: "email notifications off" }); continue; }
    try {
      const briefing = await buildBriefing(person);
      const summary = await briefingSummary(briefing);
      const subject = briefingEmailSubject(briefing);
      if (opts.dryRun) { result.skipped.push({ email: person.email, reason: "dry run" }); continue; }

      // Claim today's slot first, so two overlapping runs can't both send.
      let eventId: string | null = null;
      if (!test) {
        const { data, error } = await supabase.from("automation_events").insert({
          kind: "morning_briefing",
          dedupe_key: `briefing:${person.id}:${today}`,
          subject_type: "staff_user",
          subject_id: person.id,
          channel: "email",
          recipient: person.email,
          payload: { subject, summary_from_ai: summary.fromAi },
          status: "pending",
        }).select("id").single();
        if (error) {
          if (error.code === "23505") { result.skipped.push({ email: person.email, reason: "already sent today" }); continue; }
          throw new Error(error.message);
        }
        eventId = (data as { id: string }).id;
      }

      const ok = await sendEmail(person.email, subject, briefingEmailHtml(briefing, summary.text));
      if (eventId) {
        await supabase.from("automation_events")
          .update(ok ? { status: "sent", sent_at: new Date().toISOString() } : { status: "failed", error: "send returned false" })
          .eq("id", eventId);
      }
      if (ok) result.sent.push(person.email);
      else result.failed.push({ email: person.email, error: "email provider rejected or not configured" });
    } catch (err) {
      result.failed.push({ email: person.email, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}

async function emailOptOuts(ids: string[]): Promise<Set<string>> {
  const { data } = await getSupabaseAdmin()
    .from("notification_prefs").select("user_id, email_enabled")
    .eq("user_kind", "staff").in("user_id", ids);
  return new Set(((data ?? []) as { user_id: string; email_enabled: boolean }[]).filter((p) => p.email_enabled === false).map((p) => p.user_id));
}
