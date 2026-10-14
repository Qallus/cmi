// Executive summary → HTML. The body is plain semantic HTML (h2/p/ul) that
// staff can edit in the rich-text editor; the branded document wraps it for
// email and for the printable PDF. Email-safe: tables + inline styles, PNG
// logo (Gmail/Outlook strip SVG). Client-safe.
import { BRAND } from "@/lib/email/brand";
import type { GeneratedSummary, SummaryFact } from "./generate";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sectionsToHtml(summary: Pick<GeneratedSummary, "sections">): string {
  return summary.sections.map((s) => [
    `<h2>${esc(s.title)}</h2>`,
    ...(s.paragraphs ?? []).map((p) => `<p>${esc(p)}</p>`),
    s.bullets?.length ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : "",
  ].join("")).join("");
}

// Inline styles for the editable body when it goes out in an email / PDF.
function styleBody(html: string): string {
  return html
    .replace(/<h2>/g, `<h2 style="margin:26px 0 8px;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${BRAND.accent};">`)
    .replace(/<h3>/g, `<h3 style="margin:18px 0 6px;font-size:15px;font-weight:bold;color:${BRAND.ink};">`)
    .replace(/<p>/g, `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${BRAND.body};">`)
    .replace(/<ul>/g, `<ul style="margin:0 0 14px;padding-left:20px;">`)
    .replace(/<ol>/g, `<ol style="margin:0 0 14px;padding-left:20px;">`)
    .replace(/<li>/g, `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${BRAND.body};">`)
    .replace(/<a /g, `<a style="color:${BRAND.accent};" `);
}

export type SummaryDoc = {
  audience: "team" | "client";
  kind: "Job" | "Pre-Con";
  projectName: string;
  projectNumber: string | null;
  headline: string;
  facts: SummaryFact[];
  bodyHtml: string;          // already sanitized
  preparedBy: string | null;
  dateLabel: string;
  appUrl: string;
  cta?: { label: string; url: string } | null;
  note?: string | null;      // optional personal note from the sender
};

export function summaryDocumentHtml(d: SummaryDoc, opts: { print?: boolean } = {}): string {
  const facts = d.facts.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 8px;border-collapse:separate;border-spacing:0 6px;">
        ${chunk(d.facts, 2).map((row) => `<tr>${row.map((f) => `
          <td width="50%" style="padding:10px 12px;background:#FAF8F5;border:1px solid ${BRAND.hairline};border-radius:6px;vertical-align:top;">
            <div style="font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;color:${BRAND.muted};">${esc(f.label)}</div>
            <div style="margin-top:3px;font-size:15px;font-weight:bold;color:${BRAND.ink};">${esc(f.value)}</div>
          </td>`).join(`<td width="8" style="width:8px;"></td>`)}${row.length === 1 ? `<td width="8"></td><td width="50%"></td>` : ""}</tr>`).join("")}
      </table>`
    : "";

  const note = d.note?.trim()
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;"><tr><td style="border-left:3px solid ${BRAND.accent};padding:8px 0 8px 14px;font-size:15px;line-height:1.6;color:${BRAND.body};">${esc(d.note.trim()).replace(/\n/g, "<br/>")}</td></tr></table>`
    : "";

  const cta = d.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;"><tr><td bgcolor="${BRAND.accent}" style="background:${BRAND.accent};border-radius:6px;">
        <a href="${esc(d.cta.url)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(d.cta.label)}</a>
      </td></tr></table>`
    : "";

  const eyebrow = `${d.audience === "team" ? "Internal · " : ""}Executive Summary · ${d.kind}`;
  const meta = [d.projectNumber, d.dateLabel, d.preparedBy ? `Prepared by ${d.preparedBy}` : null].filter(Boolean).join("  ·  ");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${esc(d.projectName)} — Executive Summary</title>
${opts.print ? `<style>@page{size:letter;margin:0.5in}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>` : ""}
</head>
<body style="margin:0;padding:0;background:${opts.print ? "#ffffff" : BRAND.page};font-family:Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(d.headline)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${opts.print ? "#ffffff" : BRAND.page};padding:${opts.print ? "0" : "32px 16px"};">
    <tr><td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:640px;max-width:100%;background:#ffffff;border-radius:10px;overflow:hidden;">
        <tr><td bgcolor="${BRAND.ink}" style="background:${BRAND.ink};padding:22px 32px;">
          <img src="${d.appUrl}/brand/cmi_line_logo_white.png" alt="Constructed Matter, Inc." width="200" style="display:block;width:200px;max-width:100%;height:auto;border:0;" />
        </td></tr>
        <tr><td style="padding:30px 32px 10px;">
          <div style="font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.18em;color:${BRAND.accent};">${esc(eyebrow)}</div>
          <div style="margin-top:8px;font-size:13px;color:${BRAND.muted};">${esc(d.projectName)}</div>
          <h1 style="margin:6px 0 6px;font-size:24px;line-height:1.3;font-weight:bold;color:${BRAND.ink};">${esc(d.headline)}</h1>
          <div style="margin:0 0 16px;font-size:12px;color:${BRAND.muted};">${esc(meta)}</div>
          ${note}
          ${facts}
          ${styleBody(d.bodyHtml)}
          ${cta}
        </td></tr>
        <tr><td style="padding:22px 32px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid ${BRAND.hairline};">
            <tr>
              <td width="56" style="padding:16px 14px 0 0;vertical-align:top;"><img src="${d.appUrl}/brand/cmi_app_icon_black.png" alt="" width="40" height="40" style="display:block;width:40px;height:40px;border:0;" /></td>
              <td style="padding:16px 0 0;vertical-align:top;">
                <p style="margin:0 0 3px;font-size:13px;font-weight:bold;color:${BRAND.ink};">Constructed Matter, Inc.</p>
                <p style="margin:0 0 3px;font-size:12px;line-height:1.6;color:${BRAND.muted};">7314 E Osborn Dr Suite A · Scottsdale, AZ 85251</p>
                <p style="margin:0;font-size:12px;color:${BRAND.muted};">(480) 628-4458 · info@constructedmatter.com · ROC License KB1 - 343120</p>
                ${d.audience === "team" ? `<p style="margin:8px 0 0;font-size:11px;color:${BRAND.muted};">Internal — contains budget and project details. Do not forward to clients or trades.</p>` : ""}
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
