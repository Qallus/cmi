import { loadTemplates, loadJobTypes, loadJobGroups } from "@/lib/jobs/data";
import type { Job, JobType, JobGroup } from "@/lib/jobs/types";
import { NewFromTemplateClient } from "./new-from-template-client";

export const metadata = { title: "New Job From Template — CMI Dashboard" };
export const dynamic = "force-dynamic";

export default async function NewFromTemplatePage() {
  let templates: Job[] = [];
  let types: JobType[] = [];
  let groups: JobGroup[] = [];
  try {
    [templates, types, groups] = await Promise.all([loadTemplates(), loadJobTypes(), loadJobGroups()]);
  } catch {
    // empty fallback
  }
  return <NewFromTemplateClient templates={templates} types={types} groups={groups} />;
}
