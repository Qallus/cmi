import { getSupabaseAdmin } from "@/lib/supabase/server";

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://constructedmatter.com").replace(/\/$/, "");
}

// Generate a Supabase password-recovery link that redirects to `redirectPath`
// (e.g. "/reset-password"). Returns null if the user has no auth account.
export async function generateRecoveryLink(email: string, redirectPath: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${appUrl()}${redirectPath}` },
  });
  if (error || !data?.properties?.action_link) return null;
  return data.properties.action_link;
}

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "hello@constructedmatter.com";
  const from = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
  const replyTo = process.env.RESEND_REPLY_TO ?? "jeremy@constructedmatter.com";
  return { apiKey, from, replyTo };
}

async function send(payload: { to: string[]; subject: string; html: string; replyTo?: string }): Promise<{ ok: boolean; error?: string }> {
  const { apiKey, from, replyTo } = resendConfig();
  if (!apiKey) {
    console.error("[auth-emails] RESEND_API_KEY is not set");
    return { ok: false, error: "Email service not configured." };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, reply_to: payload.replyTo ?? replyTo, to: payload.to, subject: payload.subject, html: payload.html }),
  });
  if (!res.ok) {
    console.error("[auth-emails] Resend error:", await res.text());
    return { ok: false, error: `Email delivery failed: ${res.status}` };
  }
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function shell(bodyHtml: string): string {
  const logoUrl = `${appUrl()}/brand/CMI_Line_Logo_White.svg`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
<tr><td style="background:#111;padding:28px 40px;text-align:center;"><img src="${logoUrl}" alt="Constructed Matter, Inc." width="180" style="display:block;margin:0 auto;height:auto;" /></td></tr>
<tr><td style="padding:40px;">${bodyHtml}</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
<tr><td style="padding:24px 40px;text-align:center;">
<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">Constructed Matter, Inc.</p>
<p style="margin:0;font-size:12px;color:#9ca3af;">7314 E Osborn Dr Suite A &middot; Scottsdale, AZ 85251</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<{ ok: boolean; error?: string }> {
  const body = `
<p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;">Password Reset</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111;line-height:1.3;">Reset your password</h1>
<p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.7;">We received a request to reset the password for your Constructed Matter account.</p>
<p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">Click below to choose a new password. This link expires in <strong>1 hour</strong> and can only be used once.</p>
<table cellpadding="0" cellspacing="0"><tr><td style="background:#C87A3A;border-radius:6px;"><a href="${resetLink}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.04em;">Reset My Password &rarr;</a></td></tr></table>
<p style="margin:24px 0 6px;font-size:12px;color:#9ca3af;">If the button doesn't work, copy and paste this link:</p>
<p style="margin:0;font-size:12px;color:#C87A3A;word-break:break-all;">${resetLink}</p>
<p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">If you didn't request this, you can safely ignore this email — your password won't change.</p>`;
  return send({ to: [email], subject: "Reset your Constructed Matter password", html: shell(body) });
}

export async function sendRequestAccessEmail(input: { name: string; email: string; company?: string; message?: string }): Promise<{ ok: boolean; error?: string }> {
  const adminTo = process.env.RESEND_REPLY_TO ?? "jeremy@constructedmatter.com";
  const rows = [
    `<tr><td style="padding:6px 0;width:110px;color:#9ca3af;">Name</td><td style="padding:6px 0;font-weight:600;color:#111;">${escapeHtml(input.name)}</td></tr>`,
    `<tr><td style="padding:6px 0;color:#9ca3af;">Email</td><td style="padding:6px 0;font-weight:600;color:#111;">${escapeHtml(input.email)}</td></tr>`,
    input.company ? `<tr><td style="padding:6px 0;color:#9ca3af;">Company</td><td style="padding:6px 0;color:#111;">${escapeHtml(input.company)}</td></tr>` : "",
    input.message ? `<tr><td style="padding:6px 0;color:#9ca3af;vertical-align:top;">Message</td><td style="padding:6px 0;color:#111;">${escapeHtml(input.message)}</td></tr>` : "",
  ].join("");
  const body = `
<p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;">Dashboard Access Request</p>
<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111;line-height:1.3;">Someone requested dashboard access</h1>
<table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;color:#4b5563;">${rows}</table>
<p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">If approved, add them from the dashboard Users section.</p>`;
  return send({ to: [adminTo], subject: `Access request from ${input.name}`, html: shell(body), replyTo: input.email });
}
