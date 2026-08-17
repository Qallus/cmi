import { redirect } from "next/navigation";
import { verifyClientJob } from "@/lib/client-portal/auth";
import { loadClientScheduleGroups } from "@/lib/client-portal/schedule";
import { fmtDate } from "../../../portal-ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Upcoming", ready: "Upcoming", scheduled: "Scheduled", confirmed: "Confirmed",
  in_progress: "In Progress", waiting: "On Hold", waiting_client: "Needs Your Input",
  waiting_vendor: "On Hold", waiting_material: "On Hold", waiting_inspection: "Awaiting Inspection",
  delayed: "Delayed", blocked: "On Hold", at_risk: "At Risk", complete: "Complete", cancelled: "Cancelled",
};

// Read-only client view of the job's schedule — only client-visible schedules
// and items; internal notes are never shown.
export default async function ClientSchedulePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const contact = await verifyClientJob(jobId);
  if (!contact) redirect("/client/jobs");
  const groups = await loadClientScheduleGroups(jobId).catch(() => []);

  if (!groups.length) {
    return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Your schedule will appear here once it&apos;s shared.</div>;
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.schedule_id} className="rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3"><h2 className="font-medium">{g.schedule_name}</h2></div>
          <ol className="divide-y divide-border">
            {g.items.map((it) => (
              <li key={it.id} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-1 shrink-0">{it.kind === "milestone" ? <span className="text-accent">◆</span> : <span className={`inline-block h-2 w-2 rounded-full ${it.status === "complete" ? "bg-success" : "bg-accent/50"}`} />}</span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${it.status === "complete" ? "text-muted-foreground line-through" : ""}`}>{it.title}</div>
                  {it.note ? <div className="text-xs text-muted-foreground">{it.note}</div> : null}
                  <div className="mt-0.5 text-xs text-muted-foreground">{fmtDate(it.start)}{it.end && it.end !== it.start ? ` → ${fmtDate(it.end)}` : ""}</div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{STATUS_LABEL[it.status ?? ""] ?? "Upcoming"}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
