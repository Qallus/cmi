import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadDailyLogs } from "@/lib/daily-logs/data";
import { DailyLogsClient } from "./daily-logs-client";

export const metadata = { title: "Daily Logs — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function DailyLogsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const logs = await loadDailyLogs(jobId);
  return <DailyLogsClient jobId={jobId} jobName={job.job_name} initial={logs} />;
}
