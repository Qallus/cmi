// Live Page Editor — email notifications to the person who requested the edits.
// Reuses Resend (same env as the invite mailer). Pure builders + one sender.
import type { StructuredExport } from "./export";
import type { ReviewSession } from "./types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildStatusEmailHtml(args: {
  session: ReviewSession; data: StructuredExport; statusLabel: string; editorUrl: string; note?: string;
}): string {
  const { session, data, statusLabel, editorUrl, note } = args;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const logoUrl = `${appUrl}/brand/CMI_Line_Logo_White.svg`;

  const items = data.notes.slice(0, 25).map((en) => {
    const el = en.element;
    const label = el?.heading_text || el?.element_label || el?.element_type || "Element";
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#4b5563;">
        <strong style="color:#111;">${esc(String(label))}</strong>
        <span style="color:#9ca3af;">· ${esc(en.priority)}${en.change_type_label ? " · " + esc(en.change_type_label) : ""}</span><br/>
        ${esc(en.note)}
      </td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
      <tr><td style="background:#111;padding:24px 40px;text-align:center;">
        <img src="${logoUrl}" alt="Constructed Matter, Inc." width="180" style="display:block;margin:0 auto;height:auto;" />
      </td></tr>
      <tr><td style="padding:36px 40px 24px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;">Page Review Update</p>
        <h1 style="margin:0 0 12px;font-size:21px;font-weight:700;color:#111;">${esc(session.page_title ?? session.page_slug)}</h1>
        <p style="margin:0 0 16px;font-size:15px;color:#4b5563;line-height:1.7;">
          The edit request for this page is now <strong style="color:#C87A3A;">${esc(statusLabel)}</strong>.
        </p>
        ${note ? `<p style="margin:0 0 16px;padding:12px 14px;background:#faf6f1;border-radius:6px;font-size:14px;color:#4b5563;">${esc(note)}</p>` : ""}
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${items}</table>
        <table cellpadding="0" cellspacing="0"><tr><td style="background:#C87A3A;border-radius:6px;">
          <a href="${editorUrl}" style="display:inline-block;padding:12px 30px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">View the review &rarr;</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
      <tr><td style="padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;font-weight:600;">Constructed Matter, Inc.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendReviewNotification(args: {
  toEmail: string; subject: string; html: string;
}): Promise<{ ok: boolean; id: string | null; error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "info@constructedmatter.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
  const replyTo = process.env.RESEND_REPLY_TO ?? "jeremy@constructedmatter.com";
  if (!apiKey) return { ok: false, id: null, error: "Email service not configured (RESEND_API_KEY)." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: fromAddress, reply_to: replyTo, to: [args.toEmail], subject: args.subject, html: args.html }),
  });
  if (!res.ok) return { ok: false, id: null, error: `Email delivery failed: ${res.status}` };
  const json = await res.json().catch(() => ({})) as { id?: string };
  return { ok: true, id: json.id ?? null, error: null };
}
