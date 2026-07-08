import { loadJobList, loadJobTypes, loadJobGroups } from "@/lib/jobs/data";
import { computeJobReport } from "@/lib/jobs/reporting";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobType, JobGroup } from "@/lib/jobs/types";
import { JobsListClient } from "./jobs-list-client";

export const metadata = { title: "Jobs — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  let rows: JobListRow[] = [];
  let types: JobType[] = [];
  let groups: JobGroup[] = [];
  try {
    [rows, types, groups] = await Promise.all([loadJobList(), loadJobTypes(), loadJobGroups()]);
  } catch {
    // empty fallback
  }
  const report = computeJobReport(rows, new Date().toISOString().slice(0, 10));
  return <JobsListClient initialRows={rows} types={types} groups={groups} report={report} />;
}
