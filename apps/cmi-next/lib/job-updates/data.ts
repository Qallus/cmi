import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyJobClients } from "@/lib/client-portal/notifications";
import type { JobUpdate, JobUpdateDraft } from "./types";

export async function loadJobUpdates(jobId: string): Promise<JobUpdate[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("job_updates").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobUpdate[];
}

export async function createJobUpdate(jobId: string, draft: JobUpdateDraft, actor?: string | null): Promise<JobUpdate> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("job_updates")
    .insert({ ...draft, job_id: jobId, posted_by: draft.posted_by ?? actor ?? null }).select().single();
  if (error) throw new Error(error.message);
  // Bump the job's last client-update marker + notify clients when a
  // client-visible update posts (best-effort — never block the write).
  if ((draft.visibility ?? "client_visible") === "client_visible") {
    await sb.from("jobs").update({ last_client_update_at: new Date().toISOString() }).eq("id", jobId);
    notifyJobClients(jobId, { type: "update", title: draft.title, body: draft.body ?? null, link: `/client/jobs/${jobId}/updates` }).catch(() => {});
  }
  return data as JobUpdate;
}

export async function updateJobUpdate(id: string, patch: Partial<JobUpdateDraft>): Promise<JobUpdate> {
  const clean = { ...patch } as Record<string, unknown>;
  delete clean.job_id;
  const { data, error } = await getSupabaseAdmin().from("job_updates")
    .update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as JobUpdate;
}

export async function deleteJobUpdate(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_updates").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
