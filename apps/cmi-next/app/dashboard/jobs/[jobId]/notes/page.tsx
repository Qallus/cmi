import { notFound } from "next/navigation";
import Link from "next/link";
import { getJob } from "@/lib/jobs/data";
import { loadJobNotes } from "@/lib/job-notes/data";
import { JobDetailNav } from "../job-detail-nav";
import { JobNotesClient } from "./notes-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notes — CMI Dashboard" };

export default async function JobNotesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const notes = await loadJobNotes(job.id);

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <JobDetailNav jobId={job.id} active="notes" />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/jobs/${job.id}/summary`} className="text-xs text-muted-foreground hover:text-foreground">← {job.job_name}</Link>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Notes</h1>
          <span className="text-xs text-muted-foreground">Internal notes for this job</span>
        </div>
        <JobNotesClient jobId={job.id} initial={notes} />
      </div>
    </div>
  );
}
