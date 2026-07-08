import { redirect } from "next/navigation";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadClientUpdates } from "@/lib/client-portal/data";
import { fmtDate, humanize } from "../../../portal-ui";

export const dynamic = "force-dynamic";

export default async function ClientUpdatesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const updates = await loadClientUpdates(jobId);

  if (updates.length === 0) return <Empty>No updates have been shared yet.</Empty>;
  return (
    <div className="space-y-4">
      {updates.map((u) => (
        <div key={u.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-medium">{u.title}</h2>
              {u.update_type && u.update_type !== "general" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{humanize(u.update_type)}</span>}
              {u.client_action_required && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">Action needed</span>}
            </div>
            <span className="text-xs text-muted-foreground">{fmtDate(u.created_at)}</span>
          </div>
          {u.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{u.body}</p>}
          {u.posted_by && <div className="mt-2 text-[11px] text-muted-foreground">Posted by {u.posted_by}</div>}
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
