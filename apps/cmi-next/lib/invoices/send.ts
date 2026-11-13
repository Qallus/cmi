// Email a branded invoice PDF to the job's client via Resend, respecting
// messaging suppression, and log it. Shared by the invoice Send button
// (app/api/jobs/[id]/invoices/[invId]/send) and Claude (cmi_invoice_send).
// Node runtime only (renders the PDF).
import { createElement } from "react";
import { getJob } from "@/lib/jobs/data";
import { getInvoice, markInvoiceSent } from "@/lib/invoices/data";
import { renderPdf } from "@/lib/pdf/render";
import { getBrandLogoDataUri } from "@/lib/pdf/assets";
import { InvoicePdf } from "@/components/pdf/invoice-pdf";
import { primaryClient } from "@/lib/jobs/pdf-helpers";
import { isSuppressed } from "@/lib/messaging/consent";
import { logMessage } from "@/lib/communications/data";
import { invoiceBalance } from "@/lib/invoices/types";
import { fromAddress } from "@/lib/email/from";

export class InvoiceSendError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Who the invoice would go to (the primary client's email unless `to`). */
export async function invoiceRecipient(jobId: string, to?: string | null): Promise<string> {
  const job = await getJob(jobId);
  if (!job) throw new InvoiceSendError("Job not found.", 404);
  const addr = (to || primaryClient(job)?.email || "").trim();
  if (!addr) throw new InvoiceSendError("No client email on file. Add a primary client with an email, or pass `to`.");
  return addr;
}

export async function sendInvoiceEmail(jobId: string, invoiceId: string, toOverride?: string | null): Promise<{ id: string | null; to: string }> {
  const [job, invoice, logo] = await Promise.all([getJob(jobId), getInvoice(invoiceId), getBrandLogoDataUri()]);
  if (!job || !invoice) throw new InvoiceSendError("Not found.", 404);

  const client = primaryClient(job);
  const to = (toOverride || client?.email || "").trim();
  if (!to) throw new InvoiceSendError("No client email on file. Add a primary client with an email, or pass `to`.");
  if (await isSuppressed("email", to)) throw new InvoiceSendError(`${to} has opted out of email.`, 409);

  const key = process.env.RESEND_API_KEY || process.env.RESEND_KEY;
  const from = fromAddress("noreply@constructedmatter.com");
  if (!key) throw new InvoiceSendError("Email not configured (RESEND_API_KEY).", 500);

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
  if (!res.ok) throw new InvoiceSendError(`Send failed: ${await res.text()}`, 502);
  const json = await res.json().catch(() => ({})) as { id?: string };

  await markInvoiceSent(invoiceId);
  await logMessage({
    direction: "outbound", channel: "email", contact_id: null,
    to_address: to, from_address: from, subject, body: html, status: "sent",
    project_id: null, quote_id: null, provider: "resend", provider_id: json.id ?? null,
    error_message: null, duration_seconds: null, recording_url: null, sent_at: new Date().toISOString(),
  }).catch(() => {});
  return { id: json.id ?? null, to };
}
