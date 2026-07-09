import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadJobSelections } from "@/lib/job-selections/data";
import { StaffSelectionsClient } from "./selections-client";

export const metadata = { title: "Selections — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function StaffJobSelectionsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const selections = await loadJobSelections(jobId);
  return <StaffSelectionsClient jobId={jobId} jobName={job.job_name} initial={selections} />;
}
