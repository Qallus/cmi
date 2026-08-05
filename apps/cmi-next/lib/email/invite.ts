import { getSupabaseAdmin } from "@/lib/supabase/server";

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

function buildInviteHtml(firstName: string, roleSlug: string, inviteLink: string): string {
  const roleLabel = ROLE_LABELS[roleSlug] ?? roleSlug;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
  const logoUrl = `${appUrl}/brand/CMI_Line_Logo_White.svg`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
          <tr>
            <td style="background:#111111;padding:28px 40px;text-align:center;">
              <img src="${logoUrl}" alt="Constructed Matter, Inc." width="180" height="auto" style="display:block;margin:0 auto;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9ca3af;">Staff Portal Invitation</p>
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111111;line-height:1.3;">You've been invited, ${firstName}.</h1>
              <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.7;">
                You've been granted access to the <strong>Constructed Matter staff dashboard</strong> as a <strong>${roleLabel}</strong>.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.7;">
                Click below to set up your account. This link expires in <strong>24 hours</strong> and can only be used once.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#C87A3A;border-radius:6px;">
                    <a href="${inviteLink}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.04em;">
                      Set Up My Account &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 6px;font-size:12px;color:#9ca3af;">If the button doesn't work, copy and paste this link:</p>
              <p style="margin:0;font-size:12px;color:#C87A3A;word-break:break-all;">${inviteLink}</p>
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><div style="border-top:1px solid #eeeeee;"></div></td></tr>
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">Constructed Matter, Inc.</p>
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">7314 E Osborn Dr Suite A &middot; Scottsdale, AZ 85251</p>
              <p style="margin:16px 0 0;font-size:11px;color:#c4c4c4;">If you weren't expecting this invite, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "info@constructedmatter.com";
  const fromAddress = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
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
      from: fromAddress,
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
