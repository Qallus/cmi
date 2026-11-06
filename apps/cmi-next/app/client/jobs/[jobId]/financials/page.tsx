import { redirect } from "next/navigation";
import { verifyClientJob, getJobPerms } from "@/lib/client-portal/auth";
import { loadClientFinancials } from "@/lib/client-portal/data";
import { money, fmtDate, humanize } from "../../../portal-ui";
import { clientCan } from "@/lib/client-portal/permissions";

export const dynamic = "force-dynamic";

export default async function ClientFinancialsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const perms = await getJobPerms(contact.id, jobId);
  if (!clientCan(perms, "price_summary") && !clientCan(perms, "invoices")) redirect(`/client/jobs/${jobId}`);
  const fin = await loadClientFinancials(jobId, perms);

  return (
    <div className="space-y-6">
      {fin.show_price_summary && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Price Summary</h2>
          <Row label="Contract Price" value={money(fin.contract_price)} />
          <Row label="Approved Change Orders" value={money(fin.approved_change_orders_total)} />
          <div className="mt-2 flex items-center justify-between border-t-2 border-border pt-2"><span className="font-semibold">Total Contract Value</span><span className="text-lg font-semibold">{money(fin.contract_price + fin.approved_change_orders_total)}</span></div>
        </div>
      )}

      {fin.show_invoices && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Invoices</h2>
          {fin.invoices.length === 0 ? <div className="text-sm text-muted-foreground">No invoices shared yet.</div> : (
            <>
              {/* Phones: one card per invoice. */}
              <ul className="space-y-3 sm:hidden">
                {fin.invoices.map((inv) => (
                  <li key={inv.invoice_number} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{inv.invoice_number}</span>
                      <span className="text-xs text-muted-foreground">{humanize(inv.status)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Issued</span><span className="text-right">{fmtDate(inv.issue_date)}</span>
                      <span className="text-muted-foreground">Due</span><span className="text-right">{fmtDate(inv.due_date)}</span>
                      <span className="text-muted-foreground">Amount</span><span className="text-right">{money(inv.amount)}</span>
                      <span className="text-muted-foreground">Paid</span><span className="text-right">{money(inv.amount_paid)}</span>
                      {fin.show_balance && <><span className="text-muted-foreground">Balance</span><span className="text-right font-medium">{money(Number(inv.amount ?? 0) - Number(inv.amount_paid ?? 0))}</span></>}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="py-1.5">Invoice</th><th>Date</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th>{fin.show_balance && <th className="text-right">Balance</th>}<th className="pl-3">Status</th></tr></thead>
                  <tbody>
                    {fin.invoices.map((inv) => (
                      <tr key={inv.invoice_number} className="border-b border-border last:border-0">
                        <td className="py-2 font-mono text-xs">{inv.invoice_number}</td>
                        <td>{fmtDate(inv.issue_date)}</td>
                        <td>{fmtDate(inv.due_date)}</td>
                        <td className="text-right">{money(inv.amount)}</td>
                        <td className="text-right">{money(inv.amount_paid)}</td>
                        {fin.show_balance && <td className="text-right font-medium">{money(Number(inv.amount ?? 0) - Number(inv.amount_paid ?? 0))}</td>}
                        <td className="pl-3">{humanize(inv.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 py-1 text-sm"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}
