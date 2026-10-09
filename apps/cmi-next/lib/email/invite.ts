import { getSupabaseAdmin } from "@/lib/supabase/server";
import { fromAddress } from "@/lib/email/from";
import { escapeHtml } from "@/lib/messaging/send";
import { publicAppUrl } from "@/lib/twilio";
import { BRAND } from "@/lib/email/notification-email";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  project_manager: "Project Manager",
  staff: "Staff",
  designer: "Designer",
  estimator: "Estimator",
  superintendent: "Superintendent",
  subcontractor: "Subcontractor",
  vendor: "Vendor",
  client: "Client",
  viewer: "Viewer",
};

/**
 * The staff invite email.
 *
 * Light header with the black logo: some clients (Outlook, several webmail
 * apps) drop CSS background colours, and the old dark header then left a white
 * logo on white. Colours that matter (the button) are set as `bgcolor`
 * attributes too, which those clients keep. Names are escaped.
 */
export function buildInviteHtml(firstName: string, roleSlug: string, inviteLink: string): string {
  const e = escapeHtml;
  const roleLabel = ROLE_LABELS[roleSlug] ?? roleSlug;
  const app = publicAppUrl();
  const link = e(inviteLink);

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>You've been invited to the Constructed Matter dashboard</title></head>
<body style="margin:0;padding:0;background-color:${BRAND.page};font-family:Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Set up your Constructed Matter dashboard account. The link expires in 24 hours.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BRAND.page}" style="background-color:${BRAND.page};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:600px;max-width:100%;background-color:#ffffff;border-radius:10px;overflow:hidden;">

        <tr><td align="center" bgcolor="#ffffff" style="padding:30px 32px 26px;border-bottom:1px solid ${BRAND.hairline};">
          <img src="${app}/brand/cmi_line_logo_black.png" alt="Constructed Matter, Inc." width="200"
               style="display:block;width:200px;max-width:100%;height:auto;border:0;" />
        </td></tr>

        <tr><td style="padding:34px 40px 10px;">
          <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.18em;color:${BRAND.accent};">Staff portal invitation</div>
          <h1 style="margin:10px 0 18px;font-size:24px;line-height:1.3;font-weight:bold;color:${BRAND.ink};">You've been invited, ${e(firstName)}.</h1>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${BRAND.body};">
            You've been given access to the <strong style="color:${BRAND.ink};">Constructed Matter staff dashboard</strong> as a <strong style="color:${BRAND.ink};">${e(roleLabel)}</strong>.
          </p>
          <p style="margin:0 0 26px;font-size:15px;line-height:1.65;color:${BRAND.body};">
            Click below to set up your account. This link expires in <strong style="color:${BRAND.ink};">24 hours</strong> and can only be used once.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td bgcolor="${BRAND.accent}" style="background-color:${BRAND.accent};border-radius:6px;">
              <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Set up my account &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:26px 0 6px;font-size:12px;color:${BRAND.muted};">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="margin:0 0 6px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${link}" style="color:${BRAND.accent};text-decoration:underline;">${link}</a></p>
        </td></tr>

        <tr><td style="padding:24px 40px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid ${BRAND.hairline};border-collapse:collapse;">
            <tr>
              <td width="56" style="padding:18px 14px 0 0;vertical-align:top;">
                <img src="${app}/brand/cmi_app_icon_black.png" alt="" width="42" height="42" style="display:block;width:42px;height:42px;border:0;" />
              </td>
              <td style="padding:18px 0 0;vertical-align:top;">
                <p style="margin:0 0 3px;font-size:13px;font-weight:bold;color:${BRAND.ink};">Constructed Matter, Inc.</p>
                <p style="margin:0 0 3px;font-size:12px;line-height:1.6;color:${BRAND.muted};">7314 E Osborn Dr Suite A &middot; Scottsdale, AZ 85251</p>
                <p style="margin:0 0 10px;font-size:12px;color:${BRAND.muted};">
                  <a href="tel:+14806284458" style="color:${BRAND.muted};text-decoration:none;">(480) 628-4458</a>
                  &nbsp;&middot;&nbsp;
                  <a href="mailto:info@constructedmatter.com" style="color:${BRAND.muted};text-decoration:none;">info@constructedmatter.com</a>
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted};">If you weren't expecting this invite, you can safely ignore this email.</p>
              </td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function generateInviteLink(email: string): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const redirectTo = `${appUrl}/register`;
  const supabase = getSupabaseAdmin();

  // Try invite type (creates Supabase auth user if they don't have one yet)
  let result = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: { redirectTo },
  });

  // Fall back to magic link if auth user already exists
  if (result.error) {
    result = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });
  }

  if (result.error || !result.data?.properties?.action_link) return null;
  return result.data.properties.action_link;
}

export async function sendInviteEmail(params: {
  email: string;
  firstName: string;
  roleSlug: string;
  inviteLink: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = fromAddress();
  const replyTo = process.env.RESEND_REPLY_TO ?? "jeremy@constructedmatter.com";

  if (!apiKey) {
    console.error("[sendInviteEmail] RESEND_API_KEY is not set");
    return { ok: false, error: "Email service not configured." };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: from,
      reply_to: replyTo,
      to: [params.email],
      subject: `You've been invited to the Constructed Matter Dashboard`,
      html: buildInviteHtml(params.firstName, params.roleSlug, params.inviteLink),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[sendInviteEmail] Resend error:", body);
    return { ok: false, error: `Email delivery failed: ${res.status}` };
  }

  return { ok: true };
}
