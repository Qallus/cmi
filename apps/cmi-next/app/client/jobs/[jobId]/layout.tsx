import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession, assertJobAccess, ClientAuthError } from "@/lib/client-portal/auth";
import { getClientJob } from "@/lib/client-portal/data";
import { ClientStatusBadge, ProgressBar } from "../../portal-ui";
import { PortalSidebar, RegisterJobNav } from "../../portal-nav";
import { hasClientPunchLists } from "@/lib/punch/data";
import { clientCan, clientCanSubmitWarranty } from "@/lib/client-portal/permissions";

export const dynamic = "force-dynamic";

// Which tabs a client sees depends on their per-job permissions + job status.
function tabsFor(job: { status: string; permissions: Record<string, boolean> }, hasPunch: boolean) {
  const p = job.permissions;
  const tabs = [
    { slug: "overview", label: "Overview" },
    { slug: "updates", label: "Updates" },
    { slug: "progress", label: "Progress" },
  ];
  if (clientCan(p, "schedule_items")) tabs.push({ slug: "schedule", label: "Schedule" }, { slug: "milestones", label: "Milestones" });
  if (clientCan(p, "photos")) tabs.push({ slug: "photos", label: "Photos" });
  if (clientCan(p, "files")) tabs.push({ slug: "documents", label: "Documents" });
  if (clientCan(p, "locked_selections")) tabs.push({ slug: "selections", label: "Selections" });
  tabs.push({ slug: "action-items", label: "Action Items" });
  // Only when staff have shared at least one punch list on this job.
  if (hasPunch) tabs.push({ slug: "punch-list", label: "Punch List" });
  if (clientCan(p, "price_summary") || clientCan(p, "invoices")) tabs.push({ slug: "financials", label: "Financials" });
  tabs.push({ slug: "change-orders", label: "Change Orders" });
  if (clientCan(p, "messages")) tabs.push({ slug: "messages", label: "Messages" });
  if (clientCanSubmitWarranty(p, job.status)) tabs.push({ slug: "warranty", label: "Warranty" });
  return tabs;
}

export default async function ClientJobLayout({ children, params }: { children: ReactNode; params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const session = await getClientSession();
  if (!session) redirect("/client/login");
  try {
    await assertJobAccess(session.contact.id, jobId);
  } catch (err) {
    if (err instanceof ClientAuthError) redirect("/client/jobs");
    throw err;
  }
  const job = await getClientJob(session.contact.id, jobId);
  if (!job) redirect("/client/jobs");
  const hasPunch = await hasClientPunchLists(jobId).catch(() => false);

  const tabs = tabsFor(job, hasPunch);
  // Desktop: the project's pages down the left (lined up with the logo), the
  // project header and page on the right. Phone: the hamburger and the footer
  // bar carry the same pages.
  return (
    <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <RegisterJobNav jobId={jobId} jobName={job.job_name} tabs={tabs} />
      <PortalSidebar jobId={jobId} tabs={tabs} />
      <div className="min-w-0">
        <Link href="/client/jobs" className="text-xs text-muted-foreground hover:text-foreground">← My Projects</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{job.job_name}</h1>
              <ClientStatusBadge status={job.status} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{job.job_number ?? ""}</span>
              {job.full_address && <span>{job.full_address}</span>}
              {job.project_managers.length > 0 && <span>PM: {job.project_managers.join(", ")}</span>}
            </div>
          </div>
          <div className="w-full sm:max-w-[16rem]"><ProgressBar percent={job.progress_percentage} /></div>
        </div>
        <div className="mt-6 border-t border-border pt-6">{children}</div>
      </div>
    </div>
  );
}
