import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { JobModuleShell } from "../job-module-shell";
import { ClientFeedList } from "@/components/jobs/client-feed-list";

export const metadata = { title: "Client Activity — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Everything the client sent on this job, newest first (replaces the old
// "coming soon" Activity placeholder).
export default async function JobActivityPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  return (
    <JobModuleShell jobId={jobId} jobName={job.job_name} active="activity" title="Client activity">
      <ClientFeedList jobId={jobId} />
    </JobModuleShell>
  );
}
