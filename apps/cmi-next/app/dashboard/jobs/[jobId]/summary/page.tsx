import { notFound } from "next/navigation";
import { getJob, getJobStats } from "@/lib/jobs/data";
import { JobSummaryClient } from "./job-summary-client";

export const metadata = { title: "Job Summary — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function JobSummaryPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const stats = await getJobStats(job);
  return <JobSummaryClient job={job} stats={stats} />;
}
