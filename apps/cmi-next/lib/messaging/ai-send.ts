// Email and text messages an AI client (Claude via MCP) sends on someone's
// behalf. Every send passes, in order:
//   1. the recipient is a known person (a contact or staff member) who is
//      allowed to receive AI messages (Settings → Claude: AI emails / AI texts)
//   2. they haven't opted out (lib/messaging/consent isSuppressed)
//   3. it's production (local dev runs against the live database), unless
//      NOTIFY_FORCE_SEND=true
// Email goes from info@ with Reply-To set to the person who asked, so replies
// reach them; once the Google key exists this moves to their own Gmail.
// Every send is logged to Communications (messages). Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { hasAiCapability } from "@/lib/ai-access/check";
import { isSuppressed, normalizeAddress, looksValid, type Channel } from "@/lib/messaging/consent";
import { sendSms } from "@/lib/messaging/send";
import { logMessage } from "@/lib/communications/data";
import { fromAddress } from "@/lib/email/from";

export class AiSendError extends Error {}

export type Recipient = {
  kind: "contact" | "staff";
  id: string;
  name: string;
  firstName: string | null;
  address: string;
  contactId: string | null;
};

const CAPABILITY: Record<Channel, "ai_email" | "ai_sms"> = { email: "ai_email", sms: "ai_sms" };
const CHANNEL_NAME: Record<Channel, string> = { email: "AI emails", sms: "AI text messages" };

/** Sending is held outside production so testing never reaches a real person. */
export function aiSendLive(): boolean {
  return process.env.NOTIFY_FORCE_SEND === "true" || process.env.NODE_ENV === "production";
}

/**
 * Who this message would reach, and whether it may. Accepts a contact id, or
 * an email address / phone number that belongs to a contact or staff member.
 * Throws AiSendError with the reason when it may not be sent.
 */
export async function resolveRecipient(channel: Channel, input: { contactId?: string | null; address?: string | null }): Promise<Recipient> {
  const supabase = getSupabaseAdmin();
  let r: Recipient | null = null;

  if (input.contactId) {
    const { data: c } = await supabase.from("contacts").select("id, first_name, last_name, email, phone, status").eq("id", input.contactId).maybeSingle();
    if (!c) throw new AiSendError("No contact with that id.");
    const address = channel === "email" ? c.email : c.phone;
    if (!address) throw new AiSendError(`${[c.first_name, c.last_name].filter(Boolean).join(" ")} has no ${channel === "email" ? "email address" : "phone number"} on file.`);
    r = { kind: "contact", id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" "), firstName: c.first_name, address, contactId: c.id };
  } else if (input.address) {
    if (!looksValid(channel, input.address)) throw new AiSendError(`"${input.address}" isn't a valid ${channel === "email" ? "email address" : "phone number"}.`);
    const norm = normalizeAddress(channel, input.address);
    if (channel === "email") {
      const { data: s } = await supabase.from("staff_users").select("id, display_name, first_name, last_name, email, role_slug").ilike("email", norm).in("status", ["active", "invited"]).maybeSingle();
      if (s) r = { kind: "staff", id: s.id, name: s.display_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || norm, firstName: s.first_name, address: norm, contactId: null };
      if (!r) {
        const { data: c } = await supabase.from("contacts").select("id, first_name, last_name, email").ilike("email", norm).limit(1).maybeSingle();
        if (c) r = { kind: "contact", id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" "), firstName: c.first_name, address: norm, contactId: c.id };
      }
    } else {
      // Staff first (same as email), then contacts. Phones are stored in many
      // formats, so narrow by the last four digits and compare normalized.
      const last10 = norm.slice(-10);
      const same = (p: unknown) => typeof p === "string" && normalizeAddress("sms", p).endsWith(last10);
      const { data: ss } = await supabase.from("staff_users").select("id, display_name, first_name, last_name, email, phone")
        .in("status", ["active", "invited"]).not("phone", "is", null).ilike("phone", `%${last10.slice(-4)}%`).limit(20);
      const s = (ss ?? []).find((x) => same(x.phone));
      if (s) r = { kind: "staff", id: s.id, name: s.display_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || (s.email as string), firstName: s.first_name, address: s.phone as string, contactId: null };
      if (!r) {
        const { data: cs } = await supabase.from("contacts").select("id, first_name, last_name, phone").not("phone", "is", null).ilike("phone", `%${last10.slice(-4)}%`).limit(50);
        const c = (cs ?? []).find((x) => same(x.phone));
        if (c) r = { kind: "contact", id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" "), firstName: c.first_name, address: c.phone as string, contactId: c.id };
      }
    }
  }
  if (!r) throw new AiSendError("AI messages only go to people in CMI. Add them as a contact, then allow AI messages for them in Settings → Claude.");

  // Allowlist: may this person receive AI-sent messages on this channel?
  const subject = r.kind === "contact"
    ? { type: "contact" as const, contactId: r.id }
    : { type: "staff" as const, staffUserId: r.id, role: (await supabase.from("staff_users").select("role_slug").eq("id", r.id).maybeSingle()).data?.role_slug as string };
  if (!(await hasAiCapability(subject, CAPABILITY[channel]))) {
    throw new AiSendError(`${r.name} isn't set up to receive ${CHANNEL_NAME[channel]}. A Super Admin can allow it in Settings → Claude.`);
  }
  // Consent: an opt-out always wins.
  if (await isSuppressed(channel, r.address)) {
    throw new AiSendError(`${r.name} has opted out of ${channel === "email" ? "email" : "text messages"}. Nothing will be sent.`);
  }
  return r;
}

