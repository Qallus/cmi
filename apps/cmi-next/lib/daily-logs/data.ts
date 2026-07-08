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
