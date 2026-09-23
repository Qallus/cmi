// Low-level outbound senders, shared by the modules that share a record with
// staff (Projections, Pipeline). They return false rather than throwing when a
// provider isn't configured, so a share can report "skipped" per recipient
// instead of failing the whole request.
//
// These do NOT check consent — callers that message a person rather than an
// internal staff member must call isSuppressed() first.
import { normalizePhone } from "@/lib/twilio";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "info@constructedmatter.com";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`,
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return false;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
  });
  return res.ok;
}

/** A staff member's mobile in E.164, or null when they haven't got one. */
export async function staffPhone(id: string): Promise<string | null> {
  const { getSupabaseAdmin } = await import("@/lib/supabase/server");
  const { data } = await getSupabaseAdmin().from("staff_users").select("phone").eq("id", id).maybeSingle();
  const p = normalizePhone(data?.phone);
  if (!p) return null;
  return p.startsWith("+") ? p : p.length === 10 ? `+1${p}` : `+${p}`;
}

/** Escapes text going into the simple HTML email bodies below. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * The shared CMI email shell for "someone shared a record with you".
 * `lines[0]` is the headline; the rest are detail lines.
 */
export function shareEmailHtml({
  intro, lines, note, url, cta, footer,
}: {
  intro: string;
  lines: string[];
  note: string | null;
  url: string;
  cta: string;
  footer: string;
}): string {
  const esc = escapeHtml;
  return `<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1A1A1A">
  <div style="background:#1A1A1A;color:#fff;padding:16px 20px;font-weight:bold;letter-spacing:2px">CONSTRUCTED MATTER</div>
  <div style="padding:20px;border:1px solid #E5E7EB;border-top:0">
    <p style="margin:0 0 12px;color:#6B7280;font-size:13px">${esc(intro)}</p>
    <p style="margin:0 0 6px;font-size:16px;font-weight:bold">${esc(lines[0] ?? "")}</p>
    ${lines.slice(1).map((l) => `<p style="margin:0 0 4px;font-size:14px">${esc(l)}</p>`).join("")}
    ${note ? `<p style="margin:14px 0 0;padding:10px 12px;background:#FBEEE6;border-radius:6px;font-size:14px">${esc(note)}</p>` : ""}
    <p style="margin:20px 0 0"><a href="${url}" style="background:#B7541F;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">${esc(cta)}</a></p>
    <p style="margin:18px 0 0;color:#6B7280;font-size:11px">${esc(footer)}</p>
  </div>
</div>`;
}
