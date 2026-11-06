import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession, assertJobAccess, ClientAuthError } from "@/lib/client-portal/auth";
import { getClientJob } from "@/lib/client-portal/data";
import { ClientStatusBadge, ProgressBar } from "../../portal-ui";
import { RegisterJobNav } from "../../portal-nav";
import { hasClientPunchLists } from "@/lib/punch/data";
import { clientTabsFor } from "@/lib/client-portal/tabs";

export const dynamic = "force-dynamic";


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

  const tabs = clientTabsFor(job, hasPunch);
  // The shell draws the menus (sidebar, phone menu, footer); this tells it
  // which project they're for. They stay on every portal page after this.
  return (
    <>
      <RegisterJobNav jobId={jobId} jobName={job.job_name} tabs={tabs} />
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
    </>
  );
}
