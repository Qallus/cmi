// Staff client-engagement report — aggregates portal signals across all
// portal-enabled jobs (batched queries + in-memory rollup).
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type EngagementJobRow = {
  id: string; job_name: string; job_number: string | null; status: string;
  last_client_update_at: string | null;
  last_client_login: string | null;
  pending_approvals: number;
  open_action_items: number;
  unread_messages: number;
  open_warranty: number;
  stale: boolean; // no client update in 14+ days (or never)
};

export type EngagementReport = {
  totals: { portal_jobs: number; pending_approvals: number; open_action_items: number; unread_messages: number; open_warranty: number; jobs_missing_updates: number };
  warranty_by_status: Record<string, number>;
  jobs: EngagementJobRow[];
};

const STALE_DAYS = 14;

export async function loadEngagementReport(): Promise<EngagementReport> {
  const sb = getSupabaseAdmin();
  const { data: jobs } = await sb.from("jobs")
    .select("id, job_name, job_number, status, last_client_update_at")
    .eq("client_portal_enabled", true).is("archived_at", null);
  const jobRows = jobs ?? [];
  const ids = jobRows.map((j) => j.id);

  if (ids.length === 0) {
    return { totals: { portal_jobs: 0, pending_approvals: 0, open_action_items: 0, unread_messages: 0, open_warranty: 0, jobs_missing_updates: 0 }, warranty_by_status: {}, jobs: [] };
  }

  const [logins, approvals, actions, messages, warranty] = await Promise.all([
    sb.from("job_contacts").select("job_id, contact:contacts(portal_last_login_at)").in("job_id", ids).eq("portal_access_enabled", true),
    sb.from("project_selections").select("job_id").in("job_id", ids).eq("client_visible", true).eq("client_approval_required", true).eq("approval_status", "pending"),
    sb.from("job_action_items").select("job_id").in("job_id", ids).in("status", ["open", "in_progress"]),
    sb.from("job_messages").select("job_id").in("job_id", ids).eq("sender_type", "client").is("read_at", null),
    sb.from("warranty_requests").select("job_id, status").in("job_id", ids),
  ]);

  const lastLogin = new Map<string, string>();
  for (const r of (logins.data ?? []) as { job_id: string; contact: { portal_last_login_at?: string | null } | null }[]) {
    const v = r.contact?.portal_last_login_at;
    if (v && (!lastLogin.has(r.job_id) || v > lastLogin.get(r.job_id)!)) lastLogin.set(r.job_id, v);
  }
  const tally = (rows: { job_id: string }[] | null | undefined) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.job_id, (m.get(r.job_id) ?? 0) + 1);
    return m;
  };
  const approvalsBy = tally(approvals.data), actionsBy = tally(actions.data), messagesBy = tally(messages.data), warrantyBy = tally(warranty.data);

  const warranty_by_status: Record<string, number> = {};
  for (const r of (warranty.data ?? []) as { status: string | null }[]) {
    const k = r.status ?? "unknown";
    if (k !== "resolved" && k !== "closed") warranty_by_status[k] = (warranty_by_status[k] ?? 0) + 1;
  }

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
  const rows: EngagementJobRow[] = jobRows.map((j) => ({
    id: j.id, job_name: j.job_name, job_number: j.job_number, status: j.status,
    last_client_update_at: j.last_client_update_at, last_client_login: lastLogin.get(j.id) ?? null,
    pending_approvals: approvalsBy.get(j.id) ?? 0, open_action_items: actionsBy.get(j.id) ?? 0,
    unread_messages: messagesBy.get(j.id) ?? 0, open_warranty: warrantyBy.get(j.id) ?? 0,
    stale: !j.last_client_update_at || j.last_client_update_at < staleCutoff,
  }));

  const sum = (k: keyof EngagementJobRow) => rows.reduce((s, r) => s + (typeof r[k] === "number" ? (r[k] as number) : 0), 0);
  return {
    totals: {
      portal_jobs: rows.length, pending_approvals: sum("pending_approvals"), open_action_items: sum("open_action_items"),
      unread_messages: sum("unread_messages"), open_warranty: sum("open_warranty"), jobs_missing_updates: rows.filter((r) => r.stale).length,
    },
    warranty_by_status,
    jobs: rows.sort((a, b) => (b.pending_approvals + b.unread_messages + b.open_action_items) - (a.pending_approvals + a.unread_messages + a.open_action_items)),
  };
}
