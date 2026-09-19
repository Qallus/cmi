// Share a projection with other Admins by Email, SMS or staff DM. Revenue is
// financial data: recipients are restricted to active Super Admin / Admin
// staff, and the message carries a summary plus a link that only those roles
// can open. Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { normalizePhone, publicAppUrl } from "@/lib/twilio";
import { isSuppressed } from "@/lib/messaging/consent";
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
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

async function staffPhone(id: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin().from("staff_users").select("phone").eq("id", id).maybeSingle();
  const p = normalizePhone(data?.phone);
  if (!p) return null;
  return p.startsWith("+") ? p : p.length === 10 ? `+1${p}` : `+${p}`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "info@constructedmatter.com";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`, to: [to], subject, html }),
  });
  return res.ok;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  return res.ok;
}

function emailHtml({ from, lines, note, url }: { from: string; lines: string[]; note: string | null; url: string }) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A1A">
  <div style="background:#1A1A1A;color:#fff;padding:16px 20px;font-weight:bold;letter-spacing:2px">CONSTRUCTED MATTER</div>
  <div style="padding:20px;border:1px solid #E5E7EB;border-top:0">
    <p style="margin:0 0 12px;color:#6B7280;font-size:13px">${esc(from)} shared a projection with you.</p>
    <p style="margin:0 0 6px;font-size:16px;font-weight:bold">${esc(lines[0])}</p>
    ${lines.slice(1).map((l) => `<p style="margin:0 0 4px;font-size:14px">${esc(l)}</p>`).join("")}
    ${note ? `<p style="margin:14px 0 0;padding:10px 12px;background:#FBEEE6;border-radius:6px;font-size:14px">${esc(note)}</p>` : ""}
    <p style="margin:20px 0 0"><a href="${url}" style="background:#B7541F;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">View projection</a></p>
    <p style="margin:18px 0 0;color:#6B7280;font-size:11px">Confidential — management forecast. Only Admins can open this link.</p>
  </div>
</div>`;
}
