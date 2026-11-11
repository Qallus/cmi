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
  // Active jurisdictions, plus this job's own if it has since been retired.
  const jurisdictions = inspectionsOn ? await loadJurisdictions({ keep: job.jurisdiction_code ?? null }) : [];
  return <JobInfoClient job={job} types={types} groups={groups} inspections={inspectionsOn ? { jurisdictions } : null} />;
}
