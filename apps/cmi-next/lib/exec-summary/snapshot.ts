// Gathers everything about a Job or Pre-Con opportunity that an executive
// summary should draw on — filtered by audience. The TEAM snapshot is the
// whole picture (budget, internal notes, risks, vendors). The CLIENT snapshot
// is built from client-safe data only: client-visible schedule items, logs,
// updates and punch lists, the contract value, change orders and the
// client's own to-dos — never internal notes, costs, margins or vendor detail.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getJobOverview } from "@/lib/agent/job-context";
import { loadLists } from "@/lib/punch/data";
import { htmlToText } from "@/lib/notes/html";
import { STAGE_META } from "@/lib/pipeline/stages";
import { JOB_STATUS_META } from "@/lib/jobs/status";

export type SummaryTarget = "job" | "precon";
export type Audience = "team" | "client";

type Row = Record<string, any>;

export type Snapshot = {
  name: string;
  number: string | null;
  kind: "Job" | "Pre-Con";
  href: string;              // dashboard link
  portalHref: string | null; // client portal link (Jobs only)
  data: Record<string, unknown>;
};

const today = () => new Date().toISOString().slice(0, 10);
const trim = (s: unknown, n = 600) => (typeof s === "string" ? htmlToText(s).slice(0, n) : s ?? null);

async function punchSummary(type: "job" | "precon", id: string, clientOnly: boolean) {
  const lists = await loadLists({ parentType: type, parentId: id, clientVisibleOnly: clientOnly });
  return lists.map((l) => ({
    title: l.title,
    done: l.items.filter((i) => i.completed_at).length,
    total: l.items.length,
    open_items: l.items.filter((i) => !i.completed_at).slice(0, 25).map((i) => ({
      title: i.title, location: i.location, due_date: i.due_date,
      ...(clientOnly ? {} : { priority: i.priority, assignee: i.assignee_name ?? null }),
    })),
  }));
}

export async function buildSnapshot(target: SummaryTarget, id: string, audience: Audience): Promise<Snapshot | null> {
  return target === "job" ? jobSnapshot(id, audience) : preconSnapshot(id, audience);
}

