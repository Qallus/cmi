"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PriceSummary } from "@/lib/jobs/types";
import { money, formatDate } from "../../job-ui";
import { JobDetailNav } from "../job-detail-nav";

// Printable job price summary. `print:hidden` hides app chrome (nav/header set in
// the dashboard layout + the controls here) so the printout is client-ready.
export function PriceSummaryClient({ summary, client }: { summary: PriceSummary; client: { name: string; email: string; phone: string | null } | null }) {
  const [showChangeOrders, setShowChangeOrders] = React.useState(true);
  const [showInvoices, setShowInvoices] = React.useState(true);
  const job = summary.job;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="print:hidden">
        <JobDetailNav jobId={job.id} active="price-summary" />
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Controls (hidden when printing) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={showChangeOrders} onChange={(e) => setShowChangeOrders(e.target.checked)} /> Show approved change orders</label>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={showInvoices} onChange={(e) => setShowInvoices(e.target.checked)} /> Show invoices</label>
            <a href={`/api/jobs/${job.id}/price-summary/pdf`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"><Download className="h-3.5 w-3.5" /> Download PDF</a>
            <Button size="sm" variant="accent" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print</Button>
          </div>
        </div>

        {/* Printable sheet */}
        <div className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-6 print:border-0 print:shadow-none">
        {/* Branding */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <div className="font-display text-xl font-semibold">Constructed Matter, Inc.</div>
            <div className="text-xs text-muted-foreground">AZ ROC KB-1 #343120</div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold">Job Price Summary</div>
            <div className="text-xs text-muted-foreground">Generated {formatDate(new Date().toISOString())}</div>
          </div>
        </div>

        {/* Client + job */}
        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Client</div>
            <div className="text-sm">{client?.name ?? "—"}</div>
            {client?.email && <div className="text-xs text-muted-foreground">{client.email}</div>}
            {client?.phone && <div className="text-xs text-muted-foreground">{client.phone}</div>}
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Job</div>
            <div className="text-sm">{job.job_name}</div>
            <div className="font-mono text-xs text-muted-foreground">{job.job_number ?? "—"}</div>
            {job.full_address && <div className="text-xs text-muted-foreground">{job.full_address}</div>}
          </div>
        </div>

        {/* Contract subtotal */}
        <Row label="Contract Price" value={money(summary.contract_price)} bold />

        {/* Approved change orders */}
        {showChangeOrders && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Approved Change Orders</div>
            {summary.change_orders.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">No approved change orders.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-1.5">Title</th><th>Date</th><th className="text-right">Price</th><th>Status</th></tr></thead>
                <tbody>{summary.change_orders.map((c, i) => (<tr key={i} className="border-b border-border"><td className="py-1.5">{c.title}</td><td>{formatDate(c.date)}</td><td className="text-right">{money(c.price)}</td><td>{c.status}</td></tr>))}</tbody>
              </table>
            )}
            <Row label="Approved Change Orders Total" value={money(summary.approved_change_orders_total)} />
          </div>
        )}

        {/* Invoices */}
        {showInvoices && (
          <div className="mt-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoices</div>
            {summary.invoices.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">No invoices yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-1.5">Invoice</th><th>Date</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
                <tbody>{summary.invoices.map((inv, i) => (<tr key={i} className="border-b border-border"><td className="py-1.5">{inv.number}</td><td>{formatDate(inv.date)}</td><td>{formatDate(inv.due_date)}</td><td className="text-right">{money(inv.amount)}</td><td className="text-right">{money(inv.paid)}</td><td className="text-right">{money(inv.balance)}</td><td>{inv.status}</td></tr>))}</tbody>
              </table>
            )}
          </div>
        )}

        {/* Grand total */}
        <div className="mt-4 border-t-2 border-border pt-2">
          <Row label="Total Contract Value" value={money(summary.grand_total)} bold big />
        </div>

        <p className="mt-6 text-[11px] text-muted-foreground print:hidden">
          Change orders and invoices are placeholders until those modules are connected; the contract price already drives the total.
        </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, big }: { label: string; value: string; bold?: boolean; big?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`${bold ? "font-semibold" : ""} ${big ? "text-lg" : ""}`}>{value}</span>
    </div>
  );
}
