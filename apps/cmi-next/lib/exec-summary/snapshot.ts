// Gathers everything about a Job or Pre-Con opportunity that an executive
// summary should draw on — filtered by audience. The TEAM snapshot is the
// whole picture (budget, internal notes, risks, vendors). The CLIENT snapshot
// is built from client-safe data only — never internal notes, costs, margins
// or vendor detail.
//
// Two rules apply to BOTH audiences:
//  - Negative daily logs and punch items ("windows were broken when I
//    arrived", "countertop cracked, needs repair") are dropped here, in code,
//    so they never reach Bolt or the summary.
//  - Progress is worked out deterministically (completed / in progress /
//    coming soon) so Bolt narrates facts instead of guessing from dates.
// Server only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getJobOverview } from "@/lib/agent/job-context";
import { loadLists } from "@/lib/punch/data";
import { htmlToText } from "@/lib/notes/html";
import { STAGE_META, ALL_STAGES } from "@/lib/pipeline/stages";
import { JOB_STATUS_META } from "@/lib/jobs/status";

export type SummaryTarget = "job" | "precon";
export type Audience = "team" | "client";

type Row = Record<string, any>;

export type SummaryPhoto = { url: string; caption: string | null; date: string | null; clientVisible: boolean };

export type Snapshot = {
  name: string;
  number: string | null;
  kind: "Job" | "Pre-Con";
  href: string;              // dashboard link
  portalHref: string | null; // client portal link (Jobs only)
  /** First names of the record's clients, for the "Hi {{first_name}}," preview. */
  clientFirstNames: string[];
  /** Recent photos staff can choose to include (client-visible ones first). */
  photos: SummaryPhoto[];
  data: Record<string, unknown>;
};

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const trim = (s: unknown, n = 600) => (typeof s === "string" ? htmlToText(s).slice(0, n) : s ?? null);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Problem language. A log or punch item that matches is left out entirely.
const NEGATIVE = /\b(broke|broken|break(s|ing)?|crack(ed|s|ing)?|damag(e|ed|es|ing)|dent(ed|s)?|scratch(ed|es)?|chip(ped|s)?|leak(s|ed|ing)?|flood(ed|ing)?|mold|missing|defect(s|ive)?|wrong|incorrect|faulty|fail(ed|s|ing|ure)?|not working|doesn'?t work|won'?t (open|close|work|latch)|needs? (repair|replac\w*|redo|to be redone|fix\w*)|repair(s|ed)?|redo|stolen|theft|vandal\w*|injur\w*|accident|unsafe|hazard|problem(s)?|issue(s)?|complain\w*|rejected|red[- ]tag\w*)\b/i;
export const isNegative = (text: unknown) => typeof text === "string" && NEGATIVE.test(htmlToText(text));

async function punchSummary(type: "job" | "precon", id: string, clientOnly: boolean) {
  const lists = await loadLists({ parentType: type, parentId: id, clientVisibleOnly: clientOnly });
  return lists.map((l) => {
    const items = l.items.filter((i) => !isNegative(`${i.title} ${i.notes ?? ""}`));
    return {
      title: l.title,
      done: items.filter((i) => i.completed_at).length,
      total: items.length,
      recently_completed: items.filter((i) => i.completed_at && i.completed_at.slice(0, 10) >= addDays(today(), -14)).slice(0, 15).map((i) => i.title),
      open_items: items.filter((i) => !i.completed_at).slice(0, 25).map((i) => ({
        title: i.title, location: i.location, due_date: i.due_date,
        ...(clientOnly ? {} : { priority: i.priority, assignee: i.assignee_name ?? null }),
      })),
    };
  });
}

type SchedItem = { title: string; status: string; start_date: string | null; end_date: string | null; percent_complete: number | null };

/**
 * Completed / in progress / coming soon. Uses item statuses when the team
 * keeps them up to date; otherwise the job's current phase (set by the PM)
 * marks the point in the schedule; otherwise the dates.
 */
