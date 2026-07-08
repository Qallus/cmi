import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nextJobNumber } from "@/lib/jobs/numbering";
import type { Invoice, InvoiceDraft, InvoiceLineItem, InvoiceLineItemDraft } from "./types";

// Line items drive the invoice total; the header `amount` is kept in sync.
function computeAmount(items: InvoiceLineItemDraft[]): number {
  return items.reduce((s, it) => s + (Number(it.quantity ?? 1) * Number(it.unit_price ?? 0)), 0);
}

export async function loadInvoices(jobId: string): Promise<Invoice[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("invoices").select("*, line_items:invoice_line_items(*)").eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Invoice[];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("invoices").select("*, line_items:invoice_line_items(*)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const inv = data as Invoice;
  inv.line_items = (inv.line_items ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return inv;
}

export async function createInvoice(jobId: string, draft: InvoiceDraft, items: InvoiceLineItemDraft[], actor?: string | null): Promise<Invoice> {
  const sb = getSupabaseAdmin();
  const invoice_number = await nextJobNumber("invoices", "invoice_number", jobId, "INV");
  const amount = computeAmount(items);
  const { data, error } = await sb.from("invoices")
    .insert({ ...draft, job_id: jobId, invoice_number, amount, created_by: actor ?? null })
    .select().single();
  if (error) throw new Error(error.message);
  const invoice = data as Invoice;
  await replaceLineItems(invoice.id, items);
  return (await getInvoice(invoice.id))!;
}

export async function updateInvoice(id: string, patch: Partial<InvoiceDraft>, items?: InvoiceLineItemDraft[]): Promise<Invoice> {
  const sb = getSupabaseAdmin();
  const clean = { ...patch } as Record<string, unknown>;
  delete clean.invoice_number; delete clean.job_id;
  if (items) clean.amount = computeAmount(items);
  const { error } = await sb.from("invoices").update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  if (items) await replaceLineItems(id, items);
  return (await getInvoice(id))!;
}

async function replaceLineItems(invoiceId: string, items: InvoiceLineItemDraft[]): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  if (items.length === 0) return;
  const rows = items.map((it, i) => ({
    invoice_id: invoiceId, description: it.description ?? "", quantity: it.quantity ?? 1,
    unit_price: it.unit_price ?? 0, amount: Number(it.quantity ?? 1) * Number(it.unit_price ?? 0), sort_order: i,
  }));
  const { error } = await sb.from("invoice_line_items").insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("invoices").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markInvoiceSent(id: string): Promise<void> {
  await getSupabaseAdmin().from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "draft"); // only auto-advance drafts
}

export type { InvoiceLineItem };
