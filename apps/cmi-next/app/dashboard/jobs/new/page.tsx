import { loadJobTypes, loadJobGroups } from "@/lib/jobs/data";
import type { JobType, JobGroup } from "@/lib/jobs/types";
import { NewJobClient } from "./new-job-client";

export const metadata = { title: "New Job — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  let types: JobType[] = [];
  let groups: JobGroup[] = [];
  try {
    [types, groups] = await Promise.all([loadJobTypes(), loadJobGroups()]);
  } catch {
    // empty fallback
  }
  return <NewJobClient types={types} groups={groups} />;
}