function progressOf(items: SchedItem[], currentPhase: string | null, t: string) {
  const ordered = [...items].sort((a, b) => String(a.start_date ?? "9999").localeCompare(String(b.start_date ?? "9999")));
  const view = (i: SchedItem) => ({ item: i.title, start: i.start_date, end: i.end_date });
  const maintained = ordered.some((i) => i.status && !["not_started", "scheduled", "planned"].includes(i.status));
  if (maintained) {
    const open = ordered.filter((i) => !["complete", "completed", "cancelled"].includes(i.status));
    return {
      basis: "item statuses",
      completed: ordered.filter((i) => ["complete", "completed"].includes(i.status)).slice(-8).map(view),
      in_progress: open.filter((i) => i.status === "in_progress").slice(0, 6).map(view),
      coming_soon: open.filter((i) => i.status !== "in_progress" && (!i.start_date || i.start_date >= t)).slice(0, 5).map(view),
    };
  }
  const phase = currentPhase ? norm(currentPhase) : "";
  const idx = phase ? ordered.findIndex((i) => norm(i.title).includes(phase) || phase.includes(norm(i.title))) : -1;
  if (idx >= 0) {
    // If the schedule says this phase should already be over, its dates have
    // fallen behind reality: keep the order, drop the dates.
    const stale = !!ordered[idx].end_date && ordered[idx].end_date! < t;
    const v = (i: SchedItem) => (stale ? { item: i.title, start: null, end: null } : view(i));
    return {
      basis: `the job's current phase (${currentPhase})`,
      schedule_dates_outdated: stale,
      completed: ordered.slice(Math.max(0, idx - 8), idx).map(v),
      in_progress: [v(ordered[idx])],
      coming_soon: ordered.slice(idx + 1, idx + 5).map(v),
    };
  }
  return {
    basis: "schedule dates",
    completed: ordered.filter((i) => i.end_date && i.end_date < t).slice(-8).map(view),
    in_progress: ordered.filter((i) => i.start_date && i.start_date <= t && (!i.end_date || i.end_date >= t)).slice(0, 6).map(view),
    coming_soon: ordered.filter((i) => i.start_date && i.start_date > t).slice(0, 5).map(view),
  };
}

export async function buildSnapshot(target: SummaryTarget, id: string, audience: Audience): Promise<Snapshot | null> {
  return target === "job" ? jobSnapshot(id, audience) : preconSnapshot(id, audience);
}

