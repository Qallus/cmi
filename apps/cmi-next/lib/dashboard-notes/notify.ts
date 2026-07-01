// Dashboard Review Notes — email notification when a note is shared. Reuses
// Resend (same env as the other mailers).
import type { DashboardNote } from "./types";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(note: DashboardNote, dashboardUrl: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const logoUrl = `${appUrl}/brand/CMI_Line_Logo_White.svg`;
  const routeUrl = note.route ? `${appUrl}${note.route}` : dashboardUrl;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
      <tr><td style="background:#111;padding:24px 40px;text-align:center;"><img src="${logoUrl}" alt="Constructed Matter, Inc." width="180" style="display:block;margin:0 auto;height:auto;" /></td></tr>
      <tr><td style="padding:36px 40px 24px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;">Dashboard note · ${esc(note.type)} · ${esc(note.priority)}</p>
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111;">${esc(note.created_by_name ?? "A Super Admin")} shared a note</h1>
        ${note.page_title ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">On: <strong style="color:#111;">${esc(note.page_title)}</strong></p>` : ""}
        <p style="margin:12px 0 16px;padding:14px 16px;background:#faf6f1;border-radius:6px;font-size:15px;color:#374151;line-height:1.6;">${esc(note.note)}</p>
        ${note.screenshot_url ? `<a href="${note.screenshot_url}"><img src="${note.screenshot_url}" alt="Screenshot" style="max-width:100%;border:1px solid #eee;border-radius:6px;margin-bottom:16px;" /></a>` : ""}
        <table cellpadding="0" cellspacing="0"><tr><td style="background:#C87A3A;border-radius:6px;">
          <a href="${routeUrl}" style="display:inline-block;padding:12px 30px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">Open the page &rarr;</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
      <tr><td style="padding:20px 40px;text-align:center;"><p style="margin:0;font-size:12px;color:#9ca3af;font-weight:600;">Constructed Matter, Inc.</p></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendSharedNoteEmails(note: DashboardNote, recipients: string[]): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || recipients.length === 0) return;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@constructedmatter.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const html = buildHtml(note, `${appUrl}/dashboard/overview`);
  const subject = `${note.created_by_name ?? "A Super Admin"} shared a dashboard note${note.page_title ? ` · ${note.page_title}` : ""}`;

  await Promise.allSettled(recipients.map((to) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from: fromAddress, to: [to], subject, html }),
    })
  ));
}
