import { getSupabaseAdmin } from "@/lib/supabase/server";

// Client-visible schedule milestones for a job. The job's PM board is
// board_id = job.id; we surface only client_visible items and use the
// client-facing dates (client_start_date/client_end_date) when set, falling
// back to the internal dates. This is the client side of per-role scheduling.
export type ClientScheduleItem = {
  id: string;
  title: string;
  phase: string | null;
  start: string | null;
  end: string | null;
  status: string | null;
  progress: number;
};

export async function loadClientScheduleItems(jobId: string): Promise<ClientScheduleItem[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("project_schedule_items")
    .select("id, title, phase, start_date, end_date, client_start_date, client_end_date, status, progress, type")
    .eq("board_id", jobId)
    .eq("client_visible", true)
    .neq("type", "project")
    .order("end_date", { ascending: true })
    .limit(100);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    phase: (r.phase as string | null) ?? null,
    start: (r.client_start_date as string | null) ?? (r.start_date as string | null),
    end: (r.client_end_date as string | null) ?? (r.end_date as string | null),
    status: (r.status as string | null) ?? null,
    progress: Number(r.progress) || 0,
  }));
}
