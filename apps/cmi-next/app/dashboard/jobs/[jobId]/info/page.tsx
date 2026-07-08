import { notFound } from "next/navigation";
import { getJob, loadJobTypes, loadJobGroups } from "@/lib/jobs/data";
import { JobInfoClient } from "./job-info-client";

export const metadata = { title: "Job Info — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function JobInfoPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const [job, types, groups] = await Promise.all([getJob(jobId), loadJobTypes(), loadJobGroups()]);
  if (!job) notFound();
  return <JobInfoClient job={job} types={types} groups={groups} />;
}
