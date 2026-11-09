import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadJobSelections } from "@/lib/job-selections/data";
import { loadSelectionFormOptions } from "@/lib/selections/data";
import { StaffSelectionsClient } from "./selections-client";

export const metadata = { title: "Selections — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function StaffJobSelectionsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  // The editor is the same as the Selections page's, so it needs the same pick lists.
  const [selections, options] = await Promise.all([loadJobSelections(jobId), loadSelectionFormOptions().catch(() => null)]);
  return <StaffSelectionsClient jobId={jobId} jobName={job.job_name} initial={selections}
    products={options?.products ?? []}
    formData={{ projects: options?.projects ?? [], contacts: options?.contacts ?? [], subcontractors: options?.subcontractors ?? [], staffUsers: options?.staffUsers ?? [], tasks: options?.tasks ?? [],
      // Library groups plus this job's own (a group's sublabel is its job id).
      groups: (options?.groups ?? []).filter((g) => !g.sublabel || g.sublabel === jobId) }} />;
}
