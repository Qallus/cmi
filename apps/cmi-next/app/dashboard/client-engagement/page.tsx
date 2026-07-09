import Link from "next/link";
import { loadEngagementReport } from "@/lib/client-portal/reporting";
import type { EngagementReport } from "@/lib/client-portal/reporting";

export const metadata = { title: "Client Engagement — CMI Dashboard" };
export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

export default async function ClientEngagementPage() {
  let report: EngagementReport;
  try { report = await loadEngagementReport(); }
  catch { report = { totals: { portal_jobs: 0, pending_approvals: 0, open_action_items: 0, unread_messages: 0, open_warranty: 0, jobs_missing_updates: 0 }, warranty_by_status: {}, jobs: [] }; }
  const t = report.totals;

  const tiles = [
    { label: "Portal Jobs", value: t.portal_jobs },
    { label: "Pending Approvals", value: t.pending_approvals },
    { label: "Open Action Items", value: t.open_action_items },
    { label: "Unread Client Msgs", value: t.unread_messages },
    { label: "Open Warranty", value: t.open_warranty },
    { label: "Missing Updates", value: t.jobs_missing_updates },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Client Portal</div>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Client Engagement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Where clients need attention across all portal-enabled jobs.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-border bg-card px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{tile.label}</div>
            <div className="mt-0.5 text-xl font-semibold">{tile.value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-card"><tr className="border-b border-border text-left">
            {["Job", "Last Client Login", "Last Update", "Approvals", "Actions", "Unread", "Warranty", ""].map((h) => <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {report.jobs.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No portal-enabled jobs yet.</td></tr>}
            {report.jobs.map((j) => (
              <tr key={j.id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><div className="font-medium">{j.job_name}</div><div className="font-mono text-[11px] text-muted-foreground">{j.job_number}</div></td>
                <td className="px-4 py-3 text-muted-foreground">{fmt(j.last_client_login)}</td>
                <td className={`px-4 py-3 ${j.stale ? "text-destructive" : "text-muted-foreground"}`}>{fmt(j.last_client_update_at)}{j.stale && " ⚠"}</td>
                <td className="px-4 py-3">{cell(j.pending_approvals)}</td>
                <td className="px-4 py-3">{cell(j.open_action_items)}</td>
                <td className="px-4 py-3">{cell(j.unread_messages)}</td>
                <td className="px-4 py-3">{cell(j.open_warranty)}</td>
                <td className="px-4 py-3"><Link href={`/dashboard/jobs/${j.id}/client-portal`} className="text-xs font-medium text-accent hover:underline">Manage →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cell(n: number) {
  return n > 0 ? <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent/15 px-1.5 text-xs font-semibold text-accent">{n}</span> : <span className="text-muted-foreground">—</span>;
}
