import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Construction } from "lucide-react";
import { getJob } from "@/lib/jobs/data";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";

// Job-scoped modules. Slugs that map to a shipped feature link out; the rest are
// scaffolded "Coming soon" so the job's sub-nav feels complete while the deep
// construction modules are built.
const LINKED: Record<string, { label: string; href: string; blurb: string }> = {
  schedule: { label: "Schedule", href: "/dashboard/project-manager", blurb: "Job scheduling lives in the Project Manager (Gantt board)." },
  warranty: { label: "Warranty", href: "/dashboard/sales?tab=opportunities", blurb: "Warranty requests are tracked in the Sales pipeline / warranty area." },
  messages: { label: "Messages", href: "/dashboard/communications", blurb: "Messaging is handled in Communications." },
};
// change-orders, invoices, daily-logs, and files are now concrete routes and
// take precedence over this catch-all; the rest remain scaffolded.
const COMING_SOON: Record<string, string> = {
  tasks: "Tasks", photos: "Photos", "purchase-orders": "Purchase Orders", activity: "Activity",
};

export default async function JobModulePage({ params }: { params: Promise<{ jobId: string; module: string }> }) {
  const { jobId, module } = await params;
  const linked = LINKED[module];
  const soon = COMING_SOON[module];
  if (!linked && !soon) notFound();

  const job = await getJob(jobId);
  if (!job) notFound();
  const title = linked?.label ?? soon;

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="border-b border-border bg-card px-4 pt-4 md:px-6">
        <Link href={`/dashboard/jobs/${jobId}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
        <h1 className="mb-3 mt-1 font-display text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <JobDetailNav jobId={jobId} active={module} />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
          {linked ? (
            <>
              <div className="text-sm text-muted-foreground">{linked.blurb}</div>
              <Link href={linked.href} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
                Open {linked.label} <ArrowUpRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">Deep linking this tool to the specific job is a planned enhancement.</p>
            </>
          ) : (
            <>
              <Construction className="mx-auto h-8 w-8 text-accent" />
              <div className="mt-3 text-sm font-medium">{title} — coming soon</div>
              <p className="mt-1 text-xs text-muted-foreground">This job module is scaffolded and will be connected to live data in a later phase.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
