import { notFound } from "next/navigation";
import { getJob } from "@/lib/jobs/data";
import { loadJobSelections } from "@/lib/job-selections/data";
import { loadSelectionFormOptions } from "@/lib/selections/data";
import { commentSummaries } from "@/lib/selection-comments/data";
import { StaffSelectionsClient } from "./selections-client";

export const metadata = { title: "Selections — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function StaffJobSelectionsPage({ params, searchParams }: {
  params: Promise<{ jobId: string }>;
  /** ?sel=<id>&comments=1 opens that selection's comments (the bell and email link here). */
  searchParams: Promise<{ sel?: string; comments?: string }>;
}) {
  const { jobId } = await params;
  const { sel, comments } = await searchParams;
  const job = await getJob(jobId);
  if (!job) notFound();
  // The editor is the same as the Selections page's, so it needs the same pick lists.
  const [selections, options] = await Promise.all([loadJobSelections(jobId), loadSelectionFormOptions().catch(() => null)]);
  const summaries = await commentSummaries(jobId, selections).catch(() => ({}));
  return <StaffSelectionsClient jobId={jobId} jobName={job.job_name} initial={selections}
    commentSummaries={summaries} openSelectionId={sel ?? null} openComments={comments === "1"}
    products={options?.products ?? []}
    formData={{ projects: options?.projects ?? [], contacts: options?.contacts ?? [], subcontractors: options?.subcontractors ?? [], staffUsers: options?.staffUsers ?? [], tasks: options?.tasks ?? [],
      // Library groups plus this job's own (a group's sublabel is its job id).
      groups: (options?.groups ?? []).filter((g) => !g.sublabel || g.sublabel === jobId) }} />;
}
