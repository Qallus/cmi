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
  // Legacy PM board items (project_schedule_items) + the new Multi-Schedule
  // Builder items, both filtered to client-visible.
  const [{ data: legacy }, groups] = await Promise.all([
    sb.from("project_schedule_items")
      .select("id, title, phase, start_date, end_date, client_start_date, client_end_date, status, progress, type")
      .eq("board_id", jobId).eq("client_visible", true).neq("type", "project")
      .order("end_date", { ascending: true }).limit(100),
    loadClientScheduleGroups(jobId),
  ]);
  const out: ClientScheduleItem[] = (legacy ?? []).map((r) => ({
    id: r.id as string, title: r.title as string, phase: (r.phase as string | null) ?? null,
    start: (r.client_start_date as string | null) ?? (r.start_date as string | null),
    end: (r.client_end_date as string | null) ?? (r.end_date as string | null),
    status: (r.status as string | null) ?? null, progress: Number(r.progress) || 0,
  }));
  for (const g of groups) for (const it of g.items) out.push({ id: it.id, title: it.title, phase: g.schedule_name, start: it.start, end: it.end, status: it.status, progress: it.percent_complete });
  return out;
}

export type ClientScheduleGroup = {
  schedule_id: string;
  schedule_name: string;
  schedule_type: string;
  items: { id: string; title: string; kind: string; start: string | null; end: string | null; status: string | null; percent_complete: number; note: string | null }[];
};

// Client-visible schedules (schedule.visibility = client_visible) and their
// client-visible items only. Internal notes are never included.
export async function loadClientScheduleGroups(jobId: string): Promise<ClientScheduleGroup[]> {
  const sb = getSupabaseAdmin();
  const { data: scheds } = await sb
    .from("job_schedules")
    .select("id, name, type")
    .eq("job_id", jobId).eq("visibility", "client_visible").neq("status", "archived")
    .order("is_master", { ascending: false }).order("sort_order");
  if (!scheds?.length) return [];
  const ids = scheds.map((s) => s.id);
  const { data: items } = await sb
    .from("schedule_items")
    .select("id, schedule_id, title, kind, start_date, end_date, status, percent_complete, client_notes, client_visible")
    .in("schedule_id", ids).eq("client_visible", true)
    .order("start_date", { ascending: true, nullsFirst: false });
  return scheds.map((s) => ({
    schedule_id: s.id, schedule_name: s.name, schedule_type: s.type,
    items: (items ?? []).filter((i) => i.schedule_id === s.id).map((i) => ({
      id: i.id, title: i.title, kind: i.kind, start: i.start_date, end: i.end_date,
      status: i.status, percent_complete: Number(i.percent_complete) || 0, note: i.client_notes ?? null,
    })),
  })).filter((g) => g.items.length);
}
