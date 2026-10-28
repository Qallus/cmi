// Pass a contact to teammates: their card (name, company, type, phone, email)
// and a link that opens them in Contacts, by direct message, email or SMS.
// Same recipients and dialog as sharing a deal (app/dashboard/pipeline/deal-actions.tsx).
// Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { publicAppUrl } from "@/lib/twilio";
import { isSuppressed } from "@/lib/messaging/consent";
import { findOrCreateConversation, sendMessage } from "@/lib/direct-messages/data";
import { sendEmail, sendSms, staffPhone, shareEmailHtml } from "@/lib/messaging/send";
import { listShareRecipients, type ShareChannel } from "@/lib/deals/notify";

export class ContactShareError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function shareContact(
  id: string,
  input: { channel: ShareChannel; recipient_ids: string[]; note?: string | null },
  actor: { id: string; name: string | null },
) {
  if (!["email", "sms", "dm"].includes(input.channel)) throw new ContactShareError("Choose Email, SMS or Message.");
  const ids = [...new Set(input.recipient_ids ?? [])].filter((r) => r !== actor.id || input.channel !== "dm");
  if (!ids.length) throw new ContactShareError("Choose at least one teammate.");
  const allowed = new Map((await listShareRecipients()).map((r) => [r.id, r]));
  if (ids.some((r) => !allowed.has(r))) throw new ContactShareError("Contacts can only be shared with CMI staff.", 403);

  const { data: c } = await getSupabaseAdmin().from("contacts").select("first_name, last_name, company, type, phone, email").eq("id", id).maybeSingle();
  if (!c) throw new ContactShareError("Contact not found.", 404);

  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Contact";
  const url = `${publicAppUrl()}/dashboard/contacts?open=${id}`;
  const note = input.note?.trim().slice(0, 1000) || null;
  const lines = [name, [c.company, c.type].filter(Boolean).join(" · ") || null, c.phone, c.email].filter(Boolean) as string[];
  const from = actor.name ?? "A CMI teammate";
  const sent: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const rid of ids) {
    const r = allowed.get(rid)!;
    try {
      if (input.channel === "email") {
        if (!r.email) { skipped.push({ name: r.name, reason: "no email" }); continue; }
        const ok = await sendEmail(r.email, `Contact: ${name}`, shareEmailHtml({
          intro: `${from} shared a contact with you.`, lines, note, url, cta: "Open contact", footer: "Internal — CMI staff only.",
        }));
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "email failed" });
      } else if (input.channel === "sms") {
        const phone = await staffPhone(rid);
        if (!phone) { skipped.push({ name: r.name, reason: "no phone" }); continue; }
        if (await isSuppressed("sms", phone)) { skipped.push({ name: r.name, reason: "opted out of SMS" }); continue; }
        const ok = await sendSms(phone, [`CMI contact from ${from}:`, ...lines, note ? `Note: ${note}` : null, url].filter(Boolean).join("\n"));
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "SMS failed" });
      } else {
        const conversationId = await findOrCreateConversation({ id: actor.id, kind: "staff" }, { id: rid, kind: "staff" });
        await sendMessage(actor.id, conversationId, { body: [`Contact: ${lines.join("\n")}`, note, url].filter(Boolean).join("\n\n") });
        sent.push(r.name);
      }
    } catch (e) {
      skipped.push({ name: r.name, reason: (e as Error).message || "failed" });
    }
  }
  return { sent, skipped };
}
