import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadClientChangeOrders } from "@/lib/client-portal/data";
import { money, fmtDate, humanize } from "../../../portal-ui";

export const dynamic = "force-dynamic";

export default async function ClientChangeOrdersPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const cos = await loadClientChangeOrders(jobId);

  if (cos.length === 0) return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No change orders have been shared yet.</div>;
  return (
    <div className="space-y-3">
      {cos.map((co) => (
        <div key={co.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{co.co_number}</span>
              <span className="font-medium">{co.title}</span>
              <Badge tone={co.status === "approved" ? "success" : co.status === "rejected" ? "danger" : "info"}>{humanize(co.status)}</Badge>
            </div>
            <span className="font-semibold">{money(co.amount)}</span>
          </div>
          {co.description && <p className="mt-2 text-sm text-muted-foreground">{co.description}</p>}
          <div className="mt-2 text-xs text-muted-foreground">{co.approved_date ? `Approved ${fmtDate(co.approved_date)}` : co.co_date ? fmtDate(co.co_date) : ""}</div>
        </div>
      ))}
    </div>
  );
}