/** Their company mailbox when they have one; otherwise info@. */
export function replyToFor(senderEmail: string | null | undefined): string {
  const domain = (process.env.GOOGLE_WORKSPACE_DOMAIN || "constructedmatter.com").toLowerCase();
  return senderEmail && senderEmail.toLowerCase().endsWith(`@${domain}`) ? senderEmail : "info@constructedmatter.com";
}

type SendResult = { sent: boolean; held: boolean; messageId: string | null; error?: string };

export async function sendAiEmail(input: {
  to: Recipient; subject: string; html: string; text: string; sender: { id: string; email: string; name: string };
}): Promise<SendResult> {
  const replyTo = replyToFor(input.sender.email);
  let sent = false, held = false, error: string | undefined;
  let providerId: string | null = null;
  if (!aiSendLive()) {
    held = true;
    console.info(`[ai-send] email held outside production → ${input.to.address}: ${input.subject}`);
  } else {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new AiSendError("Email isn't configured (RESEND_API_KEY).");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromAddress(), to: [input.to.address], reply_to: replyTo, subject: input.subject, html: input.html, text: input.text }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    sent = res.ok;
    providerId = body.id ?? null;
    if (!res.ok) error = body.message ?? `Resend HTTP ${res.status}`;
  }
  const messageId = await log({
    channel: "email", contactId: input.to.contactId, to: input.to.address, from: replyTo, subject: input.subject,
    body: input.text, sent, held, error, providerId, provider: "resend",
  });
  if (error) throw new AiSendError(`Email failed: ${error}`);
  return { sent, held, messageId };
}

export async function sendAiSms(input: { to: Recipient; body: string; sender: { id: string } }): Promise<SendResult> {
  let sent = false, held = false, error: string | undefined;
  if (!aiSendLive()) {
    held = true;
    console.info(`[ai-send] sms held outside production → ${input.to.address}`);
  } else {
    sent = await sendSms(normalizeAddress("sms", input.to.address).replace(/^(\d)/, "+$1"), input.body);
    if (!sent) error = "Twilio didn't accept the message (check TWILIO_* settings).";
  }
  const messageId = await log({
    channel: "sms", contactId: input.to.contactId, to: input.to.address, from: process.env.TWILIO_PHONE_NUMBER ?? "CMI",
    subject: null, body: input.body, sent, held, error, providerId: null, provider: "twilio",
  });
  if (error) throw new AiSendError(error);
  return { sent, held, messageId };
}

async function log(m: {
  channel: "email" | "sms"; contactId: string | null; to: string; from: string; subject: string | null; body: string;
  sent: boolean; held: boolean; error?: string; providerId: string | null; provider: string;
}): Promise<string | null> {
  try {
    const row = await logMessage({
      direction: "outbound", channel: m.channel, contact_id: m.contactId, to_address: m.to, from_address: m.from,
      subject: m.subject, body: m.body, status: m.sent ? "sent" : m.held ? "queued" : "failed", project_id: null, quote_id: null,
      provider: m.provider, provider_id: m.providerId, error_message: m.held ? "Held: not production" : m.error ?? null,
      duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
    });
    return row.id;
  } catch (err) {
    console.error("[ai-send] logging failed", err);
    return null;
  }
}
