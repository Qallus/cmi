// Share a pipeline deal with other staff by Email, SMS or DM. Deals carry
// client contact details and budget, so recipients are limited to the same
// roles that can open the Pipeline, and the link only works for them.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizePhone, publicAppUrl } from "@/lib/twilio";
import { isSuppressed } from "@/lib/messaging/consent";
import { findOrCreateConversation, sendMessage } from "@/lib/direct-messages/data";
import { sendEmail, sendSms, staffPhone, shareEmailHtml } from "@/lib/messaging/send";
import { DEAL_WRITE_ROLES } from "./roles";
import { DEAL_STAGE_META } from "./stages";
import { getDeal, logActivity } from "./data";

/** Share needs a known actor — the session always has one. */
type Actor = { id: string; name: string | null };

export type ShareChannel = "email" | "sms" | "dm";
export type ShareRecipient = { id: string; name: string; email: string | null; has_phone: boolean; role: string };

export class DealShareError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function listShareRecipients(): Promise<ShareRecipient[]> {
  const { data } = await getSupabaseAdmin()
    .from("staff_users")
    .select("id,display_name,email,phone,role_slug")
    .in("role_slug", [...DEAL_WRITE_ROLES])
    .eq("status", "active")
    .order("display_name");
  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.display_name || s.email || "Staff",
    email: s.email ?? null,
    has_phone: !!normalizePhone(s.phone),
    role: s.role_slug,
  }));
}

const usd = (v: number | null | undefined) =>
  v == null ? null : `$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

export async function shareDeal(
  id: string,
  input: { channel: ShareChannel; recipient_ids: string[]; note?: string | null },
  actor: Actor,
) {
  if (!["email", "sms", "dm"].includes(input.channel)) throw new DealShareError("Choose Email, SMS or Message.");
  // Messaging yourself is a no-op, so drop it from a DM share.
  const ids = [...new Set(input.recipient_ids ?? [])].filter((r) => r !== actor.id || input.channel !== "dm");
  if (!ids.length) throw new DealShareError("Choose at least one recipient.");

  const allowed = new Map((await listShareRecipients()).map((r) => [r.id, r]));
  if (ids.some((r) => !allowed.has(r))) throw new DealShareError("Deals can only be shared with Pipeline staff.", 403);

  const deal = await getDeal(id);
  if (!deal) throw new DealShareError("Deal not found.", 404);

  const url = `${publicAppUrl()}/dashboard/pipeline/${id}`;
  const note = input.note?.trim().slice(0, 1000) || null;
  const value = usd(deal.estimated_value);
  const lines = [
    [deal.job_number, deal.title].filter(Boolean).join("_"),
    [DEAL_STAGE_META[deal.stage]?.label ?? deal.stage, value, deal.probability != null ? `${deal.probability}%` : null]
      .filter(Boolean).join(" · "),
    deal.full_address || null,
    deal.next_action ? `Next: ${deal.next_action}${deal.next_action_due ? ` (due ${deal.next_action_due})` : ""}` : null,
  ].filter(Boolean) as string[];
  const from = actor.name ?? "A CMI teammate";

  const sent: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const rid of ids) {
    const r = allowed.get(rid)!;
    try {
      if (input.channel === "email") {
        if (!r.email) { skipped.push({ name: r.name, reason: "no email" }); continue; }
        const ok = await sendEmail(r.email, `Pipeline: ${lines[0]}`, shareEmailHtml({
          intro: `${from} shared a pipeline deal with you.`,
          lines, note, url,
          cta: "View deal",
          footer: "Internal — client and budget details. Only Pipeline staff can open this link.",
        }));
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "email failed" });
      } else if (input.channel === "sms") {
        const phone = await staffPhone(rid);
        if (!phone) { skipped.push({ name: r.name, reason: "no phone" }); continue; }
        if (await isSuppressed("sms", phone)) { skipped.push({ name: r.name, reason: "opted out of SMS" }); continue; }
        const body = [`CMI Pipeline from ${from}:`, ...lines, note ? `Note: ${note}` : null, url].filter(Boolean).join("\n");
        const ok = await sendSms(phone, body);
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "SMS failed" });
      } else {
        const conversationId = await findOrCreateConversation({ id: actor.id, kind: "staff" }, { id: rid, kind: "staff" });
        await sendMessage(actor.id, conversationId, { body: [`Pipeline deal: ${lines.join("\n")}`, note, url].filter(Boolean).join("\n\n") });
        sent.push(r.name);
      }
    } catch (e) {
      skipped.push({ name: r.name, reason: (e as Error).message || "failed" });
    }
  }

  // Shows up on the deal's own timeline, so the team can see it was passed on.
  await logActivity({
    deal_id: id,
    type: "note",
    summary: `Shared by ${input.channel === "dm" ? "message" : input.channel.toUpperCase()}`,
    body: [sent.length ? `Sent to ${sent.join(", ")}.` : "Sent to no one.", note].filter(Boolean).join(" "),
  }, actor);

  return { sent, skipped };
}
