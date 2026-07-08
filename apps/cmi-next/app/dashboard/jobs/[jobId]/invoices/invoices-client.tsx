"use client";

import * as React from "react";
import { Download, Plus, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input, Textarea } from "@/components/ui/input";
import { INVOICE_STATUSES, invoiceBalance } from "@/lib/invoices/types";
import type { Invoice, InvoiceStatus } from "@/lib/invoices/types";
import { JobModuleShell, ModuleModal, Field, inputCls, money, fmtDate } from "../job-module-shell";

const TONES: Record<InvoiceStatus, "default" | "warning" | "info" | "success" | "danger"> = {
  draft: "default", sent: "info", partial: "warning", paid: "success", overdue: "danger", void: "default",
};
type LineItem = { description: string; quantity: number; unit_price: number };
type Modal = { mode: "add" } | { mode: "edit"; inv: Invoice } | null;

export function InvoicesClient({ jobId, jobName, initial, hasClientEmail }: { jobId: string; jobName: string; initial: Invoice[]; hasClientEmail: boolean }) {
  const [rows, setRows] = React.useState<Invoice[]>(initial);
  const [modal, setModal] = React.useState<Modal>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sendingId, setSendingId] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<string | null>(null);

  const [head, setHead] = React.useState({ title: "", status: "draft" as InvoiceStatus, issue_date: "", due_date: "", amount_paid: "", notes: "", client_visible: false });
  const [items, setItems] = React.useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);
  const computed = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  function openAdd() {
    setHead({ title: "", status: "draft", issue_date: new Date().toISOString().slice(0, 10), due_date: "", amount_paid: "", notes: "", client_visible: false });
    setItems([{ description: "", quantity: 1, unit_price: 0 }]); setError(null); setModal({ mode: "add" });
  }
  function openEdit(inv: Invoice) {
    setHead({ title: inv.title ?? "", status: inv.status, issue_date: inv.issue_date ?? "", due_date: inv.due_date ?? "", amount_paid: inv.amount_paid?.toString() ?? "", notes: inv.notes ?? "", client_visible: inv.client_visible });
    setItems((inv.line_items ?? []).length ? inv.line_items!.map((l) => ({ description: l.description, quantity: Number(l.quantity ?? 1), unit_price: Number(l.unit_price ?? 0) })) : [{ description: "", quantity: 1, unit_price: 0 }]);
    setError(null); setModal({ mode: "edit", inv });
  }
  function setItem(i: number, patch: Partial<LineItem>) { setItems((it) => it.map((x, idx) => (idx === i ? { ...x, ...patch } : x))); }

  async function save() {
    setSaving(true); setError(null);
    try {
      const line_items = items.filter((it) => it.description.trim() || it.unit_price);
      const payload = { ...head, amount_paid: head.amount_paid ? Number(head.amount_paid) : 0, issue_date: head.issue_date || null, due_date: head.due_date || null, line_items };
      const url = modal?.mode === "add" ? `/api/jobs/${jobId}/invoices` : `/api/jobs/${jobId}/invoices/${(modal as { inv: Invoice }).inv.id}`;
      const res = await fetch(url, { method: modal?.mode === "add" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setRows((r) => (modal?.mode === "add" ? [j, ...r] : r.map((x) => (x.id === j.id ? j : x))));
      setModal(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed."); } finally { setSaving(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/jobs/${jobId}/invoices/${id}`, { method: "DELETE" });
    if (res.ok || res.status === 204) setRows((r) => r.filter((x) => x.id !== id));
  }
  async function send(inv: Invoice) {
    setSendingId(inv.id); setFlash(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/invoices/${inv.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await res.json(); if (!res.ok) throw new Error(j.error);
      setFlash(`Invoice ${inv.invoice_number} emailed to ${j.to}.`);
      setRows((r) => r.map((x) => (x.id === inv.id ? { ...x, status: x.status === "draft" ? "sent" : x.status } : x)));
    } catch (e) { setFlash(e instanceof Error ? e.message : "Send failed."); } finally { setSendingId(null); }
  }

  return (
    <JobModuleShell jobId={jobId} jobName={jobName} active="invoices" title="Invoices"
      action={<Button size="sm" variant="accent" onClick={openAdd}><Plus className="h-3.5 w-3.5" /> Add Invoice</Button>}>
      {flash && <div className="mb-3 rounded-md bg-muted px-3 py-2 text-sm">{flash}</div>}
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead className="bg-card"><tr className="border-b border-border text-left">
          {["Invoice", "Title", "Amount", "Paid", "Balance", "Status", "Due", ""].map((h) => <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No invoices yet.</td></tr>}
          {rows.map((inv) => (
            <tr key={inv.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.invoice_number}</td>
              <td className="px-4 py-3 font-medium">{inv.title || "—"}</td>
              <td className="px-4 py-3">{money(inv.amount)}</td>
              <td className="px-4 py-3 text-muted-foreground">{money(inv.amount_paid)}</td>
              <td className="px-4 py-3 font-medium">{money(invoiceBalance(inv))}</td>
              <td className="px-4 py-3"><Badge tone={TONES[inv.status]}>{inv.status}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.due_date)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <a href={`/api/jobs/${jobId}/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" title="Download PDF" className="text-muted-foreground hover:text-foreground"><Download className="h-4 w-4" /></a>
                  <button type="button" title="Send to client" disabled={!hasClientEmail || sendingId === inv.id} onClick={() => void send(inv)} className="text-muted-foreground hover:text-accent disabled:opacity-40"><Send className="h-4 w-4" /></button>
                  <button type="button" onClick={() => openEdit(inv)} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                  <button type="button" onClick={() => void remove(inv.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!hasClientEmail && <p className="mt-2 text-xs text-muted-foreground">Add a primary client with an email (Job Info → Clients) to enable “Send to client.”</p>}

      {modal && (
        <ModuleModal title={modal.mode === "add" ? "Add Invoice" : `Edit ${modal.inv.invoice_number}`} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2"><input className={inputCls} value={head.title} onChange={(e) => setHead({ ...head, title: e.target.value })} /></Field>
              <Field label="Status"><Select value={head.status} onChange={(e) => setHead({ ...head, status: e.target.value as InvoiceStatus })}>{INVOICE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
              <Field label="Amount Paid ($)"><input type="number" className={inputCls} value={head.amount_paid} onChange={(e) => setHead({ ...head, amount_paid: e.target.value })} /></Field>
              <Field label="Issue Date"><Input type="date" value={head.issue_date} onChange={(e) => setHead({ ...head, issue_date: e.target.value })} /></Field>
              <Field label="Due Date"><Input type="date" value={head.due_date} onChange={(e) => setHead({ ...head, due_date: e.target.value })} /></Field>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Line Items</span><button type="button" onClick={() => setItems((it) => [...it, { description: "", quantity: 1, unit_price: 0 }])} className="text-xs text-accent hover:underline">+ Add line</button></div>
              <div className="space-y-2">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={`${inputCls} flex-1`} placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                    <input type="number" className={`${inputCls} w-16`} placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
                    <input type="number" className={`${inputCls} w-24`} placeholder="Unit $" value={it.unit_price} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} />
                    <span className="w-24 text-right text-sm">{money(it.quantity * it.unit_price)}</span>
                    <button type="button" onClick={() => setItems((x) => x.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-sm font-semibold">Total: {money(computed)}</div>
            </div>

            <Field label="Notes"><Textarea value={head.notes} onChange={(e) => setHead({ ...head, notes: e.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={head.client_visible} onChange={(e) => setHead({ ...head, client_visible: e.target.checked })} /> Visible to client</label>
            <div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button size="sm" variant="accent" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
          </div>
        </ModuleModal>
      )}
    </JobModuleShell>
  );
}
