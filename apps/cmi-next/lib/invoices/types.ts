export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "void";

export type InvoiceLineItem = {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  sort_order: number | null;
};

export type Invoice = {
  id: string;
  job_id: string;
  invoice_number: string | null;
  title: string | null;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  amount: number | null;
  amount_paid: number | null;
  notes: string | null;
  sent_at: string | null;
  client_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  line_items?: InvoiceLineItem[];
};

export type InvoiceLineItemDraft = { description: string; quantity?: number; unit_price?: number };
export type InvoiceDraft = Partial<Omit<Invoice, "id" | "invoice_number" | "created_at" | "updated_at" | "line_items">> & { title?: string | null };

export const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "partial", "paid", "overdue", "void"];

export function invoiceBalance(inv: Pick<Invoice, "amount" | "amount_paid">): number {
  return (inv.amount ?? 0) - (inv.amount_paid ?? 0);
}
