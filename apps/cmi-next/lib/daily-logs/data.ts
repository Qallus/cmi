import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { DailyLog, DailyLogDraft } from "./types";
import { weatherForSite } from "@/lib/weather";
import { htmlToText } from "@/lib/notes/html";

// Private logs are only ever shown to the person who wrote them.
const visibleTo = (viewerId: string | null | undefined) => (l: DailyLog) =>
  l.visibility !== "private" || (!!viewerId && l.created_by_id === viewerId);

export async function loadDailyLogs(jobId: string, viewerId?: string | null): Promise<DailyLog[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_logs").select("*").eq("job_id", jobId).order("log_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as DailyLog[]).filter(visibleTo(viewerId));
}

/** A short title for lists, since the form no longer asks for one. */
export function autoTitle(draft: { notes?: string | null; photos?: string[] | null; attachments?: { type: string }[] | null }): string {
  const text = htmlToText(draft.notes ?? "");
  if (text) return text.length > 80 ? `${text.slice(0, 77).trimEnd()}…` : text;
  if (draft.attachments?.some((a) => a.type === "audio")) return "Voice note";
  const n = draft.photos?.length ?? 0;
  if (n) return n === 1 ? "Site photo" : `${n} site photos`;
  if (draft.attachments?.some((a) => a.type === "video")) return "Site video";
  return "Daily log";
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
  /** Pipeline deal name/number when the log belongs to a deal. */
  deal_name: string | null; deal_number: string | null;
};

/** Daily logs across every Job and Pre-Con, newest first, for the all-jobs Daily Logs page. */
export async function loadAllDailyLogs(limit = 500, viewerId?: string | null): Promise<DailyLogWithJob[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("daily_logs")
    .select("*, jobs(job_name, job_number, archived_at), pipeline_opportunities(opportunity_name, job_number), deals(title, job_number)")
    .order("log_date", { ascending: false }).order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  type Row = DailyLog & {
    jobs: { job_name: string | null; job_number: string | null; archived_at: string | null } | null;
    pipeline_opportunities: { opportunity_name: string | null; job_number: string | null } | null;
    deals: { title: string | null; job_number: string | null } | null;
  };
  return ((data ?? []) as Row[])
    .filter((r) => !r.jobs?.archived_at && visibleTo(viewerId)(r))
    .map(({ jobs, pipeline_opportunities: opp, deals: deal, ...log }) => ({
      ...log,
      job_name: jobs?.job_name ?? null, job_number: jobs?.job_number ?? null,
      opportunity_name: opp?.opportunity_name ?? null, opportunity_number: opp?.job_number ?? null,
      deal_name: deal?.title ?? null, deal_number: deal?.job_number ?? null,
    }));
}

export type LogTarget = { kind: "job" | "opportunity" | "deal"; id: string };

/**
 * One log written once per selected Job / Pre-Con, so a superintendent who
 * walked three sites can record it in one go.
 */
export async function createDailyLogs(targets: LogTarget[], draft: DailyLogDraft, actor?: string | null, actorId?: string | null): Promise<DailyLog[]> {
  const clean = { ...draft } as Record<string, unknown>;
  delete clean.job_id; delete clean.opportunity_id; delete clean.deal_id; delete clean.id; delete clean.created_by_id;
  if (!clean.title) clean.title = autoTitle(draft);
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
    deal_id: t.kind === "deal" ? t.id : null,
    // Clients only see logs on their own job's portal, and never a private one.
    client_visible: t.kind === "job" && draft.visibility !== "private" ? !!draft.client_visible : false,
    created_by: actor ?? null,
    created_by_id: actorId ?? null,
  }));
  const { data, error } = await getSupabaseAdmin().from("daily_logs").insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyLog[];
}

/** Pipeline deals, Pre-Con opportunities and Jobs a log can be filed against. */
export async function loadLogTargets(): Promise<{ kind: "job" | "opportunity" | "deal"; id: string; label: string; sub: string }[]> {
  const sb = getSupabaseAdmin();
  const [jobs, opps, deals] = await Promise.all([
    sb.from("jobs").select("id, job_name, job_number, status").is("archived_at", null).eq("is_template", false).order("job_number", { ascending: false }),
    sb.from("pipeline_opportunities").select("id, opportunity_name, job_number, stage").is("archived_at", null).order("created_at", { ascending: false }),
    sb.from("deals").select("id, title, job_number, stage").is("archived_at", null).order("updated_at", { ascending: false }).limit(300),
  ]);
  return [
    ...((jobs.data ?? []) as { id: string; job_name: string | null; job_number: string | null; status: string | null }[])
      .map((j) => ({ kind: "job" as const, id: j.id, label: j.job_name || j.job_number || "Job", sub: ["Job", j.job_number].filter(Boolean).join(" · ") })),
    ...((opps.data ?? []) as { id: string; opportunity_name: string | null; job_number: string | null; stage: string | null }[])
      .map((o) => ({ kind: "opportunity" as const, id: o.id, label: o.opportunity_name || o.job_number || "Pre-Con", sub: ["Pre-Con", o.job_number].filter(Boolean).join(" · ") })),
    ...((deals.data ?? []) as { id: string; title: string | null; job_number: string | null; stage: string | null }[])
      .map((d) => ({ kind: "deal" as const, id: d.id, label: d.title || d.job_number || "Deal", sub: ["Pipeline", d.job_number].filter(Boolean).join(" · ") })),
  ];
}
