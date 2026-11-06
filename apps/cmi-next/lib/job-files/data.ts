import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { JobFile } from "./types";

export async function loadJobFiles(jobId: string): Promise<JobFile[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("job_files").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobFile[];
}

// Records an already-uploaded file (upload to cmi-media happens in the route via
// lib/storage). Keeps the file metadata queryable + job-scoped.
export async function createJobFile(jobId: string, input: Partial<JobFile>, actor?: string | null): Promise<JobFile> {
  const { data, error } = await getSupabaseAdmin().from("job_files")
    .insert({
      job_id: jobId, folder: input.folder ?? "General", name: input.name, file_url: input.file_url,
      mime_type: input.mime_type ?? null, size_bytes: input.size_bytes ?? null, category: input.category ?? null,
      client_visible: input.client_visible ?? false, uploaded_by: actor ?? null,
    }).select().single();
  if (error) throw new Error(error.message);
  return data as JobFile;
}

export async function deleteJobFile(jobId: string, id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_files").delete().eq("id", id).eq("job_id", jobId);
  if (error) throw new Error(error.message);
}

// Share files with (or hide them from) the client portal. Scoped to the job so a
// stray id from another job is ignored.
export async function setJobFilesClientVisible(jobId: string, ids: string[], visible: boolean): Promise<JobFile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await getSupabaseAdmin().from("job_files")
    .update({ client_visible: visible }).eq("job_id", jobId).in("id", ids).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as JobFile[];
}
