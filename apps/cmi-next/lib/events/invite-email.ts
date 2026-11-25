// The invitation email and text. The email reuses the email builder's Hero
// block (with the theme's animated GIF behind it), then the message, an RSVP
// button with the guest's personal link, and the CMI footer.
import { heroRowsHtml } from "@/components/email-builder/hero";
import { themeById } from "./themes";
import { formatDay, formatWhen, splitLocation } from "./format";
import type { InvitationEvent } from "./types";

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function invitationSubject(e: InvitationEvent): string {
  return `You're invited: ${e.title}`;
}

export function invitationEmailHtml(e: InvitationEvent, opts: { guestName?: string | null; rsvpUrl: string; calendarUrl: string; appUrl: string }): string {
  const t = themeById(e.design.theme);
  const where = splitLocation(e.location);
  const facts = [
    { label: "When", value: formatWhen(e.start_time, e.end_time) },
    ...(where.venue ? [{ label: "Where", value: [where.venue, where.address].filter(Boolean).join("\n") }] : []),
    ...(e.rsvp_deadline ? [{ label: "RSVP by", value: formatDay(e.rsvp_deadline) }] : []),
  ];
  const solid = t.heroBg.match(/#[0-9a-f]{6}/i)?.[0] ?? "#111111";
  const hero = heroRowsHtml(
    {
      hero_image: t.animation === "none" ? "" : `${opts.appUrl}/events/themes/${t.id}.gif`,
      bg_color: solid,
      eyebrow: e.design.eyebrow,
      text: e.title,
      title_accent: e.design.title_accent,
      accent_color: t.accent,
      muted_color: t.heroMuted,
      color: t.heroInk,
      hero_facts: facts,
      stripe: [...t.stripe],
    },
    opts.appUrl,
  );
  const d = e.design;
  const first = (opts.guestName ?? "").trim().split(/\s+/)[0];
  const rows: string[] = [];
  if (first) rows.push(`<p style="margin:0 0 14px;font-size:16px;color:#1b1b1b;">Hi ${esc(first)},</p>`);
  if (d.message_heading) rows.push(`<h2 style="margin:0 0 10px;font-size:21px;line-height:1.3;font-weight:600;color:#1b1b1b;">${esc(d.message_heading)}</h2>`);
  if (d.message_body) rows.push(`<p style="margin:0;font-size:16px;line-height:1.6;color:#333333;">${esc(d.message_body).replace(/\n/g, "<br/>")}</p>`);
  if (d.signoff) rows.push(`<p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:#4a4a4a;font-style:italic;">${esc(d.signoff).replace(/\n/g, "<br/>")}</p>`);

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${esc(e.title)}</title></head>
<body style="margin:0;padding:0;background:#f2f1ee;font-family:Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f1ee;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;">
${hero}
<tr><td style="padding:30px 40px 6px;">${rows.join("\n")}</td></tr>
<tr><td style="padding:24px 40px 8px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td bgcolor="${t.accent}" style="background:${t.accent};border-radius:2px;"><a href="${esc(opts.rsvpUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">RSVP</a></td>
  </tr></table>
  <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#8a8a8a;">This link is just for you. You can come back and change your answer anytime. <a href="${esc(opts.calendarUrl)}" style="color:#8a8a8a;">Add to calendar</a></p>
</td></tr>
${d.footer_note ? `<tr><td style="padding:22px 40px 0;font-size:15px;color:#1b1b1b;">${esc(d.footer_note)}</td></tr>` : ""}
<tr><td style="padding:26px 40px 30px;"><div style="border-top:1px solid #e7e5e4;padding-top:16px;font-size:12px;line-height:1.6;color:#9ca3af;">Constructed Matter, Inc. &nbsp;|&nbsp; 7314 E Osborn Dr, Suite A, Scottsdale, AZ 85251</div></td></tr>
</table>
</td></tr></table>
</body></html>`;
}

/** The text-message version: short, with the personal link. */
export function invitationSms(e: InvitationEvent, rsvpUrl: string, guestName?: string | null, consentFooter = true): string {
  const first = (guestName ?? "").trim().split(/\s+/)[0];
  const when = formatWhen(e.start_time, e.end_time);
  const by = e.rsvp_deadline ? ` RSVP by ${formatDay(e.rsvp_deadline).replace(/^\w+, /, "")}:` : " RSVP:";
  return `${first ? `Hi ${first}! ` : ""}You're invited to ${e.title}, ${when}.${by} ${rsvpUrl}${consentFooter ? " Reply STOP to opt out." : ""} - Constructed Matter`;
}
