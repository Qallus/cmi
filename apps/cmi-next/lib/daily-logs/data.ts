import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DailyLog, DailyLogDraft } from "./types";
import { weatherForSite } from "@/lib/weather";

export async function loadDailyLogs(jobId: string): Promise<DailyLog[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_logs").select("*").eq("job_id", jobId).order("log_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyLog[];
}

export async function createDailyLog(jobId: string, draft: DailyLogDraft, actor?: string | null): Promise<DailyLog> {
  // Blank weather is looked up for the job site and date.
  const auto = !draft.weather?.trim() && !draft.temperature?.trim() ? await weatherForSite("job", jobId, draft.log_date) : null;
  const { data, error } = await getSupabaseAdmin().from("daily_logs")
    .insert({ ...draft, ...(auto ?? {}), job_id: jobId, created_by: actor ?? null }).select().single();
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

export type DailyLogWithJob = DailyLog & {
  job_name: string | null; job_number: string | null;
  /** Pre-Con name/number when the log belongs to an opportunity. */
  opportunity_name: string | null; opportunity_number: string | null;
};

/** Daily logs across every Job and Pre-Con, newest first, for the all-jobs Daily Logs page. */
export async function loadAllDailyLogs(limit = 500): Promise<DailyLogWithJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_logs")
    .select("*, jobs(job_name, job_number, archived_at), pipeline_opportunities(opportunity_name, job_number)")
    .order("log_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type Row = DailyLog & {
    jobs: { job_name: string | null; job_number: string | null; archived_at: string | null } | null;
    pipeline_opportunities: { opportunity_name: string | null; job_number: string | null } | null;
  };
  return ((data ?? []) as Row[])
    .filter((r) => !r.jobs?.archived_at)
    .map(({ jobs, pipeline_opportunities: opp, ...log }) => ({
      ...log,
      job_name: jobs?.job_name ?? null, job_number: jobs?.job_number ?? null,
      opportunity_name: opp?.opportunity_name ?? null, opportunity_number: opp?.job_number ?? null,
    }));
}

export type LogTarget = { kind: "job" | "opportunity"; id: string };

/**
 * One log written once per selected Job / Pre-Con, so a superintendent who
 * walked three sites can record it in one go.
 */
export async function createDailyLogs(targets: LogTarget[], draft: DailyLogDraft, actor?: string | null): Promise<DailyLog[]> {
  const clean = { ...draft } as Record<string, unknown>;
  delete clean.job_id; delete clean.opportunity_id; delete clean.id;
  // Weather left blank is looked up per site, since several sites can differ.
  const needWeather = !draft.weather?.trim() && !draft.temperature?.trim();
  const weather = needWeather
    ? await Promise.all(targets.map((t) => weatherForSite(t.kind, t.id, draft.log_date)))
    : targets.map(() => null);
  const rows = targets.map((t, i) => ({
    ...clean,
    ...(weather[i] ? { weather: weather[i]!.weather, temperature: weather[i]!.temperature } : {}),
    job_id: t.kind === "job" ? t.id : null,
    opportunity_id: t.kind === "opportunity" ? t.id : null,
    // Clients only see logs on their own job's portal.
    client_visible: t.kind === "job" ? !!draft.client_visible : false,
    created_by: actor ?? null,
  }));
  const { data, error } = await getSupabaseAdmin().from("daily_logs").insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyLog[];
}

/** Jobs and Pre-Con opportunities a log can be filed against. */
export async function loadLogTargets(): Promise<{ kind: "job" | "opportunity"; id: string; label: string; sub: string }[]> {
  const sb = getSupabaseAdmin();
  const [jobs, opps] = await Promise.all([
    sb.from("jobs").select("id, job_name, job_number, status").is("archived_at", null).eq("is_template", false).order("job_number", { ascending: false }),
    sb.from("pipeline_opportunities").select("id, opportunity_name, job_number, stage").order("created_at", { ascending: false }),
  ]);
  return [
    ...((jobs.data ?? []) as { id: string; job_name: string | null; job_number: string | null; status: string | null }[])
      .map((j) => ({ kind: "job" as const, id: j.id, label: j.job_name || j.job_number || "Job", sub: ["Job", j.job_number].filter(Boolean).join(" · ") })),
    ...((opps.data ?? []) as { id: string; opportunity_name: string | null; job_number: string | null; stage: string | null }[])
      .map((o) => ({ kind: "opportunity" as const, id: o.id, label: o.opportunity_name || o.job_number || "Pre-Con", sub: ["Pre-Con", o.job_number].filter(Boolean).join(" · ") })),
  ];
}
