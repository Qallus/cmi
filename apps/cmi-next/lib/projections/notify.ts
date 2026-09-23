// Share a projection with other Admins by Email, SMS or staff DM. Revenue is
// financial data: recipients are restricted to active Super Admin / Admin
// staff, and the message carries a summary plus a link that only those roles
// can open. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizePhone, publicAppUrl } from "@/lib/twilio";
import { isSuppressed } from "@/lib/messaging/consent";
import { sendEmail, sendSms, staffPhone, shareEmailHtml } from "@/lib/messaging/send";
import { findOrCreateConversation, sendMessage } from "@/lib/direct-messages/data";
import { PROJECTION_ROLES } from "./access";
import { loadDetail, logActivity, ProjectionError } from "./data";
import { monthLabel } from "./calc";
import { PROJECTION_STATUS_META } from "./types";

type Actor = { id: string; name: string | null };
export type ShareChannel = "email" | "sms" | "dm";
export type ShareRecipient = { id: string; name: string; email: string | null; has_phone: boolean; role: string };

export async function listShareRecipients(): Promise<ShareRecipient[]> {
  const { data } = await getSupabaseAdmin().from("staff_users")
    .select("id,display_name,email,phone,role_slug").in("role_slug", [...PROJECTION_ROLES]).eq("status", "active").order("display_name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.display_name || s.email || "Staff", email: s.email ?? null, has_phone: !!normalizePhone(s.phone), role: s.role_slug }));
}

const usd = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

export async function shareProjection(id: string, input: { channel: ShareChannel; recipient_ids: string[]; note?: string | null }, actor: Actor) {
  if (!["email", "sms", "dm"].includes(input.channel)) throw new ProjectionError("Choose Email, SMS or Message.");
  const ids = [...new Set(input.recipient_ids ?? [])].filter((r) => r !== actor.id || input.channel !== "dm");
  if (!ids.length) throw new ProjectionError("Choose at least one recipient.");
  const allowed = new Map((await listShareRecipients()).map((r) => [r.id, r]));
  const bad = ids.filter((r) => !allowed.has(r));
  if (bad.length) throw new ProjectionError("Projections can only be shared with Admins.", 403);

  const { row } = await loadDetail(id);
  const url = `${publicAppUrl()}/dashboard/projections/${id}`;
  const note = input.note?.trim().slice(0, 1000) || null;
  const nextMonths = Object.entries(row.months).slice(0, 3).map(([m, c]) => `${monthLabel(m)} ${usd(c.projected)}`).join(", ");
  const lines = [
    `${row.name} — ${PROJECTION_STATUS_META[row.status].label}`,
    `Remaining ${usd(row.remaining)} of ${usd(row.total_revenue)}${row.forecast_start && row.forecast_finish ? ` · ${row.forecast_start} to ${row.forecast_finish}` : ""}`,
    nextMonths ? `Next months: ${nextMonths}` : null,
  ].filter(Boolean) as string[];
  const from = actor.name ?? "A CMI admin";

  const sent: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const rid of ids) {
    const r = allowed.get(rid)!;
    try {
      if (input.channel === "email") {
        if (!r.email) { skipped.push({ name: r.name, reason: "no email" }); continue; }
        const ok = await sendEmail(r.email, `Projection: ${row.name}`, emailHtml({ from, lines, note, url }));
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "email failed" });
      } else if (input.channel === "sms") {
        const phone = await staffPhone(rid);
        if (!phone) { skipped.push({ name: r.name, reason: "no phone" }); continue; }
        if (await isSuppressed("sms", phone)) { skipped.push({ name: r.name, reason: "opted out of SMS" }); continue; }
        const body = [`CMI Projection from ${from}:`, ...lines, note ? `Note: ${note}` : null, url].filter(Boolean).join("\n");
        const ok = await sendSms(phone, body);
        if (ok) sent.push(r.name); else skipped.push({ name: r.name, reason: "SMS failed" });
      } else {
        const conversationId = await findOrCreateConversation({ id: actor.id, kind: "staff" }, { id: rid, kind: "staff" });
        await sendMessage(actor.id, conversationId, { body: [`Projection: ${lines.join("\n")}`, note, url].filter(Boolean).join("\n\n") });
        sent.push(r.name);
      }
    } catch (e) {
      skipped.push({ name: r.name, reason: (e as Error).message || "failed" });
    }
  }
  await logActivity({ projectionId: id, action: "shared", actor, detail: { channel: input.channel, sent, skipped: skipped.length } });
  return { sent, skipped };
}

function emailHtml({ from, lines, note, url }: { from: string; lines: string[]; note: string | null; url: string }) {
  return shareEmailHtml({
    intro: `${from} shared a projection with you.`,
    lines, note, url,
    cta: "View projection",
    footer: "Confidential — management forecast. Only Admins can open this link.",
  });
}
