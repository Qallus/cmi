// The branded shell for anything CMI emails a staff member.
//
// Table-based layout with inline styles, because that is what survives Outlook.
// The logo is a PNG, not the SVG the site uses: Gmail and Outlook both strip
// SVG, so an <img> pointing at one renders as nothing at all.
import { escapeHtml } from "@/lib/messaging/send";
import { publicAppUrl } from "@/lib/twilio";

const BRAND = {
  ink: "#111111",
  accent: "#9E6F2E",
  body: "#3F3F46",
  muted: "#8A8A8A",
  hairline: "#E7E5E4",
  page: "#F4F4F4",
};

const COMPANY = "Constructed Matter, Inc.";
const ADDRESS = "7314 E Osborn Dr Suite A · Scottsdale, AZ 85251";
const PHONE = "(480) 628-4458";
const ROC = "ROC License KB1 - 343120";

export type NotificationEmail = {
  /** Small line above the headline — what kind of thing this is. */
  eyebrow: string;
  /** The headline. One line, specific. */
  heading: string;
  /** Body paragraphs. */
  paragraphs?: string[];
  /** Label/value rows, for the detail that belongs in a table not a sentence. */
  facts?: { label: string; value: string }[];
  /** A quoted excerpt — a message body, a note. */
  quote?: string | null;
  cta?: { label: string; url: string } | null;
  /** One line under the button explaining what happens next, if anything. */
  closing?: string | null;
};

/**
 * Renders the email.
 *
 * Everything is escaped. Content comes from staff typing into the app, so it
 * cannot be trusted as markup.
 */
export function notificationEmailHtml(email: NotificationEmail): string {
  const app = publicAppUrl();
  const e = escapeHtml;

  const paragraphs = (email.paragraphs ?? [])
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${BRAND.body};">${e(p)}</p>`)
    .join("");

  const facts = (email.facts ?? []).length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:collapse;">
        ${(email.facts ?? []).map((f) => `<tr>
          <td style="padding:6px 12px 6px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND.muted};white-space:nowrap;vertical-align:top;">${e(f.label)}</td>
          <td style="padding:6px 0;font-size:14px;color:${BRAND.ink};vertical-align:top;">${e(f.value)}</td>
        </tr>`).join("")}
      </table>`
    : "";

  const quote = email.quote
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;">
        <tr><td style="border-left:3px solid ${BRAND.accent};padding:10px 0 10px 14px;font-size:15px;line-height:1.6;color:${BRAND.body};">${e(email.quote).replace(/\n/g, "<br/>")}</td></tr>
      </table>`
    : "";

  const cta = email.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
        <tr><td style="background:${BRAND.accent};border-radius:6px;">
          <a href="${email.cta.url}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${e(email.cta.label)}</a>
        </td></tr>
      </table>`
    : "";

  const closing = email.closing
    ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${BRAND.muted};">${e(email.closing)}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${e(email.heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:Helvetica,Arial,sans-serif;">
  <!-- Preheader: what the inbox shows beside the subject. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(email.heading)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">

        <tr><td style="background:${BRAND.ink};padding:22px 32px;">
          <img src="${app}/brand/cmi_line_logo_white.png" alt="${COMPANY}" width="200"
               style="display:block;width:200px;max-width:100%;height:auto;border:0;" />
        </td></tr>

        <tr><td style="padding:30px 32px 8px;">
          <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.18em;color:${BRAND.accent};">${e(email.eyebrow)}</div>
          <h1 style="margin:10px 0 18px;font-size:22px;line-height:1.3;font-weight:bold;color:${BRAND.ink};">${e(email.heading)}</h1>
          ${paragraphs}
          ${facts}
          ${quote}
          ${cta}
          ${closing}
        </td></tr>

        <tr><td style="padding:24px 32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid ${BRAND.hairline};border-collapse:collapse;">
            <tr>
              <!-- The app mark, so the footer is recognisable even where images
                   load but the dark header bar is clipped by the preview pane. -->
              <td width="56" style="padding:18px 14px 0 0;vertical-align:top;">
                <img src="${app}/brand/cmi_app_icon_black.png" alt="" width="42" height="42"
                     style="display:block;width:42px;height:42px;border:0;" />
              </td>
              <td style="padding:18px 0 0;vertical-align:top;">
                <p style="margin:0 0 3px;font-size:13px;font-weight:bold;color:${BRAND.ink};">${COMPANY}</p>
                <p style="margin:0 0 3px;font-size:12px;line-height:1.6;color:${BRAND.muted};">${ADDRESS}</p>
                <p style="margin:0 0 10px;font-size:12px;color:${BRAND.muted};">
                  <a href="tel:+14806284458" style="color:${BRAND.muted};text-decoration:none;">${PHONE}</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:info@constructedmatter.com" style="color:${BRAND.muted};text-decoration:none;">info@constructedmatter.com</a>
                </p>
                <p style="margin:0;font-size:11px;line-height:1.6;color:${BRAND.muted};">
                  ${ROC} &nbsp;·&nbsp;
                  <a href="${app}/dashboard/my-profile" style="color:${BRAND.accent};text-decoration:none;">Notification settings</a>
                </p>
                <p style="margin:10px 0 0;font-size:11px;line-height:1.6;color:${BRAND.muted};">
                  You are getting this because you are on the Constructed Matter team and this concerns you directly.
                </p>
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
