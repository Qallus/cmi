import { notFound } from "next/navigation";
import { getJob, getJobStats } from "@/lib/jobs/data";
import { getSessionStaff } from "@/lib/auth/server-session";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "@/lib/projections/access";
import { loadJobForecast, type JobForecast } from "@/lib/projections/data";
import { JobSummaryClient } from "./job-summary-client";

export const metadata = { title: "Job Summary — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function JobSummaryPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) notFound();
  const stats = await getJobStats(job);
  // Forecast card: financial data, loaded only for Admin / Super Admin with the
  // Projections flag on. Everyone else gets no card and no data.
  let forecast: JobForecast | null = null;
  const staff = await getSessionStaff();
  if (staff && canUseProjections(staff.role_slug) && (await isFeatureEnabled(PROJECTIONS_FLAG))) {
    forecast = await loadJobForecast(job.id).catch(() => null);
  }
  return <JobSummaryClient job={job} stats={stats} forecast={forecast} />;
}
