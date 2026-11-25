// Send invitations by email or text, each with the guest's personal RSVP link.
//
// Goes through lib/messaging/send.ts, so outside production nothing leaves the
// building (canSendOutbound / NOTIFY_FORCE_SEND); those are reported as held.
// Contacts and open-link guests are checked against marketing opt-outs; staff
// invitations are internal and aren't.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail, sendSms } from "@/lib/messaging/send";
import { isMarketingSuppressed } from "@/lib/messaging/consent";
import { canSendOutbound } from "@/lib/notifications/outbound";
import { logMessage } from "@/lib/communications/data";
import { fromAddress } from "@/lib/email/from";
import { normalizePhone, publicAppUrl } from "@/lib/twilio";
import { EventError, eventUrl, getInvitationEvent } from "./data";
import { invitationEmailHtml, invitationSms, invitationSubject } from "./invite-email";
import type { EventRsvp, InvitationEvent } from "./types";

export type SendChannel = "email" | "sms";
/** unsent: guests never sent an invite. waiting: everyone who hasn't answered (a reminder). */
export type SendScope = "unsent" | "waiting" | "selected";

export type SendPlan = {
  event: { id: string; title: string; live: boolean; url: string };
  channel: SendChannel;
  recipients: { id: string; name: string; to: string }[];
  skipped: { name: string; reason: string }[];
  held: boolean;
};

function e164(raw: string | null): string | null {
  const p = normalizePhone(raw);
  if (!p) return null;
  return p.startsWith("+") ? p : p.length === 10 ? `+1${p}` : `+${p}`;
}

const LIVE = ["published", "private"];

export async function planInvites(eventId: string, channel: SendChannel, scope: SendScope, rsvpIds: string[] = []): Promise<SendPlan & { _event: InvitationEvent; _rows: EventRsvp[] }> {
  if (channel !== "email" && channel !== "sms") throw new EventError("Channel must be email or sms.");
  const { event, rsvps } = await getInvitationEvent(eventId);
  const chosen = rsvps.filter((r) =>
    scope === "selected" ? rsvpIds.includes(r.id)
      : scope === "waiting" ? r.status === "invited"
      : !r.sent_at && r.status === "invited",
  );
  const recipients: SendPlan["recipients"] = [];
  const skipped: SendPlan["skipped"] = [];
  const rows: EventRsvp[] = [];
  for (const r of chosen) {
    const to = channel === "email" ? (r.email ?? "").trim().toLowerCase() : e164(r.phone);
    if (!to) { skipped.push({ name: r.name, reason: channel === "email" ? "no email" : "no mobile number" }); continue; }
    if (!r.staff_user_id && (await isMarketingSuppressed(channel, to))) { skipped.push({ name: r.name, reason: "opted out" }); continue; }
    recipients.push({ id: r.id, name: r.name, to });
    rows.push(r);
  }
  return {
    event: { id: event.id, title: event.title, live: LIVE.includes(event.status), url: eventUrl(event.slug) },
    channel, recipients, skipped, held: !canSendOutbound(), _event: event, _rows: rows,
  };
}

/** Public shape of a plan (for previews). */
export function publicPlan(p: SendPlan): SendPlan {
  return { event: p.event, channel: p.channel, recipients: p.recipients, skipped: p.skipped, held: p.held };
}

export async function sendInvites(
  eventId: string, channel: SendChannel, scope: SendScope, rsvpIds: string[] = [],
): Promise<{ sent: number; held: number; failed: { name: string; reason: string }[]; skipped: SendPlan["skipped"] }> {
  const plan = await planInvites(eventId, channel, scope, rsvpIds);
  if (!plan.event.live) throw new EventError("Publish the event before sending invitations, so the links work.", 409);
  const event = plan._event;
  const app = publicAppUrl();
  const sb = getSupabaseAdmin();
  const outbound = canSendOutbound();
  let sent = 0, held = 0;
  const failed: { name: string; reason: string }[] = [];

  for (const r of plan._rows) {
    const to = plan.recipients.find((x) => x.id === r.id)!.to;
    const rsvpUrl = eventUrl(event.slug, r.token);
    let ok = false;
    let subject: string | null = null;
    let body: string;
    try {
      if (channel === "email") {
        subject = invitationSubject(event);
        body = invitationEmailHtml(event, { guestName: r.name, rsvpUrl, calendarUrl: `${app}/api/rsvp/${event.slug}/ics?i=${r.token}`, appUrl: app });
        ok = await sendEmail(to, subject, body);
      } else {
        body = invitationSms(event, rsvpUrl, r.name, !r.staff_user_id);
        ok = await sendSms(to, body);
      }
    } catch (err) {
      body = "";
      failed.push({ name: r.name, reason: (err as Error).message });
      continue;
    }

    if (ok) {
      sent++;
      await sb.from("event_rsvps").update({ sent_at: new Date().toISOString(), sent_channel: channel }).eq("id", r.id);
    } else if (!outbound) {
      held++;
    } else {
      failed.push({ name: r.name, reason: `${channel === "email" ? "Email" : "Text"} provider refused or isn't configured` });
    }

    // Held sends (local testing) stay out of the shared Communications log.
    if (!outbound) continue;
    try {
      await logMessage({
        direction: "outbound",
        channel,
        contact_id: r.contact_id,
        to_address: to,
        from_address: channel === "email" ? fromAddress() : process.env.TWILIO_PHONE_NUMBER ?? null,
        subject,
        body: channel === "email" ? `Invitation to ${event.title}: ${rsvpUrl}` : body,
        status: ok ? "sent" : "failed",
        project_id: null,
        quote_id: null,
        provider: channel === "email" ? "resend" : "twilio",
        provider_id: null,
        error_message: ok ? null : "send failed",
        duration_seconds: null,
        recording_url: null,
        sent_at: new Date().toISOString(),
      });
    } catch { /* the send already happened; a lost log row isn't worth failing it */ }
  }
  return { sent, held, failed, skipped: plan.skipped };
}

/** One copy to the staff member themself, to check how it looks. */
export async function sendTestInvite(eventId: string, toEmail: string, name: string | null): Promise<{ ok: boolean; held: boolean }> {
  const { event } = await getInvitationEvent(eventId);
  const app = publicAppUrl();
  const html = invitationEmailHtml(event, { guestName: name, rsvpUrl: eventUrl(event.slug), calendarUrl: `${app}/api/rsvp/${event.slug}/ics`, appUrl: app });
  const ok = await sendEmail(toEmail, `[Test] ${invitationSubject(event)}`, html);
  return { ok, held: !canSendOutbound() };
}
