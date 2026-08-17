import { notFound } from "next/navigation";
import Link from "next/link";
import { getJob } from "@/lib/jobs/data";
import { loadProjectManagerData } from "@/lib/project-manager/data";
import { getDemoProjectManagerData } from "@/lib/project-manager/demo-data";
import { ProjectManagerClient } from "@/app/dashboard/project-manager/project-manager-client";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects & Tasks — CMI Dashboard" };

// The job's Project Manager board (projects + tasks), scoped by board_id = job.id.
// Formerly lived at /schedule; moved here so /schedule hosts the Multi-Schedule
// Builder (see Option A in the scheduling gameplan).
export default async function JobProjectsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();

  let data;
  let demoMode = false;
  try {
    data = await loadProjectManagerData(job.id);
  } catch {
    data = getDemoProjectManagerData();
    demoMode = true;
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="projects" />
      <div className="flex-1 overflow-auto">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 md:px-6">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Projects &amp; Tasks</h1>
          <span className="text-xs text-muted-foreground">Project Manager board for this job</span>
        </div>
        <ProjectManagerClient initialData={data} boardId={job.id} demoMode={demoMode} />
      </div>
    </div>
  );
}