async function jobSnapshot(jobId: string, audience: Audience): Promise<Snapshot | null> {
  const sb = getSupabaseAdmin();
  const overview = (await getJobOverview(jobId)) as Row;
  if (overview.error) return null;
  const job = overview.job as Row;
  const { data: full } = await sb.from("jobs").select("client_description,square_feet,permit_number,funded_by_construction_loan").eq("id", jobId).maybeSingle();

  const [sched, logs, punch] = await Promise.all([
    sb.from("schedule_items")
      .select("title,kind,status,start_date,end_date,percent_complete,client_visible,is_critical,client_notes,internal_notes")
      .eq("job_id", jobId).order("start_date", { ascending: true }).limit(400),
    sb.from("daily_logs").select("log_date,title,notes,delays,client_visible").eq("job_id", jobId)
      .order("log_date", { ascending: false }).limit(12),
    punchSummary("job", jobId, audience === "client"),
  ]);

  const t = today();
  const items = ((sched.data ?? []) as Row[]).filter((i) => audience === "team" || i.client_visible);
  const open = items.filter((i) => !["complete", "cancelled"].includes(String(i.status)));
  const schedule = {
    overdue: open.filter((i) => i.end_date && i.end_date < t).slice(0, 15),
    in_progress: open.filter((i) => i.start_date && i.start_date <= t && (!i.end_date || i.end_date >= t)).slice(0, 15),
    upcoming_30_days: open.filter((i) => i.start_date && i.start_date > t).slice(0, 15),
    completed_count: items.filter((i) => i.status === "complete").length,
    total_count: items.length,
  };
  const strip = (i: Row) => audience === "client"
    ? { title: i.title, status: i.status, start: i.start_date, end: i.end_date, percent: i.percent_complete, note: i.client_notes ?? null }
    : { title: i.title, status: i.status, start: i.start_date, end: i.end_date, percent: i.percent_complete, critical: i.is_critical, note: trim(i.internal_notes, 200) };
  const scheduleOut = {
    ...schedule,
    overdue: schedule.overdue.map(strip), in_progress: schedule.in_progress.map(strip), upcoming_30_days: schedule.upcoming_30_days.map(strip),
  };

  const logRows = ((logs.data ?? []) as Row[]).filter((l) => audience === "team" || l.client_visible)
    .map((l) => ({ date: l.log_date, title: l.title, notes: trim(l.notes, 500), delays: audience === "team" ? trim(l.delays, 200) : undefined }));

  const base = {
    today: t,
    project: {
      name: job.job_name, number: job.job_number, address: job.full_address,
      status: JOB_STATUS_META[job.status as keyof typeof JOB_STATUS_META]?.label ?? job.status,
      current_phase: job.current_phase, progress_percent: job.progress_percentage, next_milestone: job.next_milestone,
      projected_start: job.projected_start_date, projected_completion: job.projected_completion_date,
      actual_start: job.actual_start_date, actual_completion: job.actual_completion_date,
      contract_value: job.contract_price, square_feet: full?.square_feet ?? null,
      description_for_client: full?.client_description ?? null,
    },
    schedule: scheduleOut,
    daily_logs_recent: logRows,
    punch_lists: punch,
    change_orders: ((overview.change_orders ?? []) as Row[]).map((c) => ({ number: c.co_number, title: c.title, status: c.status, amount: c.amount, date: c.co_date })),
    selections: ((overview.selections ?? []) as Row[]).map((s) => ({ name: s.name, category: s.category, status: s.selection_status, approval: s.approval_status })),
    client_action_items: ((overview.action_items ?? []) as Row[]).filter((a) => a.status === "open" || a.status === "in_progress")
      .map((a) => ({ title: a.title, due: a.due_date, priority: a.priority })),
    team: ((overview.internal_users ?? []) as Row[]).map((u) => ({ name: u.user?.display_name, role: u.role })),
    clients: ((overview.contacts ?? []) as Row[]).filter((c) => c.role === "client").map((c) => `${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim()),
  };

  const data = audience === "client"
    ? {
        ...base,
        client_updates_recent: ((overview.updates ?? []) as Row[]).filter((u) => u.visibility === "client_visible").map((u) => ({ title: u.title, date: u.created_at })),
      }
    : {
        ...base,
        project: { ...base.project, contract_type: job.contract_type, permit_number: full?.permit_number ?? null, construction_loan: full?.funded_by_construction_loan ?? null, internal_notes: trim(job.internal_notes, 1500), project_manager: job.project_manager },
        financials: {
          contract_value: job.contract_price,
          approved_change_orders_total: ((overview.change_orders ?? []) as Row[]).filter((c) => c.status === "approved").reduce((n, c) => n + (Number(c.amount) || 0), 0),
          open_invoice_balance: (overview.counts as Row)?.open_invoice_balance ?? null,
          invoices: ((overview.invoices ?? []) as Row[]).map((i) => ({ number: i.invoice_number, title: i.title, status: i.status, amount: i.amount, paid: i.amount_paid, due: i.due_date })),
        },
        internal_notes_recent: ((overview.notes ?? []) as Row[]).map((n) => ({ by: n.author_name, date: n.created_at, note: trim(n.body, 300), pinned: n.pinned })),
        all_updates_recent: ((overview.updates ?? []) as Row[]).map((u) => ({ title: u.title, visibility: u.visibility, client_action_required: u.client_action_required, date: u.created_at })),
        vendors: ((overview.vendors ?? []) as Row[]).map((v) => ({ role: v.role, company: v.vendor?.company || `${v.vendor?.first_name ?? ""} ${v.vendor?.last_name ?? ""}`.trim() })),
      };

  return {
    name: job.job_name, number: job.job_number, kind: "Job",
    href: `/dashboard/jobs/${jobId}/summary`,
    portalHref: `/client/jobs/${jobId}/overview`,
    data,
  };
}

async function preconSnapshot(id: string, audience: Audience): Promise<Snapshot | null> {
  const sb = getSupabaseAdmin();
  const { data: o } = await sb.from("pipeline_opportunities").select("*").eq("id", id).maybeSingle();
  if (!o) return null;
  const opp = o as Row;
  const [contact, history, logs, punch, deal, media] = await Promise.all([
    opp.contact_id ? sb.from("contacts").select("first_name,last_name,company").eq("id", opp.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("pipeline_stage_history").select("from_stage,to_stage,changed_at,note").eq("opportunity_id", id).order("changed_at", { ascending: true }),
    sb.from("daily_logs").select("log_date,title,notes,client_visible").eq("opportunity_id", id).order("log_date", { ascending: false }).limit(10),
    punchSummary("precon", id, audience === "client"),
    sb.from("deals").select("title,stage,notes,next_action,next_action_due,source,estimated_value,created_at").eq("opportunity_id", id).maybeSingle(),
    sb.from("opportunity_media").select("id", { count: "exact", head: true }).eq("opportunity_id", id),
  ]);
  const c = contact.data as Row | null;
  const stage = STAGE_META[opp.stage as keyof typeof STAGE_META];

  const project = {
    name: opp.opportunity_name, number: opp.job_number,
    address: [opp.project_address, opp.city, opp.state, opp.zip_code].filter(Boolean).join(", ") || null,
    stage: stage?.label ?? opp.stage, stage_meaning: stage?.description ?? null,
    project_type: opp.project_type, client: c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company : null,
    design_team: { architect: opp.architect, designer: opp.designer, engineer: opp.engineer },
    agreement_status: opp.agreement_status, permit_status: opp.permit_status,
    projected_construction_start: opp.projected_construction_start_date, projected_completion: opp.projected_completion_date,
    estimated_budget_range: opp.estimated_budget_range,
  };

  const data = audience === "client"
    ? {
        today: today(),
        project,
        // Notes hold scope AND internal commentary; the prompt limits the client
        // version to scope, and staff review every summary before it is sent.
        scope_notes_internal_source: trim(opp.notes, 1500),
        daily_logs_recent: ((logs.data ?? []) as Row[]).filter((l) => l.client_visible).map((l) => ({ date: l.log_date, title: l.title, notes: trim(l.notes, 400) })),
        punch_lists: punch,
      }
    : {
        today: today(),
        project: {
          ...project,
          owner: opp.assigned_owner, source: opp.source, referral_source: opp.referral_source,
          probability_percent: opp.probability_percent, forecast_probability_percent: opp.forecast_probability_percent,
          estimated_project_value: opp.estimated_project_value, contract_value: opp.contract_value,
          projected_construction_value: opp.projected_construction_value,
          budget: { status: opp.budget_status, owner: opp.budget_owner, due: opp.budget_due_date, last_sent: opp.last_budget_sent_date, revisions: opp.budget_revision_count, current_total: opp.current_budget_total, internal_estimated_cost: opp.internal_estimated_cost, projected_margin: opp.projected_margin },
          long_lead: opp.stage === "long_lead" ? { reason: opp.long_lead_reason, follow_up: opp.follow_up_date, owner: opp.follow_up_owner } : null,
          next_action: opp.next_action, next_action_due: opp.next_action_due,
        },
        notes: trim(opp.notes, 2500),
        stage_history: history.data ?? [],
        pipeline_deal: deal.data ? { ...deal.data, notes: trim((deal.data as Row).notes, 800) } : null,
        daily_logs_recent: ((logs.data ?? []) as Row[]).map((l) => ({ date: l.log_date, title: l.title, notes: trim(l.notes, 400) })),
        punch_lists: punch,
        photos_and_files: (media as { count: number | null }).count ?? 0,
      };

  return {
    name: opp.opportunity_name, number: opp.job_number, kind: "Pre-Con",
    href: `/dashboard/sales/${id}`, portalHref: null, data,
  };
}
