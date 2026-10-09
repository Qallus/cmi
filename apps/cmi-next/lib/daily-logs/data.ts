import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DailyLog, DailyLogDraft } from "./types";

export async function loadDailyLogs(jobId: string): Promise<DailyLog[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_logs").select("*").eq("job_id", jobId).order("log_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyLog[];
}

export async function createDailyLog(jobId: string, draft: DailyLogDraft, actor?: string | null): Promise<DailyLog> {
  const { data, error } = await getSupabaseAdmin().from("daily_logs")
    .insert({ ...draft, job_id: jobId, created_by: actor ?? null }).select().single();
  if (error) throw new Error(error.message);
  return data as DailyLog;
}

export async function updateDailyLog(id: string, patch: Partial<DailyLogDraft>): Promise<DailyLog> {
  const clean = { ...patch } as Record<string, unknown>;
  delete clean.job_id;
  const { data, error } = await getSupabaseAdmin().from("daily_logs")
    .update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as DailyLog;
}

export async function deleteDailyLog(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("daily_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type DailyLogWithJob = DailyLog & { job_name: string | null; job_number: string | null };

/** Daily logs across every job, newest first, for the all-jobs Daily Logs page. */
export async function loadAllDailyLogs(limit = 500): Promise<DailyLogWithJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_logs").select("*, jobs(job_name, job_number, archived_at)")
    .order("log_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type Row = DailyLog & { jobs: { job_name: string | null; job_number: string | null; archived_at: string | null } | null };
  return ((data ?? []) as Row[])
    .filter((r) => !r.jobs?.archived_at)
    .map(({ jobs, ...log }) => ({ ...log, job_name: jobs?.job_name ?? null, job_number: jobs?.job_number ?? null }));
}
