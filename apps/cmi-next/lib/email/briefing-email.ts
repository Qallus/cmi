// The 6 AM briefing email.
//
// Same shell as every other staff email (dark logo header, shared footer), but
// laid out as cards so a full day reads at a glance: the AI summary, a stat
// row, then one card per section. Tables and inline styles throughout, because
// that's what survives Outlook. Everything user-typed is escaped.
import { escapeHtml } from "@/lib/messaging/send";
import { publicAppUrl } from "@/lib/twilio";
import { BRAND, emailFooterRow } from "@/lib/email/notification-email";
import { briefingCounts, type Briefing, type BriefingItem, type BriefingUpdate } from "@/lib/briefing/build";

const DANGER = "#B42318";
const WARM = "#FAF6EF";
const e = escapeHtml;

function toneColor(tone: BriefingItem["tone"]): string {
  return tone === "danger" ? DANGER : tone === "warn" ? BRAND.accent : BRAND.muted;
}

function stat(label: string, value: number, alert = false): string {
  const color = alert && value > 0 ? DANGER : BRAND.ink;
  return `<td width="25%" style="padding:0 4px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.hairline};border-radius:8px;border-collapse:separate;">
      <tr><td align="center" style="padding:14px 6px 12px;">
        <div style="font-size:26px;line-height:1;font-weight:bold;color:${color};">${value}</div>
        <div style="margin-top:6px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.muted};">${e(label)}</div>
      </td></tr>
    </table>
  </td>`;
}

function card(title: string, count: number | null, inner: string): string {
  const pill = count != null
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:${BRAND.page};font-size:11px;font-weight:bold;color:${BRAND.body};">${count}</span>`
    : "";
  return `<tr><td style="padding:0 32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.hairline};border-radius:10px;border-collapse:separate;">
      <tr><td style="padding:14px 18px 10px;border-bottom:1px solid ${BRAND.hairline};">
        <span style="font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.08em;color:${BRAND.ink};">${e(title)}</span>${pill}
      </td></tr>
      <tr><td style="padding:4px 18px 8px;">${inner}</td></tr>
    </table>
  </td></tr>`;
}

function rows(items: BriefingItem[], app: string, empty: string): string {
  if (!items.length) return `<p style="margin:10px 0;font-size:14px;color:${BRAND.muted};">${e(empty)}</p>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    ${items.map((it, i) => `<tr>
      <td style="padding:10px 0;${i ? `border-top:1px solid ${BRAND.hairline};` : ""}vertical-align:top;">
        <a href="${app}${it.href}" style="font-size:14px;font-weight:bold;color:${BRAND.ink};text-decoration:none;">${e(it.title)}</a>
        ${it.detail ? `<div style="margin-top:2px;font-size:12px;line-height:1.5;color:${BRAND.muted};">${e(it.detail)}</div>` : ""}
      </td>
      <td align="right" style="padding:10px 0 10px 12px;${i ? `border-top:1px solid ${BRAND.hairline};` : ""}vertical-align:top;white-space:nowrap;font-size:12px;font-weight:bold;color:${toneColor(it.tone)};">${e(it.tag ?? "")}</td>
    </tr>`).join("")}
  </table>`;
}

function subhead(label: string, color: string): string {
  return `<div style="margin:12px 0 0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.1em;color:${color};">${e(label)}</div>`;
}

function updates(list: BriefingUpdate[], app: string): string {
  if (!list.length) return `<p style="margin:10px 0;font-size:14px;color:${BRAND.muted};">No changes from the team on your jobs or deals since yesterday.</p>`;
  return list.map((u, i) => `<div style="padding:10px 0;${i ? `border-top:1px solid ${BRAND.hairline};` : ""}">
    <a href="${app}${u.href}" style="font-size:14px;font-weight:bold;color:${BRAND.ink};text-decoration:none;">${e(u.title)}</a>
    ${u.subtitle ? `<span style="font-size:12px;color:${BRAND.muted};">&nbsp;·&nbsp;${e(u.subtitle)}</span>` : ""}
    ${u.lines.map((l) => `<div style="margin-top:4px;padding-left:10px;border-left:2px solid ${BRAND.hairline};font-size:13px;line-height:1.5;color:${BRAND.body};">${e(l)}</div>`).join("")}
  </div>`).join("");
}

export function briefingEmailSubject(b: Briefing): string {
  const c = briefingCounts(b);
  const bits = [
    c.meetings ? `${c.meetings} meeting${c.meetings === 1 ? "" : "s"}` : null,
    c.overdue ? `${c.overdue} overdue` : null,
    c.dueToday ? `${c.dueToday} due today` : null,
  ].filter(Boolean);
  return `Your day: ${b.dateLabel}${bits.length ? ` — ${bits.join(", ")}` : ""}`;
}

export function briefingEmailHtml(b: Briefing, summary: string): string {
  const app = publicAppUrl();
  const c = briefingCounts(b);
  const t = b.tasks;

  const taskInner = !t.overdue.length && !t.today.length && !t.week.length
    ? `<p style="margin:10px 0;font-size:14px;color:${BRAND.muted};">Nothing due this week.${t.undated ? ` ${t.undated} open task${t.undated === 1 ? " has" : "s have"} no due date.` : ""}</p>`
    : [
        t.overdue.length ? subhead("Overdue", DANGER) + rows(t.overdue, app, "") : "",
        t.today.length ? subhead("Due today", BRAND.accent) + rows(t.today, app, "") : "",
        t.week.length ? subhead("Later this week", BRAND.muted) + rows(t.week, app, "") : "",
        t.undated ? `<p style="margin:8px 0 4px;font-size:12px;color:${BRAND.muted};">Plus ${t.undated} open task${t.undated === 1 ? "" : "s"} with no due date.</p>` : "",
      ].join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${e(briefingEmailSubject(b))}</title></head>
<body style="margin:0;padding:0;background:${BRAND.page};font-family:Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(summary)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.page};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">

        <tr><td style="background:${BRAND.ink};padding:22px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td><img src="${app}/brand/cmi_line_logo_white.png" alt="Constructed Matter, Inc." width="180"
                     style="display:block;width:180px;max-width:100%;height:auto;border:0;" /></td>
            <td align="right" style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.14em;color:#BDBDBD;white-space:nowrap;">${e(b.dateLabel)}</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:28px 32px 18px;">
          <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.18em;color:${BRAND.accent};">Morning briefing</div>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;font-weight:bold;color:${BRAND.ink};">Good morning, ${e(b.staff.firstName)}</h1>
        </td></tr>

        <tr><td style="padding:0 32px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${WARM};border-left:4px solid ${BRAND.accent};border-radius:6px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${BRAND.accent};">Here's what needs you today</div>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.65;color:${BRAND.ink};">${e(summary)}</p>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 28px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${stat("Meetings", c.meetings)}
            ${stat("Overdue", c.overdue, true)}
            ${stat("Due today", c.dueToday)}
            ${stat("Waiting", c.attention)}
          </tr></table>
        </td></tr>

        ${card("Today's meetings", c.meetings, rows(b.meetings, app, "No meetings or bookings on your calendar today."))}
        ${card("Your tasks", c.overdue + c.dueToday + c.dueWeek, taskInner)}
        ${card("Waiting on you", c.attention, rows(b.attention, app, "Nothing waiting on a reply."))}
        ${card("Since yesterday", c.updates, updates(b.updates, app))}

        <tr><td style="padding:4px 32px 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:${BRAND.accent};border-radius:6px;">
              <a href="${app}/dashboard/today" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Open your Today page</a>
            </td></tr>
          </table>
        </td></tr>

        ${emailFooterRow(app)}

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
