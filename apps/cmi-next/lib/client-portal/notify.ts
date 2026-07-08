// Client-portal invite email. Mirrors lib/email/invite.ts but targets the
// client set-account page and uses client-facing copy. Reuses Supabase
// generateLink (invite → magiclink fallback) + Resend.
import { getSupabaseAdmin } from "@/lib/supabase/server";

async function generateClientInviteLink(email: string): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const redirectTo = `${appUrl}/client/set-account`;
  const supabase = getSupabaseAdmin();

  let result = await supabase.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (result.error) {
    result = await supabase.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  }
  if (result.error || !result.data?.properties?.action_link) return null;
  return result.data.properties.action_link;
}

function buildHtml(firstName: string, jobName: string, link: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const logoUrl = `${appUrl}/brand/CMI_Line_Logo_White.svg`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
      <tr><td style="background:#111;padding:28px 40px;text-align:center;"><img src="${logoUrl}" alt="Constructed Matter, Inc." width="180" style="display:block;margin:0 auto;height:auto;" /></td></tr>
      <tr><td style="padding:40px 40px 32px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;">Client Project Portal</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111;line-height:1.3;">Welcome, ${firstName}.</h1>
        <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.7;">You now have access to your project portal for <strong>${jobName}</strong>, where you can follow progress, view photos and documents, message your team, and more.</p>
        <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">Click below to set your password. This link expires in <strong>24 hours</strong>.</p>
        <table cellpadding="0" cellspacing="0"><tr><td style="background:#C87A3A;border-radius:6px;">
          <a href="${link}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.04em;">Access My Project &rarr;</a>
        </td></tr></table>
        <p style="margin:24px 0 6px;font-size:12px;color:#9ca3af;">If the button doesn't work, copy and paste this link:</p>
        <p style="margin:0;font-size:12px;color:#C87A3A;word-break:break-all;">${link}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendClientInvite(params: { email: string; firstName: string; jobName: string }): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@constructedmatter.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
  const replyTo = process.env.RESEND_REPLY_TO ?? "jeremy@constructedmatter.com";
  if (!apiKey) return { ok: false, error: "Email service not configured (RESEND_API_KEY)." };

  const link = await generateClientInviteLink(params.email);
  if (!link) return { ok: false, error: "Could not generate an invite link." };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: fromAddress, reply_to: replyTo, to: [params.email],
      subject: `Your Constructed Matter project portal — ${params.jobName}`,
      html: buildHtml(params.firstName || "there", params.jobName, link),
    }),
  });
  if (!res.ok) return { ok: false, error: `Email delivery failed: ${res.status}` };
  return { ok: true };
}
