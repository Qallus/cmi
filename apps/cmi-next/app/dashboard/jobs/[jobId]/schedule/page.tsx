import { notFound } from "next/navigation";
import Link from "next/link";
import { getJob } from "@/lib/jobs/data";
import { loadProjectManagerData } from "@/lib/project-manager/data";
import { getDemoProjectManagerData } from "@/lib/project-manager/demo-data";
import { ProjectManagerClient } from "@/app/dashboard/project-manager/project-manager-client";
import { JobDetailNav } from "../job-detail-nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Project Manager — CMI Dashboard" };

// The job's Project Manager: the same PM UI (Gantt / table / list / calendar /
// Kanban), scoped to this job by using board_id = job.id. Projects and tasks
// created here belong to this job. Standalone projects still live on the default
// board at /dashboard/project-manager.
export default async function JobSchedulePage({ params }: { params: Promise<{ jobId: string }> }) {
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
      <JobDetailNav jobId={job.id} active="schedule" />
      <div className="flex-1 overflow-auto">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-4 md:px-6">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Project Manager</h1>
          <span className="text-xs text-muted-foreground">Projects &amp; tasks for this job</span>
        </div>
        <ProjectManagerClient initialData={data} boardId={job.id} demoMode={demoMode} />
      </div>
    </div>
  );
}
