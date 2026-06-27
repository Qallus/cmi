import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isSuppressed } from "@/lib/messaging/consent";
import { logMessage } from "@/lib/communications/data";

export type CompletedEdit = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  images?: string[];
};

// Participants are stored as display strings like "Brandon Fadden - Super Admin".
// Resolve each to a staff email so completed-edit notifications can be delivered.
export async function resolveParticipantEmails(names: string[]): Promise<{ name: string; email: string }[]> {
  const cleaned = names
    .map(name => name.split(" - ")[0].trim())
    .filter(Boolean);
  if (!cleaned.length) return [];

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("staff_users")
    .select("display_name, first_name, last_name, email, status")
    .not("email", "is", null);
  const rows = (data || []) as {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    status: string | null;
  }[];

  const out: { name: string; email: string }[] = [];
  const seen = new Set<string>();

  for (const name of cleaned) {
    const lower = name.toLowerCase();
    const tokens = lower.split(/\s+/).filter(Boolean);
    const first = tokens[0] || "";
    const surname = tokens[tokens.length - 1] || "";

    const match =
      rows.find(row => row.email && (row.display_name || "").toLowerCase() === lower) ||
      rows.find(row => row.email && row.status === "active" && (row.last_name || "").toLowerCase() === surname && (row.first_name || "").toLowerCase().startsWith(first)) ||
      rows.find(row => row.email && (row.last_name || "").toLowerCase() === surname && (row.first_name || "").toLowerCase().startsWith(first));

    if (match?.email && !seen.has(match.email.toLowerCase())) {
      seen.add(match.email.toLowerCase());
      out.push({ name, email: match.email });
    }
  }

  return out;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEditEmailHtml(pageTitle: string, projectTitle: string | null, edit: CompletedEdit, appUrl: string): string {
  const logoUrl = `${appUrl}/brand/CMI_Line_Logo_White.svg`;
  const boardUrl = `${appUrl}/dashboard/project-manager`;
  const rows: string[] = [];
  const field = (label: string, value?: string) => {
    if (!value || !value.trim()) return;
    rows.push(`<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9ca3af;">${escapeHtml(label)}</p><p style="margin:0 0 18px;font-size:15px;color:#111111;line-height:1.6;white-space:pre-wrap;">${escapeHtml(value)}</p>`);
  };
  field("Eyebrow", edit.eyebrow);
  field("Title", edit.title);
  field("Sub-title", edit.subtitle);
  field("Details", edit.content);
  const imageCount = Array.isArray(edit.images) ? edit.images.length : 0;

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
            <td style="padding:40px 40px 16px;">
              <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#C87A3A;">Website Edit Completed</p>
              <h1 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111111;line-height:1.3;">${escapeHtml(pageTitle)}</h1>
              ${projectTitle ? `<p style="margin:0 0 20px;font-size:13px;color:#9ca3af;">${escapeHtml(projectTitle)}</p>` : ""}
              <div style="border-top:1px solid #eeeeee;margin:8px 0 24px;"></div>
              ${rows.join("") || `<p style="margin:0 0 18px;font-size:15px;color:#4b5563;">A requested edit on this page has been completed.</p>`}
              ${imageCount ? `<p style="margin:0 0 24px;font-size:13px;color:#9ca3af;">${imageCount} reference image${imageCount === 1 ? "" : "s"} attached to this request in the dashboard.</p>` : ""}
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#C87A3A;border-radius:6px;">
                    <a href="${boardUrl}" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.04em;">
                      View in Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">Constructed Matter, Inc.</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">7314 E Osborn Dr Suite A &middot; Scottsdale, AZ 85251</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Email each resolved participant that a requested edit on a page is now complete.
// Returns the number of recipients successfully emailed. Best-effort: never throws.
export async function sendEditCompletedEmails(opts: {
  projectTitle: string | null;
  pageTitle: string;
  edit: CompletedEdit;
  recipientNames: string[];
}): Promise<{ sent: number }> {
  try {
    const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    if (!apiKey) return { sent: 0 };

    const recipients = await resolveParticipantEmails(opts.recipientNames);
    if (!recipients.length) return { sent: 0 };

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@constructedmatter.com";
    const fromAddress = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
    const replyTo = process.env.RESEND_REPLY_TO ?? "jeremy@constructedmatter.com";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://my.constructedmatter.com";
    const subject = `Edit completed: ${opts.pageTitle}${opts.edit.title ? ` — ${opts.edit.title}` : ""}`;
    const html = buildEditEmailHtml(opts.pageTitle, opts.projectTitle, opts.edit, appUrl);

    let sent = 0;
    for (const recipient of recipients) {
      try {
        if (await isSuppressed("email", recipient.email)) continue;
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromAddress, reply_to: replyTo, to: recipient.email, subject, html }),
        });
        const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        const ok = res.ok;
        try {
          await logMessage({
            direction: "outbound",
            channel: "email",
            contact_id: null,
            to_address: recipient.email,
            from_address: fromEmail,
            subject,
            body: html,
            status: ok ? "sent" : "failed",
            project_id: null,
            quote_id: null,
            provider: "resend",
            provider_id: json.id ?? null,
            error_message: ok ? null : (json.message ?? `HTTP ${res.status}`),
            duration_seconds: null,
            recording_url: null,
            sent_at: new Date().toISOString(),
          });
        } catch {
          // logging is best-effort
        }
        if (ok) sent += 1;
      } catch {
        // skip this recipient on error
      }
    }
    return { sent };
  } catch {
    return { sent: 0 };
  }
}
