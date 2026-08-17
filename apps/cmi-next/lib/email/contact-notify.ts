// Emails a styled notification whenever a website / landing-page contact form is
// submitted. This runs IN ADDITION to saving the submission to the dashboard.

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://constructedmatter.com").replace(/\/$/, "");
}

function esc(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// tel: link needs a clean number; keep a leading + but drop everything else.
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned.replace(/^\+/, "")}`;
}

export type ContactNotification = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  source?: string | null;
  subject?: string | null;
  message?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  projectBudget?: string | null;
  projectStatus?: string[] | null;
  /** Which site the form was submitted from (derived from the request origin). */
  site?: string | null;
};

// Assemble a one-line, human-readable address from the parts that are present.
function formatAddress(n: ContactNotification): string {
  const l1 = [n.addressLine1, n.addressLine2].filter(Boolean).join(", ");
  const cityState = [n.city, n.state].filter(Boolean).join(", ");
  const l2 = [cityState, n.zip].filter(Boolean).join(" ");
  return [l1, l2].filter(Boolean).join(" · ");
}

function row(labelText: string, valueHtml: string): string {
  return `<tr>
    <td style="padding:10px 0;width:150px;vertical-align:top;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;border-bottom:1px solid #f0f0f0;">${esc(labelText)}</td>
    <td style="padding:10px 0;vertical-align:top;font-size:15px;color:#111;border-bottom:1px solid #f0f0f0;">${valueHtml}</td>
  </tr>`;
}

function buildHtml(n: ContactNotification): string {
  const logoUrl = `${appUrl()}/brand/CMI_Line_Logo_White.svg`;
  const name = [n.firstName, n.lastName].filter(Boolean).join(" ").trim() || "—";
  const rows: string[] = [];
  rows.push(row("Name", esc(name)));
  rows.push(row("Email", `<a href="mailto:${esc(n.email)}" style="color:#C87A3A;text-decoration:none;">${esc(n.email)}</a>`));
  if (n.phone) rows.push(row("Phone", `<a href="tel:${esc(telHref(n.phone))}" style="color:#C87A3A;text-decoration:none;">${esc(n.phone)}</a>`));
  if (n.subject) rows.push(row("Subject", esc(n.subject)));
  const address = formatAddress(n);
  if (address) rows.push(row("Project Address", esc(address)));
  if (n.projectBudget) rows.push(row("Project Budget", esc(n.projectBudget)));
  if (n.projectStatus && n.projectStatus.length) {
    const chips = n.projectStatus
      .map((s) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;background:#f5efe8;border:1px solid #e7dccd;border-radius:14px;font-size:12px;color:#6b4b2b;">${esc(s)}</span>`)
      .join("");
    rows.push(row("Project Status", `<div style="margin-top:-4px;">${chips}</div>`));
  }
  if (n.source) rows.push(row("How they heard", esc(n.source)));
  if (n.site) rows.push(row("Submitted from", `<a href="${esc(n.site)}" style="color:#C87A3A;text-decoration:none;">${esc(n.site)}</a>`));
  if (n.message) rows.push(row("Message", esc(n.message).replace(/\n/g, "<br>")));

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
<tr><td style="background:#111;padding:28px 40px;text-align:center;"><img src="${logoUrl}" alt="Constructed Matter, Inc." width="180" style="display:block;margin:0 auto;height:auto;" /></td></tr>
<tr><td style="padding:36px 40px 28px;">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;">New Contact Form Submission</p>
<h1 style="margin:0 0 22px;font-size:22px;font-weight:700;color:#111;line-height:1.3;">${esc(name)} reached out</h1>
<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${rows.join("")}</table>
<div style="margin-top:26px;"><a href="mailto:${esc(n.email)}" style="display:inline-block;background:#C87A3A;border-radius:6px;padding:12px 28px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">Reply to ${esc(n.firstName || name)} &rarr;</a></div>
</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #eee;"></div></td></tr>
<tr><td style="padding:22px 40px;text-align:center;">
<p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-weight:600;">Constructed Matter, Inc.</p>
<p style="margin:0;font-size:12px;color:#9ca3af;">This submission is also saved in your dashboard under Communications.</p>
</td></tr></table></td></tr></table></body></html>`;
}

export async function sendContactNotification(n: ContactNotification): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contact-notify] RESEND_API_KEY is not set");
    return { ok: false, error: "Email service not configured." };
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "info@constructedmatter.com";
  const from = fromEmail.includes("<") ? fromEmail : `Constructed Matter <${fromEmail}>`;
  // Deliver to both the shared inbox and Brandon by default; overridable via env
  // (comma-separated list).
  const toRaw = process.env.CONTACT_NOTIFY_TO ?? "brandon@constructedmatter.com,info@constructedmatter.com";
  const to = Array.from(new Set(toRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)));
  const bccRaw = process.env.CONTACT_NOTIFY_BCC ?? "";
  const bcc = bccRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const name = [n.firstName, n.lastName].filter(Boolean).join(" ").trim() || n.email;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to,
      ...(bcc.length ? { bcc } : {}),
      reply_to: n.email, // replying goes straight to the customer
      subject: `New contact form submission — ${name}${n.site ? ` (${new URL(n.site).hostname.replace(/^www\./, "")})` : ""}`,
      html: buildHtml(n),
    }),
  });

  if (!res.ok) {
    console.error("[contact-notify] Resend error:", await res.text());
    return { ok: false, error: `Email delivery failed: ${res.status}` };
  }
  return { ok: true };
}
