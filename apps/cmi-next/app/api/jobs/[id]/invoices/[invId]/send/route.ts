// Email a branded invoice PDF to the job's client via Resend, respecting
// messaging suppression, and log it. Node runtime (renders the PDF).
import { createElement } from "react";
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getJob } from "@/lib/jobs/data";
import { getInvoice, markInvoiceSent } from "@/lib/invoices/data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { InvoicePdf } from "@/components/pdf/invoice-pdf";
import { primaryClient } from "@/lib/jobs/pdf-helpers";
import { isSuppressed } from "@/lib/messaging/consent";
import { logMessage } from "@/lib/communications/data";
import { invoiceBalance } from "@/lib/invoices/types";

export const runtime = "nodejs";
const WRITE_ROLES = ["super_admin", "admin", "project_manager"];

export async function POST(request: Request, { params }: { params: Promise<{ id: string; invId: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const { id, invId } = await params;

    const body = await request.json().catch(() => ({})) as { to?: string };
    const [job, invoice, logo] = await Promise.all([getJob(id), getInvoice(invId), getBrandLogoDataUri()]);
    if (!job || !invoice) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const client = primaryClient(job);
    const to = (body.to || client?.email || "").trim();
    if (!to) return NextResponse.json({ error: "No client email on file. Add a primary client with an email, or pass `to`." }, { status: 400 });
    if (await isSuppressed("email", to)) return NextResponse.json({ error: `${to} has opted out of email.` }, { status: 409 });

    const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "noreply@constructedmatter.com";
    if (!key) return NextResponse.json({ error: "Email not configured (RESEND_API_KEY)." }, { status: 500 });

    const pdf = await renderPdf(createElement(InvoicePdf, { invoice, job, client, logo }));
    const filename = `${(invoice.invoice_number ?? "invoice").replace(/[^a-z0-9._-]+/gi, "_")}.pdf`;
    const subject = `Invoice ${invoice.invoice_number ?? ""} — ${job.job_name}`;
    const html = `<p>Hello${client?.name ? ` ${client.name}` : ""},</p>`
      + `<p>Please find attached invoice <strong>${invoice.invoice_number ?? ""}</strong> for <strong>${job.job_name}</strong>.</p>`
      + `<p>Balance due: <strong>$${invoiceBalance(invoice).toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>.</p>`
      + `<p>Thank you,<br/>Constructed Matter, Inc.</p>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, attachments: [{ filename, content: Buffer.from(pdf).toString("base64") }] }),
    });
    if (!res.ok) return NextResponse.json({ error: `Send failed: ${await res.text()}` }, { status: 502 });
    const json = await res.json().catch(() => ({})) as { id?: string };

    await markInvoiceSent(invId);
    await logMessage({
      direction: "outbound", channel: "email", contact_id: null,
      to_address: to, from_address: from, subject, body: html, status: "sent",
      project_id: null, quote_id: null, provider: "resend", provider_id: json.id ?? null,
      error_message: null, duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: json.id, to });
  } catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 500 }); }
}
