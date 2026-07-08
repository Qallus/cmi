import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadJobFiles } from "@/lib/job-files/data";
import { FilesClient } from "./files-client";

export const metadata = { title: "Files — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function FilesPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const files = await loadJobFiles(jobId);
  return <FilesClient jobId={jobId} jobName={job.job_name} initial={files} />;
}
