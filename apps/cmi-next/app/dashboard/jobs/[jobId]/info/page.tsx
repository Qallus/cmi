import { notFound } from "next/navigation";
import { getJob, loadJobTypes, loadJobGroups } from "@/lib/jobs/data";
import { inspectionsEnabled, loadJurisdictions } from "@/lib/inspections/data";
import { JobInfoClient } from "./job-info-client";

export const metadata = { title: "Job Info — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function JobInfoPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const [job, types, groups, inspectionsOn] = await Promise.all([getJob(jobId), loadJobTypes(), loadJobGroups(), inspectionsEnabled()]);
  if (!job) notFound();
  // Inspection profile (jurisdiction, scope, conditions) only when inspection_milestones is on.
  const jurisdictions = inspectionsOn ? await loadJurisdictions() : [];
  return <JobInfoClient job={job} types={types} groups={groups} inspections={inspectionsOn ? { jurisdictions } : null} />;
}