async function jobSnapshot(jobId: string, audience: Audience): Promise<Snapshot | null> {
  const sb = getSupabaseAdmin();
  const overview = (await getJobOverview(jobId)) as Row;
  if (overview.error) return null;
  const job = overview.job as Row;
  const client = audience === "client";
  const t = today();

  const [full, sched, logs, punch, sels, updates, files, contacts] = await Promise.all([
    sb.from("jobs").select("client_description,square_feet,permit_number,funded_by_construction_loan").eq("id", jobId).maybeSingle(),
    sb.from("schedule_items").select("title,kind,status,start_date,end_date,percent_complete,client_visible,client_notes,internal_notes")
      .eq("job_id", jobId).order("start_date", { ascending: true }).limit(400),
    sb.from("daily_logs").select("log_date,title,notes,delays,photos,client_visible,created_at").eq("job_id", jobId)
      .order("log_date", { ascending: false }).limit(25),
    punchSummary("job", jobId, client),
    sb.from("project_selections").select("name,category,selection_status,approval_status,target_delivery_date,delivery_date,delivered_at,target_install_date,installed_at")
      .eq("job_id", jobId).limit(100),
    sb.from("job_updates").select("title,visibility,media,created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(25),
    sb.from("job_files").select("name,file_url,mime_type,client_visible,created_at").eq("job_id", jobId).ilike("mime_type", "image/%")
      .order("created_at", { ascending: false }).limit(20),
    sb.from("job_contacts").select("role,contact:contacts(first_name)").eq("job_id", jobId),
  ]);

  // Schedule: client summaries use client-visible items; if this job doesn't
  // use the flag at all, the whole schedule (staff review before sending).
  const allItems = (sched.data ?? []) as Row[];
  const flagged = allItems.some((i) => i.client_visible);
  const items = client && flagged ? allItems.filter((i) => i.client_visible) : allItems;
  const progress = progressOf(items as SchedItem[], job.current_phase ?? null, t);

  // Daily logs: positive/neutral only, client-visible only for clients.
  const logRows = ((logs.data ?? []) as Row[])
    .filter((l) => (!client || l.client_visible) && !isNegative(`${l.title ?? ""} ${l.notes ?? ""}`))
    .slice(0, 12)
    .map((l) => ({ date: l.log_date, notes: trim(l.notes || l.title, 400) }));

  // Selections arriving soon / just delivered or installed.
  const selRows = (sels.data ?? []) as Row[];
  const arriving = selRows
    .map((s) => ({ name: s.name, category: s.category, date: s.target_delivery_date ?? s.delivery_date ?? null, delivered: !!s.delivered_at }))
    .filter((s) => s.date && !s.delivered && s.date >= t && s.date <= addDays(t, 45))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const recentlyInstalled = selRows.filter((s) => s.installed_at && String(s.installed_at).slice(0, 10) >= addDays(t, -14)).map((s) => s.name);

  const team = ((overview.internal_users ?? []) as Row[]).map((u) => ({ name: u.user?.display_name as string, role: u.role as string }));
  const pm = team.find((u) => /project manager/i.test(u.role ?? ""))?.name ?? (job.project_manager ? String(job.project_manager).split(" — ")[0] : null);
  const clientFirstNames = ((contacts.data ?? []) as unknown as Row[])
    .filter((c) => c.role === "client" && c.contact?.first_name).map((c) => String(c.contact.first_name).trim());

  // Photos staff can pick from. Never from a negative log.
  const photos: SummaryPhoto[] = [];
  for (const l of (logs.data ?? []) as Row[]) {
    if (isNegative(`${l.title ?? ""} ${l.notes ?? ""}`)) continue;
    for (const url of (Array.isArray(l.photos) ? l.photos : []) as string[]) {
      if (typeof url === "string") photos.push({ url, caption: l.title && l.title !== "Site photo" ? trim(l.title, 80) as string : null, date: l.log_date, clientVisible: !!l.client_visible });
    }
  }
  for (const u of (updates.data ?? []) as Row[]) {
    if (isNegative(u.title)) continue;
    for (const m of (Array.isArray(u.media) ? u.media : []) as Row[]) {
      if (m?.type === "image" && m.url) photos.push({ url: m.url, caption: u.title && u.title !== "Job Photo" ? trim(u.title, 80) as string : null, date: String(u.created_at).slice(0, 10), clientVisible: u.visibility === "client_visible" });
    }
  }
  for (const f of (files.data ?? []) as Row[]) {
    if (f.file_url) photos.push({ url: f.file_url, caption: null, date: String(f.created_at).slice(0, 10), clientVisible: !!f.client_visible });
  }
  const seen = new Set<string>();
  const photoList = photos.filter((p) => /^https:\/\//.test(p.url) && !seen.has(p.url) && seen.add(p.url))
    .sort((a, b) => Number(b.clientVisible) - Number(a.clientVisible) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 12);

  const project = {
    name: job.job_name, number: job.job_number, address: job.full_address,
    status: JOB_STATUS_META[job.status as keyof typeof JOB_STATUS_META]?.label ?? job.status,
    current_phase: job.current_phase, progress_percent: job.progress_percentage, next_milestone: job.next_milestone,
    projected_start: job.projected_start_date, projected_completion: job.projected_completion_date,
    actual_start: job.actual_start_date, actual_completion: job.actual_completion_date,
    contract_value: job.contract_price, square_feet: full.data?.square_feet ?? null,
    description_for_client: full.data?.client_description ?? null,
    project_manager: pm,
  };

  const base = {
    today: t,
    project,
    progress: { ...progress, total_schedule_items: items.length },
    selections_arriving_soon: arriving,
    selections_recently_installed: recentlyInstalled,
    selections_awaiting_client_decision: selRows.filter((s) => ["needs_review", "pending_client", "awaiting_client"].includes(s.selection_status) || s.approval_status === "pending").map((s) => s.name).slice(0, 10),
    daily_logs_recent_positive: logRows,
    punch_lists: punch,
    change_orders: ((overview.change_orders ?? []) as Row[]).map((c) => ({ number: c.co_number, title: c.title, status: c.status, amount: c.amount, date: c.co_date })),
    client_action_items: ((overview.action_items ?? []) as Row[]).filter((a) => a.status === "open" || a.status === "in_progress")
      .map((a) => ({ title: a.title, due: a.due_date })),
    team,
    photos_available: photoList.length,
  };

  const data = client
    ? {
        ...base,
        client_updates_recent: ((updates.data ?? []) as Row[]).filter((u) => u.visibility === "client_visible" && !isNegative(u.title)).map((u) => ({ title: u.title, date: String(u.created_at).slice(0, 10) })),
      }
    : {
        ...base,
        project: { ...project, contract_type: job.contract_type, permit_number: full.data?.permit_number ?? null, construction_loan: full.data?.funded_by_construction_loan ?? null, internal_notes: trim(job.internal_notes, 1500) },
        schedule_late: (allItems as Row[]).filter((i) => i.end_date && i.end_date < t && !["complete", "completed", "cancelled"].includes(i.status) && progress.basis === "item statuses").map((i) => ({ item: i.title, was_due: i.end_date })).slice(0, 10),
        financials: {
          contract_value: job.contract_price,
          approved_change_orders_total: ((overview.change_orders ?? []) as Row[]).filter((c) => c.status === "approved").reduce((n, c) => n + (Number(c.amount) || 0), 0),
          open_invoice_balance: (overview.counts as Row)?.open_invoice_balance ?? null,
          invoices: ((overview.invoices ?? []) as Row[]).map((i) => ({ number: i.invoice_number, title: i.title, status: i.status, amount: i.amount, paid: i.amount_paid, due: i.due_date })),
        },
        selections: selRows.map((s) => ({ name: s.name, status: s.selection_status, approval: s.approval_status })),
        vendors: ((overview.vendors ?? []) as Row[]).map((v) => ({ role: v.role, company: v.vendor?.company || `${v.vendor?.first_name ?? ""} ${v.vendor?.last_name ?? ""}`.trim() })),
      };

  return {
    name: job.job_name, number: job.job_number, kind: "Job",
    href: `/dashboard/jobs/${jobId}/summary`,
    portalHref: `/client/jobs/${jobId}/overview`,
    clientFirstNames, photos: photoList, data,
  };
}

async function preconSnapshot(id: string, audience: Audience): Promise<Snapshot | null> {
  const sb = getSupabaseAdmin();
  const { data: o } = await sb.from("pipeline_opportunities").select("*").eq("id", id).maybeSingle();
  if (!o) return null;
  const opp = o as Row;
  const client = audience === "client";
  const [contact, history, logs, punch, deal, media] = await Promise.all([
    opp.contact_id ? sb.from("contacts").select("first_name,last_name,company").eq("id", opp.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("pipeline_stage_history").select("from_stage,to_stage,changed_at").eq("opportunity_id", id).order("changed_at", { ascending: true }),
    sb.from("daily_logs").select("log_date,title,notes,photos,client_visible").eq("opportunity_id", id).order("log_date", { ascending: false }).limit(15),
    punchSummary("precon", id, client),
    sb.from("deals").select("title,stage,notes,next_action,next_action_due,source,estimated_value,created_at").eq("opportunity_id", id).maybeSingle(),
    sb.from("opportunity_media").select("url,media_type,name,note,created_at").eq("opportunity_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const c = contact.data as Row | null;
  const stage = STAGE_META[opp.stage as keyof typeof STAGE_META];
  const at = ALL_STAGES.indexOf(opp.stage);

  const project = {
    name: opp.opportunity_name, number: opp.job_number,
    address: [opp.project_address, opp.city, opp.state, opp.zip_code].filter(Boolean).join(", ") || null,
    stage: stage?.label ?? opp.stage, stage_meaning: stage?.description ?? null,
    next_stage: at >= 0 && at < 3 ? STAGE_META[ALL_STAGES[at + 1]].label : null,
    project_type: opp.project_type, client: c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company : null,
    design_team: { architect: opp.architect, designer: opp.designer, engineer: opp.engineer },
    agreement_status: opp.agreement_status, permit_status: opp.permit_status,
    projected_construction_start: opp.projected_construction_start_date, projected_completion: opp.projected_completion_date,
    estimated_budget_range: opp.estimated_budget_range,
    project_manager: opp.project_manager ?? opp.assigned_owner ?? null,
  };
  const logRows = ((logs.data ?? []) as Row[])
    .filter((l) => (!client || l.client_visible) && !isNegative(`${l.title ?? ""} ${l.notes ?? ""}`))
    .map((l) => ({ date: l.log_date, notes: trim(l.notes || l.title, 400) }));
  const milestones = ((history.data ?? []) as Row[]).map((h) => ({ reached: STAGE_META[h.to_stage as keyof typeof STAGE_META]?.label ?? h.to_stage, on: String(h.changed_at).slice(0, 10) }));

  const photos: SummaryPhoto[] = [];
  for (const m of (media.data ?? []) as Row[]) {
    if ((m.media_type === "image" || /\.(jpe?g|png|webp|heic)$/i.test(m.url ?? "")) && !isNegative(m.note)) photos.push({ url: m.url, caption: trim(m.note, 80) as string | null, date: String(m.created_at).slice(0, 10), clientVisible: false });
  }
  for (const l of (logs.data ?? []) as Row[]) {
    if (isNegative(`${l.title ?? ""} ${l.notes ?? ""}`)) continue;
    for (const url of (Array.isArray(l.photos) ? l.photos : []) as string[]) photos.push({ url, caption: null, date: l.log_date, clientVisible: !!l.client_visible });
  }

  const data = client
    ? {
        today: today(), project, milestones_reached: milestones,
        // Notes hold scope AND internal commentary; the prompt limits the client
        // version to scope, and staff review every summary before it is sent.
        scope_notes_internal_source: trim(opp.notes, 1500),
        daily_logs_recent_positive: logRows, punch_lists: punch,
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
        milestones_reached: milestones,
        notes: trim(opp.notes, 2500),
        pipeline_deal: deal.data ? { ...deal.data, notes: trim((deal.data as Row).notes, 800) } : null,
        daily_logs_recent_positive: logRows, punch_lists: punch,
      };

  const seen = new Set<string>();
  return {
    name: opp.opportunity_name, number: opp.job_number, kind: "Pre-Con",
    href: `/dashboard/sales/${id}`, portalHref: null,
    clientFirstNames: c?.first_name ? [String(c.first_name).trim()] : [],
    photos: photos.filter((p) => /^https:\/\//.test(p.url) && !seen.has(p.url) && seen.add(p.url)).slice(0, 12),
    data,
  };
}
