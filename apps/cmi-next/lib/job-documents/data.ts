import { getSupabaseAdmin } from "@/lib/supabase/server";

// Documents generated for a job. The `documents` table links to a job by project
// name (text), not a job_id FK — same match getJobStats uses — so we surface the
// SOWs / Quotes / Contracts / etc. authored for this job's project.
export type JobDocument = {
  id: string;
  type: string | null;
  title: string | null;
  status: string | null;
  date: string | null;
  value: number | null;
  client: string | null;
};

export async function loadJobDocuments(jobName: string | null | undefined): Promise<JobDocument[]> {
  const name = (jobName ?? "").trim();
  if (!name) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("documents")
    .select("id, type, title, status, date, value, client")
    .ilike("project", name)
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobDocument[];
}
