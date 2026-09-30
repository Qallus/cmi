// One way to notify a staff member.
//
// Before this, the bell re-derived notifications by scanning business tables
// and nothing could actively tell anyone anything. Every new notification goes
// through `notifyStaff`: it writes a per-recipient row, pushes if they have a
// subscription, and emails if it matters enough — in that order, so the in-app
// record exists even when the outbound channels are down.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendPushToStaff } from "@/lib/push/web-push";
import { sendEmail } from "@/lib/messaging/send";
import { notificationEmailHtml, type NotificationEmail } from "@/lib/email/notification-email";
import { publicAppUrl } from "@/lib/twilio";

export type NotifyInput = {
  /** Who to tell. The actor is filtered out — nobody is told about their own action. */
  recipientIds: (string | null | undefined)[];
  /** Whoever caused this, so they are not notified about themselves. */
  actorId?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  /** Relative path, e.g. /dashboard/pipeline/<id>. Made absolute for email. */
  url?: string | null;
  sourceTable?: string;
  sourceId?: string | null;
  /** Same key twice for the same person notifies once. */
  dedupeKey?: string | null;
  /** Send an email as well as the bell and push. */
  email?: {
    subject: string;
    /** Everything except the CTA, which is built from `url`. */
    content: Omit<NotificationEmail, "cta">;
    ctaLabel?: string;
  } | null;
};

type Prefs = { email_enabled: boolean; push_enabled: boolean };

/**
 * Whether this process is allowed to reach real people.
 *
 * Local development runs against the live database with live Resend and VAPID
 * keys, so without this a developer reassigning a deal to test the feature
 * would email and push the actual owner. The in-app row is still written, so
 * the whole path stays testable locally; only the outbound leg is held back.
 * Set NOTIFY_FORCE_SEND=true to deliberately send a real one.
 */
function canSendOutbound(): boolean {
  if (process.env.NOTIFY_FORCE_SEND === "true") return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Tell people something happened.
 *
 * Never throws: a notification failing must not take down the action that
 * caused it. Returns what actually went out, so callers can log it if they
 * care — and so this is testable.
 */
export async function notifyStaff(input: NotifyInput): Promise<{
  notified: string[]; pushed: number; emailed: number; errors: string[];
}> {
  const errors: string[] = [];
  const recipients = [...new Set(
    input.recipientIds.filter((id): id is string => !!id && id !== input.actorId),
  )];
  if (recipients.length === 0) return { notified: [], pushed: 0, emailed: 0, errors };

  const supabase = getSupabaseAdmin();

  // 1. The in-app record. This is the one that must not be skipped.
  let stored: string[] = [];
  try {
    const rows = recipients.map((id) => ({
      recipient_staff_id: id,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      source_table: input.sourceTable ?? null,
      source_id: input.sourceId ?? null,
      // Scoped per person so two people can be told about the same thing.
      dedupe_key: input.dedupeKey ?? null,
    }));
    const { data, error } = await supabase
      .from("staff_notifications")
      .upsert(rows, { onConflict: "recipient_staff_id,dedupe_key", ignoreDuplicates: true })
      .select("recipient_staff_id");
    if (error) throw new Error(error.message);
    stored = ((data ?? []) as { recipient_staff_id: string }[]).map((r) => r.recipient_staff_id);
  } catch (err) {
    errors.push(`row: ${(err as Error).message}`);
    // Still try to reach them — a lost bell row is no reason to stay silent.
    stored = recipients;
  }

  // A repeat of something already sent should not push or email again.
  if (stored.length === 0) return { notified: [], pushed: 0, emailed: 0, errors };

  if (!canSendOutbound()) {
    return { notified: stored, pushed: 0, emailed: 0, errors: [...errors, "outbound held: not production"] };
  }

  const prefs = await loadPrefs(stored);
  const wantsPush = stored.filter((id) => prefs.get(id)?.push_enabled !== false);
  const wantsEmail = stored.filter((id) => prefs.get(id)?.email_enabled !== false);

  // 2. Push.
  let pushed = 0;
  if (wantsPush.length > 0) {
    try {
      await sendPushToStaff(wantsPush, {
        title: input.title,
        body: input.body ?? "",
        url: input.url ?? "/dashboard",
      });
      pushed = wantsPush.length;
    } catch (err) {
      errors.push(`push: ${(err as Error).message}`);
    }
  }

  // 3. Email.
  let emailed = 0;
  if (input.email && wantsEmail.length > 0) {
    const addresses = await loadEmails(wantsEmail);
    const absolute = input.url ? `${publicAppUrl()}${input.url}` : null;
    const html = notificationEmailHtml({
      ...input.email.content,
      cta: absolute ? { label: input.email.ctaLabel ?? "Open in the dashboard", url: absolute } : null,
    });
    for (const address of addresses) {
      try {
        if (await sendEmail(address, input.email.subject, html)) emailed += 1;
      } catch (err) {
        errors.push(`email ${address}: ${(err as Error).message}`);
      }
    }
  }

  if (emailed > 0 || pushed > 0) {
    const now = new Date().toISOString();
    await supabase.from("staff_notifications")
      .update({ pushed_at: pushed ? now : null, emailed_at: emailed ? now : null })
      .in("recipient_staff_id", stored)
      .eq("kind", input.kind)
      .is("read_at", null)
      .gte("created_at", new Date(Date.now() - 60_000).toISOString())
      .then(undefined, () => { /* stamping is bookkeeping, not delivery */ });
  }

  return { notified: stored, pushed, emailed, errors };
}

/** Absent row means everything on, matching how broadcasts already behave. */
async function loadPrefs(ids: string[]): Promise<Map<string, Prefs>> {
  const out = new Map<string, Prefs>();
  try {
    const { data } = await getSupabaseAdmin()
      .from("notification_prefs")
      .select("user_id, email_enabled, push_enabled")
      .eq("user_kind", "staff")
      .in("user_id", ids);
    for (const row of (data ?? []) as (Prefs & { user_id: string })[]) {
      out.set(row.user_id, { email_enabled: row.email_enabled, push_enabled: row.push_enabled });
    }
  } catch { /* no prefs means no opt-outs */ }
  return out;
}

/** Only active accounts: emailing someone who never accepted an invite is noise. */
async function loadEmails(ids: string[]): Promise<string[]> {
  const { data } = await getSupabaseAdmin()
    .from("staff_users")
    .select("email, status")
    .in("id", ids)
    .in("status", ["active", "invited"]);
  return ((data ?? []) as { email: string | null }[])
    .map((r) => r.email)
    .filter((e): e is string => !!e);
}
