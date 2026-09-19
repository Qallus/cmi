// Projections data layer (server only). Reads jobs / change orders / invoices
// live and merges them with the forecast overrides in the projections tables.
// Never writes to jobs, invoices or pipeline records.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { jobTeamRole } from "@/lib/jobs/team-roles";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";
import {
  monthOf, monthRange, monthsBetween, evenSpread, spreadMonths, allocation, statusFromJob,
  beyondByYear, applyMonthEdit, respreadFuture, summarize, round2,
} from "./calc";
import {
  ACTIVE_JOB_STATUSES,
  type Projection, type ProjectionRow, type ProjectionBoard, type ProjectionDetail, type ProjectionStatus, type AddableJob,
  type ActualsSource, type PipelineCandidate,
} from "./types";

type Actor = { id: string; name: string | null };

export const WINDOW_MONTHS = 12;

export class ProjectionError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function logActivity(input: { projectionId: string | null; action: string; detail?: Record<string, unknown>; actor?: Actor }): Promise<void> {
  try {
    await getSupabaseAdmin().from("projection_activity").insert({
      projection_id: input.projectionId, action: input.action, detail: input.detail ?? {},
      actor_id: input.actor?.id ?? null, actor_name: input.actor?.name ?? null,
    });
  } catch { /* activity logging must never block the operation */ }
}

// ── Source resolution (batched) ───────────────────────────────────────────

type JobSource = {
  id: string; job_name: string; job_number: string | null; status: JobStatus;
  contract_price: number | null; projected_start_date: string | null; projected_completion_date: string | null;
  project_manager: string | null; superintendent: string | null;
};

type Sources = {
  jobs: Map<string, JobSource>;
  coTotal: Map<string, number>;
  invoicesByJob: Map<string, { month: string; amount: number }[]>;
  pms: Map<string, string[]>;
  supers: Map<string, string[]>;
  clients: Map<string, string>;
};

// Manual PM/Super text is "Name — email · phone"; show just the name.
const manualName = (v: string | null) => (v ? v.split(" — ")[0].trim() : null);

async function loadSources(jobIds: string[]): Promise<Sources> {
  const out: Sources = { jobs: new Map(), coTotal: new Map(), invoicesByJob: new Map(), pms: new Map(), supers: new Map(), clients: new Map() };
  if (jobIds.length === 0) return out;
  const sb = getSupabaseAdmin();
  const [jobs, cos, invs, team, contacts] = await Promise.all([
    sb.from("jobs").select("id,job_name,job_number,status,contract_price,projected_start_date,projected_completion_date,project_manager,superintendent").in("id", jobIds),
    sb.from("change_orders").select("job_id,amount").in("job_id", jobIds).eq("status", "approved"),
    // Billed = issued invoices; drafts aren't billing yet and voids never count.
    sb.from("invoices").select("job_id,amount,issue_date,status").in("job_id", jobIds).not("status", "in", "(void,draft)"),
    sb.from("job_internal_users").select("job_id,role,user:staff_users(display_name,email)").in("job_id", jobIds),
    sb.from("job_contacts").select("job_id,is_primary,contact:contacts(first_name,last_name)").in("job_id", jobIds),
  ]);
  if (jobs.error) throw new Error(jobs.error.message);

  for (const j of (jobs.data ?? []) as JobSource[]) {
    out.jobs.set(j.id, j);
    const pm = manualName(j.project_manager);
    const sup = manualName(j.superintendent);
    if (pm) out.pms.set(j.id, [pm]);
    if (sup) out.supers.set(j.id, [sup]);
  }
  for (const c of cos.data ?? []) out.coTotal.set(c.job_id, (out.coTotal.get(c.job_id) ?? 0) + Number(c.amount ?? 0));
  for (const i of invs.data ?? []) {
    if (!i.issue_date) continue;
    const list = out.invoicesByJob.get(i.job_id) ?? [];
    list.push({ month: monthOf(i.issue_date), amount: Number(i.amount ?? 0) });
    out.invoicesByJob.set(i.job_id, list);
  }
  for (const row of (team.data ?? []) as unknown as { job_id: string; role: string | null; user: { display_name: string | null; email: string | null } | null }[]) {
    const name = row.user?.display_name ?? row.user?.email;
    if (!name) continue;
    const role = jobTeamRole(row.role);
    const map = role === "Project Manager" ? out.pms : role === "Superintendent" ? out.supers : null;
    if (!map) continue;
    map.set(row.job_id, [name, ...(map.get(row.job_id) ?? [])]);
  }
  const contactRows = (contacts.data ?? []) as unknown as { job_id: string; is_primary: boolean; contact: { first_name: string | null; last_name: string | null } | null }[];
  for (const c of [...contactRows].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))) {
    const name = [c.contact?.first_name, c.contact?.last_name].filter(Boolean).join(" ");
    if (name && !out.clients.has(c.job_id)) out.clients.set(c.job_id, name);
  }
  return out;
}

function officialRevenue(job: JobSource | undefined, src: Sources): number | null {
  if (!job) return null;
  if (job.contract_price === null && !src.coTotal.has(job.id)) return null;
  return round2(Number(job.contract_price ?? 0) + (src.coTotal.get(job.id) ?? 0));
}

// ── Row resolution ────────────────────────────────────────────────────────

type Context = {
  src: Sources;
  projectedBy: Map<string, Record<string, number>>;
  originalBy: Map<string, Record<string, number | null>>;
  externalBy: Map<string, { month: string; amount: number }[]>;
  staffName: Map<string, string>;
};

// Everything needed to resolve rows for a set of projections, in a few queries.
async function loadContext(projections: Projection[]): Promise<Context> {
  const sb = getSupabaseAdmin();
  const ids = projections.map((p) => p.id);
  const staffIds = [...new Set(projections.flatMap((p) => [p.pm_staff_id, p.super_staff_id]).filter(Boolean) as string[])];
  const [src, months, externals, staff] = await Promise.all([
    loadSources(projections.map((p) => p.job_id).filter(Boolean) as string[]),
    ids.length ? sb.from("projection_months").select("projection_id,month,projected_amount,original_amount").in("projection_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("projection_actuals").select("projection_id,month,amount").in("projection_id", ids) : Promise.resolve({ data: [] }),
    staffIds.length ? sb.from("staff_users").select("id,display_name,email").in("id", staffIds) : Promise.resolve({ data: [] }),
  ]);
  const ctx: Context = {
    src,
    projectedBy: new Map(),
    originalBy: new Map(),
    externalBy: new Map(),
    staffName: new Map(((staff.data ?? []) as { id: string; display_name: string | null; email: string | null }[]).map((s) => [s.id, s.display_name ?? s.email ?? "—"])),
  };
  for (const m of (months.data ?? []) as { projection_id: string; month: string; projected_amount: number; original_amount: number | null }[]) {
    const rec = ctx.projectedBy.get(m.projection_id) ?? {};
    rec[monthOf(m.month)] = Number(m.projected_amount ?? 0);
    ctx.projectedBy.set(m.projection_id, rec);
    const orig = ctx.originalBy.get(m.projection_id) ?? {};
    orig[monthOf(m.month)] = m.original_amount === null ? null : Number(m.original_amount);
    ctx.originalBy.set(m.projection_id, orig);
  }
  for (const a of (externals.data ?? []) as { projection_id: string; month: string; amount: number }[]) {
    const list = ctx.externalBy.get(a.projection_id) ?? [];
    list.push({ month: monthOf(a.month), amount: Number(a.amount ?? 0) });
    ctx.externalBy.set(a.projection_id, list);
  }
  return ctx;
}

function actualsFor(p: Projection, ctx: Context) {
  return p.actuals_source === "external" ? ctx.externalBy.get(p.id) ?? [] : p.job_id ? ctx.src.invoicesByJob.get(p.job_id) ?? [] : [];
}

// Merge a projection's overrides with its live source data for a month window.
function resolveRow(p: Projection, ctx: Context, window: string[], currentMonth: string, todayIso: string): ProjectionRow {
  const { src } = ctx;
  const job = p.job_id ? src.jobs.get(p.job_id) : undefined;
  const official = officialRevenue(job, src);
  const total = p.revenue_override !== null ? Number(p.revenue_override) : official ?? 0;
  const actuals = actualsFor(p, ctx);
  const billed = round2(actuals.reduce((s, a) => s + a.amount, 0));
  const remaining = round2(total - billed);
  const projected = ctx.projectedBy.get(p.id) ?? {};
  const future = round2(Object.entries(projected).filter(([m]) => m >= currentMonth).reduce((s, [, v]) => s + v, 0));
  const alloc = allocation(Math.max(remaining, 0), future);

  const cells: ProjectionRow["months"] = {};
  for (const m of window) cells[m] = { projected: projected[m] ?? 0, actual: 0 };
  for (const a of actuals) if (cells[a.month]) cells[a.month].actual = round2(cells[a.month].actual + a.amount);

  const warnings: string[] = [];
  if (job && !JOB_STATUS_META[job.status]?.open) warnings.push(`Job ${JOB_STATUS_META[job.status]?.label ?? job.status}`);
  if (p.job_id && !job) warnings.push("Linked job not found");
  const fStart = p.forecast_start ?? job?.projected_start_date ?? null;
  const fFinish = p.forecast_finish ?? job?.projected_completion_date ?? null;
  if (!fStart || !fFinish) warnings.push("No forecast dates");
  else if (fFinish < todayIso && remaining > 0) warnings.push("Finish date passed");
  if (official === null && p.revenue_override === null) warnings.push("No contract value");

  const latestActual = actuals.reduce<string | null>((max, a) => (a.amount && (!max || a.month > max) ? a.month : max), null);

  return {
    id: p.id,
    source: p.job_id ? "job" : p.opportunity_id ? "opportunity" : p.deal_id ? "deal" : "manual",
    job_id: p.job_id,
    opportunity_id: p.opportunity_id,
    deal_id: p.deal_id,
    job_number: job?.job_number ?? null,
    job_status: job?.status ?? null,
    name: job?.job_name ?? p.name ?? "Untitled projection",
    client_name: (p.job_id ? src.clients.get(p.job_id) : null) ?? p.client_name,
    status: p.status ?? statusFromJob(job?.status),
    status_overridden: p.status !== null,
    include: p.include,
    pms: p.pm_staff_id ? [ctx.staffName.get(p.pm_staff_id) ?? "—"] : (p.job_id ? src.pms.get(p.job_id) : null) ?? [],
    supers: p.super_staff_id ? [ctx.staffName.get(p.super_staff_id) ?? "—"] : (p.job_id ? src.supers.get(p.job_id) : null) ?? [],
    forecast_start: fStart,
    forecast_finish: fFinish,
    official_revenue: official,
    total_revenue: round2(total),
    billed_to_date: billed,
    remaining,
    future_projected: future,
    unallocated: alloc.unallocated,
    allocation: alloc.state,
    actuals_source: p.actuals_source,
    has_actuals: actuals.length > 0,
    new_actuals: !!latestActual && latestActual <= currentMonth && (!p.actuals_reviewed_through || latestActual > monthOf(p.actuals_reviewed_through)),
    months: cells,
    window_projected: round2(window.reduce((s, m) => s + cells[m].projected, 0)),
    beyond: beyondByYear(projected, window[window.length - 1]),
    warnings,
  };
}

// ── Board ─────────────────────────────────────────────────────────────────

export async function loadBoard(opts?: { start?: string | null; today?: Date }): Promise<ProjectionBoard> {
  const sb = getSupabaseAdmin();
  const today = opts?.today ?? new Date();
  const currentMonth = monthOf(today);
  const start = opts?.start && /^\d{4}-\d{2}/.test(opts.start) ? monthOf(opts.start) : currentMonth;
  const window = monthRange(start, WINDOW_MONTHS);

  const { data: projData, error } = await sb.from("projections").select("*").is("archived_at", null);
  if (error) throw new Error(error.message);
  const projections = (projData ?? []) as Projection[];
  const ctx = await loadContext(projections);

  const todayIso = isoDate(today);
  const rows = projections.map((p) => resolveRow(p, ctx, window, currentMonth, todayIso));
  rows.sort((a, b) => (a.forecast_start ?? "9999").localeCompare(b.forecast_start ?? "9999") || a.name.localeCompare(b.name));
  return { window, currentMonth, today: todayIso, rows, ...summarize(rows, window, currentMonth, todayIso) };
}

// ── Detail + edits ────────────────────────────────────────────────────────

async function getProjection(id: string): Promise<Projection> {
  const { data, error } = await getSupabaseAdmin().from("projections").select("*").eq("id", id).is("archived_at", null).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new ProjectionError("Projection not found.", 404);
  return data as Projection;
}

// One projection with official (source) vs forecast values, every month that
// has a forecast or actual, and its audit history.
export async function loadDetail(id: string, today = new Date()): Promise<ProjectionDetail> {
  const p = await getProjection(id);
  const ctx = await loadContext([p]);
  const currentMonth = monthOf(today);
  const projected = ctx.projectedBy.get(p.id) ?? {};
  const original = ctx.originalBy.get(p.id) ?? {};
  const actuals = actualsFor(p, ctx);
  const monthKeys = [...new Set([...Object.keys(projected), ...actuals.map((a) => a.month)])].sort();
  const window = monthKeys.length ? monthsBetween(monthKeys[0], monthKeys[monthKeys.length - 1]) : [currentMonth];
  const row = resolveRow(p, ctx, window, currentMonth, isoDate(today));
  const job = p.job_id ? ctx.src.jobs.get(p.job_id) : undefined;

  const { data: billing } = await getSupabaseAdmin().from("projection_actuals")
    .select("id,month,amount,source,external_ref,note,created_at").eq("projection_id", id).order("month", { ascending: false });
  const { data: activity } = await getSupabaseAdmin().from("projection_activity")
    .select("id,action,detail,actor_name,created_at").eq("projection_id", id).order("created_at", { ascending: false }).limit(50);

  return {
    row,
    currentMonth,
    official: {
      status: job ? statusFromJob(job.status) : null,
      start: job?.projected_start_date ?? null,
      finish: job?.projected_completion_date ?? null,
      revenue: row.official_revenue,
      pms: (p.job_id ? ctx.src.pms.get(p.job_id) : null) ?? [],
      supers: (p.job_id ? ctx.src.supers.get(p.job_id) : null) ?? [],
    },
    overrides: {
      status: p.status, forecast_start: p.forecast_start, forecast_finish: p.forecast_finish,
      revenue_override: p.revenue_override === null ? null : Number(p.revenue_override),
      pm_staff_id: p.pm_staff_id, super_staff_id: p.super_staff_id, include: p.include, notes: p.notes,
      actuals_source: p.actuals_source,
    },
    name: p.name,
    client_name: p.client_name,
    billing: ((billing ?? []) as { id: string; month: string; amount: number; source: string; external_ref: string | null; note: string | null; created_at: string }[])
      .map((b) => ({ ...b, month: monthOf(b.month), amount: Number(b.amount) })),
    months: window.map((m) => ({ month: m, projected: projected[m] ?? 0, original: original[m] ?? null, actual: row.months[m]?.actual ?? 0 })),
    activity: (activity ?? []) as ProjectionDetail["activity"],
  };
}

// Upsert month amounts. New months get original_amount = first forecast;
// existing months only change projected_amount (original stays frozen).
async function writeMonths(projectionId: string, next: Record<string, number>, existing: Record<string, number>) {
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();
  const updates = Object.entries(next).filter(([m]) => m in existing && existing[m] !== next[m]);
  const inserts = Object.entries(next).filter(([m]) => !(m in existing));
  if (updates.length) {
    const { error } = await sb.from("projection_months").upsert(
      updates.map(([month, amount]) => ({ projection_id: projectionId, month, projected_amount: amount, updated_at: now })),
      { onConflict: "projection_id,month", defaultToNull: false },
    );
    if (error) throw new Error(error.message);
  }
  if (inserts.length) {
    const { error } = await sb.from("projection_months").insert(
      inserts.map(([month, amount]) => ({ projection_id: projectionId, month, projected_amount: amount, original_amount: amount })),
    );
    if (error) throw new Error(error.message);
  }
  return updates.length + inserts.length;
}

// Forecast months to spread over: the forecast window from the current month
// on, or — with no dates — the future months that already hold an amount.
function spreadTargets(row: ProjectionRow, existing: Record<string, number>, currentMonth: string): string[] {
  const window = spreadMonths(row.forecast_start, row.forecast_finish, currentMonth);
  if (window.length) return window;
  return Object.keys(existing).filter((m) => m >= currentMonth && existing[m] > 0).sort();
}

export async function setMonth(id: string, input: { month: string; amount: number; mode: "leave" | "redistribute" }, actor: Actor, today = new Date()) {
  if (!/^\d{4}-\d{2}/.test(input.month)) throw new ProjectionError("Invalid month.");
  if (!Number.isFinite(input.amount) || input.amount < 0) throw new ProjectionError("Amount must be zero or more.");
  const p = await getProjection(id);
  const ctx = await loadContext([p]);
  const currentMonth = monthOf(today);
  const month = monthOf(input.month);
  const existing = ctx.projectedBy.get(p.id) ?? {};
  const row = resolveRow(p, ctx, [month], currentMonth, isoDate(today));
  const next = applyMonthEdit({
    existing, month, amount: input.amount, mode: input.mode,
    remaining: Math.max(row.remaining, 0), targets: spreadTargets(row, existing, currentMonth), currentMonth,
  });
  const changed = await writeMonths(p.id, next, existing);
  await logActivity({
    projectionId: p.id, action: "month_edited", actor,
    detail: { month, before: existing[month] ?? 0, after: round2(input.amount), mode: input.mode, months_changed: changed },
  });
}

const STATUSES: ProjectionStatus[] = ["contracted", "preconstruction", "likely", "proposal", "on_hold"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ProjectionPatch = Partial<ProjectionDetail["overrides"]> & { name?: string; client_name?: string | null; respread?: boolean };

// Update forecast overrides (null = back to the source value). With
// `respread`, the future forecast is replaced by an even spread of the
// remaining revenue over the (new) forecast window.
export async function updateProjection(id: string, patch: ProjectionPatch, actor: Actor, today = new Date()) {
  const p = await getProjection(id);
  const update: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};

  const set = (key: keyof Projection, value: unknown) => {
    const current = key === "revenue_override" && p.revenue_override !== null ? Number(p.revenue_override) : p[key];
    if (current === value) return;
    update[key] = value;
    before[key] = current;
  };
  if ("status" in patch) {
    if (patch.status !== null && !STATUSES.includes(patch.status as ProjectionStatus)) throw new ProjectionError("Invalid status.");
    set("status", patch.status ?? null);
  }
  for (const key of ["forecast_start", "forecast_finish"] as const) {
    if (!(key in patch)) continue;
    const v = patch[key] || null;
    if (v !== null && !DATE_RE.test(v)) throw new ProjectionError("Dates must be YYYY-MM-DD.");
    set(key, v);
  }
  if ("revenue_override" in patch) {
    const v = patch.revenue_override;
    if (v !== null && v !== undefined && (!Number.isFinite(v) || v < 0)) throw new ProjectionError("Revenue must be zero or more.");
    set("revenue_override", v === undefined ? null : v === null ? null : round2(v));
  }
  for (const key of ["pm_staff_id", "super_staff_id"] as const) {
    if (key in patch) set(key, patch[key] || null);
  }
  if ("include" in patch && typeof patch.include === "boolean") set("include", patch.include);
  // Name / client only matter for anticipated work (a job supplies its own).
  if ("name" in patch && !p.job_id) {
    if (!patch.name?.trim()) throw new ProjectionError("Name is required.");
    set("name", patch.name.trim());
  }
  if ("client_name" in patch && !p.job_id) set("client_name", patch.client_name?.trim() || null);
  if ("notes" in patch) set("notes", patch.notes?.trim() ? patch.notes.trim() : null);
  if ("actuals_source" in patch) {
    if (!["cmi_invoices", "external"].includes(String(patch.actuals_source))) throw new ProjectionError("Invalid actuals source.");
    set("actuals_source", patch.actuals_source);
  }

  const start = (update.forecast_start ?? p.forecast_start) as string | null;
  const finish = (update.forecast_finish ?? p.forecast_finish) as string | null;
  if (start && finish && finish < start) throw new ProjectionError("Forecast finish must be on or after the start.");

  if (Object.keys(update).length) {
    const { error } = await getSupabaseAdmin().from("projections")
      .update({ ...update, updated_by: actor.id, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity({ projectionId: id, action: "updated", actor, detail: { before, after: update } });
  }

  if (patch.respread) {
    const fresh = await getProjection(id);
    const ctx = await loadContext([fresh]);
    const currentMonth = monthOf(today);
    const existing = ctx.projectedBy.get(id) ?? {};
    const row = resolveRow(fresh, ctx, [currentMonth], currentMonth, isoDate(today));
    const months = spreadMonths(row.forecast_start, row.forecast_finish, currentMonth);
    if (!months.length) throw new ProjectionError("Set forecast start and finish dates before respreading.");
    const changed = await writeMonths(id, respreadFuture(existing, Math.max(row.remaining, 0), months, currentMonth), existing);
    await logActivity({ projectionId: id, action: "respread", actor, detail: { remaining: row.remaining, from: months[0], to: months[months.length - 1], months_changed: changed } });
  }
}

// Remove from Projections (archive). Adding the job again restores it with
// its forecast history.
export async function archiveProjection(id: string, actor: Actor) {
  await getProjection(id);
  const { error } = await getSupabaseAdmin().from("projections")
    .update({ archived_at: new Date().toISOString(), updated_by: actor.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ projectionId: id, action: "removed", actor });
}

// ── Adding jobs ───────────────────────────────────────────────────────────

// Real, non-archived jobs that aren't already in Projections.
export async function listAddableJobs(): Promise<AddableJob[]> {
  const sb = getSupabaseAdmin();
  const [jobs, existing] = await Promise.all([
    sb.from("jobs").select("id,job_name,job_number,status,contract_price,projected_start_date,projected_completion_date")
      .eq("is_template", false).is("archived_at", null).order("job_name"),
    sb.from("projections").select("job_id").is("archived_at", null).not("job_id", "is", null),
  ]);
  if (jobs.error) throw new Error(jobs.error.message);
  const taken = new Set((existing.data ?? []).map((r) => r.job_id as string));
  return ((jobs.data ?? []) as AddableJob[]).filter((j) => !taken.has(j.id));
}

// Add jobs to Projections with an even spread of their remaining revenue over
// the forecast window. A previously removed (archived) projection for the job
// is restored with its history instead of creating a new one.
export async function addJobs(jobIds: string[], actor: Actor, today = new Date()): Promise<{ added: number; skipped: number }> {
  const sb = getSupabaseAdmin();
  const unique = [...new Set(jobIds)].filter(Boolean);
  if (unique.length === 0) return { added: 0, skipped: 0 };

  const [src, existingRes] = await Promise.all([
    loadSources(unique),
    sb.from("projections").select("id,job_id,archived_at").in("job_id", unique),
  ]);
  const existing = new Map(((existingRes.data ?? []) as { id: string; job_id: string; archived_at: string | null }[]).map((p) => [p.job_id, p]));
  const currentMonth = monthOf(today);
  let added = 0, skipped = 0;

  for (const jobId of unique) {
    const job = src.jobs.get(jobId);
    const prior = existing.get(jobId);
    if (!job || (prior && !prior.archived_at)) { skipped += 1; continue; }

    if (prior) {
      await sb.from("projections").update({ archived_at: null, updated_by: actor.id, updated_at: new Date().toISOString() }).eq("id", prior.id);
      await logActivity({ projectionId: prior.id, action: "restored", detail: { job_id: jobId }, actor });
      added += 1;
      continue;
    }

    const { data: created, error } = await sb.from("projections")
      .insert({ job_id: jobId, actuals_source: await defaultActualsSource(), created_by: actor.id, updated_by: actor.id })
      .select("id").single();
    if (error || !created) {
      // Unique job_id race (added in another tab) — treat as already present.
      if (error?.code === "23505") { skipped += 1; continue; }
      throw new Error(error?.message ?? "Could not create projection.");
    }

    const total = officialRevenue(job, src) ?? 0;
    const billed = (src.invoicesByJob.get(jobId) ?? []).reduce((s, i) => s + i.amount, 0);
    const spread = evenSpread(total - billed, spreadMonths(job.projected_start_date, job.projected_completion_date, currentMonth));
    const monthRows = Object.entries(spread).map(([month, amount]) => ({ projection_id: created.id, month, projected_amount: amount, original_amount: amount }));
    if (monthRows.length) {
      const { error: mErr } = await sb.from("projection_months").insert(monthRows);
      if (mErr) throw new Error(mErr.message);
    }
    await logActivity({
      projectionId: created.id, action: "added", actor,
      detail: { job_id: jobId, job_name: job.job_name, total, billed: round2(billed), months: monthRows.length },
    });
    added += 1;
  }
  return { added, skipped };
}

export async function activeJobIds(): Promise<string[]> {
  const jobs = await listAddableJobs();
  return jobs.filter((j) => ACTIVE_JOB_STATUSES.includes(j.status)).map((j) => j.id);
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Anticipated work (not yet a job) ──────────────────────────────────────

export type AnticipatedInput = {
  name: string;
  client_name?: string | null;
  revenue: number;
  status?: ProjectionStatus | null;
  forecast_start?: string | null;
  forecast_finish?: string | null;
  pm_staff_id?: string | null;
  super_staff_id?: string | null;
  notes?: string | null;
  deal_id?: string | null;
  opportunity_id?: string | null;
  contact_id?: string | null;
};

// Create a projection for work that isn't a job yet (manual or from the
// Pipeline). Revenue lives in revenue_override; it's spread evenly over the
// forecast dates. Relinks to the job automatically on Promote to Job.
export async function createAnticipated(input: AnticipatedInput, actor: Actor, today = new Date()): Promise<{ id: string }> {
  const sb = getSupabaseAdmin();
  const name = input.name?.trim();
  if (!name) throw new ProjectionError("Name is required.");
  if (!Number.isFinite(input.revenue) || input.revenue < 0) throw new ProjectionError("Anticipated value must be zero or more.");
  if (input.status && !STATUSES.includes(input.status)) throw new ProjectionError("Invalid status.");
  for (const d of [input.forecast_start, input.forecast_finish]) if (d && !DATE_RE.test(d)) throw new ProjectionError("Dates must be YYYY-MM-DD.");
  if (input.forecast_start && input.forecast_finish && input.forecast_finish < input.forecast_start) throw new ProjectionError("Forecast finish must be on or after the start.");

  // One projection per pipeline record.
  for (const [col, val] of [["deal_id", input.deal_id], ["opportunity_id", input.opportunity_id]] as const) {
    if (!val) continue;
    const { data } = await sb.from("projections").select("id").eq(col, val).is("archived_at", null).limit(1);
    if (data?.length) throw new ProjectionError("That pipeline record is already in Projections.", 409);
  }

  const { data: created, error } = await sb.from("projections").insert({
    name,
    client_name: input.client_name?.trim() || null,
    revenue_override: round2(input.revenue),
    status: input.status ?? "likely",
    forecast_start: input.forecast_start || null,
    forecast_finish: input.forecast_finish || null,
    pm_staff_id: input.pm_staff_id || null,
    super_staff_id: input.super_staff_id || null,
    notes: input.notes?.trim() || null,
    deal_id: input.deal_id || null,
    opportunity_id: input.opportunity_id || null,
    contact_id: input.contact_id || null,
    actuals_source: await defaultActualsSource(),
    created_by: actor.id,
    updated_by: actor.id,
  }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Could not create projection.");

  const spread = evenSpread(input.revenue, spreadMonths(input.forecast_start ?? null, input.forecast_finish ?? null, monthOf(today)));
  const months = await writeMonths(created.id, spread, {});
  await logActivity({
    projectionId: created.id, action: "added", actor,
    detail: { anticipated: true, name, total: round2(input.revenue), billed: 0, months, deal_id: input.deal_id ?? null, opportunity_id: input.opportunity_id ?? null },
  });
  return { id: created.id };
}

// Copy an anticipated projection (scenario planning). Job-linked projections
// can't be duplicated — a job has exactly one projection.
export async function duplicateProjection(id: string, actor: Actor): Promise<{ id: string }> {
  const sb = getSupabaseAdmin();
  const p = await getProjection(id);
  if (p.job_id) throw new ProjectionError("Job projections can't be duplicated. Duplicate anticipated projects only.");
  const { data: created, error } = await sb.from("projections").insert({
    name: `${p.name ?? "Untitled projection"} (copy)`,
    client_name: p.client_name, revenue_override: p.revenue_override, status: p.status,
    forecast_start: p.forecast_start, forecast_finish: p.forecast_finish,
    pm_staff_id: p.pm_staff_id, super_staff_id: p.super_staff_id, include: p.include,
    actuals_source: p.actuals_source, notes: p.notes, contact_id: p.contact_id,
    created_by: actor.id, updated_by: actor.id,
  }).select("id").single();
  if (error || !created) throw new Error(error?.message ?? "Could not duplicate.");
  const { data: months } = await sb.from("projection_months").select("month,projected_amount").eq("projection_id", id);
  const copy = Object.fromEntries((months ?? []).map((m) => [monthOf(m.month as string), Number(m.projected_amount ?? 0)]));
  await writeMonths(created.id, copy, {});
  await logActivity({ projectionId: created.id, action: "duplicated", actor, detail: { from: id } });
  return { id: created.id };
}

// ── Settings (company-wide) ───────────────────────────────────────────────

export type ProjectionSettings = { default_actuals_source: ActualsSource; workload_threshold: number };
const SETTING_DEFAULTS: ProjectionSettings = { default_actuals_source: "cmi_invoices", workload_threshold: 3 };

export async function loadSettings(): Promise<ProjectionSettings> {
  const { data } = await getSupabaseAdmin().from("projection_settings").select("key,value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value]));
  return {
    default_actuals_source: map.default_actuals_source === "external" ? "external" : "cmi_invoices",
    workload_threshold: Number.isFinite(Number(map.workload_threshold)) && Number(map.workload_threshold) > 0 ? Number(map.workload_threshold) : SETTING_DEFAULTS.workload_threshold,
  };
}

export async function saveSettings(patch: Partial<ProjectionSettings>, actor: Actor): Promise<ProjectionSettings> {
  const rows: { key: string; value: unknown; updated_by: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (patch.default_actuals_source !== undefined) {
    if (!["cmi_invoices", "external"].includes(patch.default_actuals_source)) throw new ProjectionError("Invalid actuals source.");
    rows.push({ key: "default_actuals_source", value: patch.default_actuals_source, updated_by: actor.id, updated_at: now });
  }
  if (patch.workload_threshold !== undefined) {
    const n = Math.round(Number(patch.workload_threshold));
    if (!Number.isFinite(n) || n < 1 || n > 50) throw new ProjectionError("Threshold must be between 1 and 50.");
    rows.push({ key: "workload_threshold", value: n, updated_by: actor.id, updated_at: now });
  }
  if (rows.length) {
    const { error } = await getSupabaseAdmin().from("projection_settings").upsert(rows, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await logActivity({ projectionId: null, action: "settings_updated", actor, detail: patch as Record<string, unknown> });
  }
  return loadSettings();
}

async function defaultActualsSource(): Promise<ActualsSource> {
  try { return (await loadSettings()).default_actuals_source; } catch { return "cmi_invoices"; }
}

// ── Pipeline candidates ───────────────────────────────────────────────────

const DEAL_CANDIDATE_STAGES = ["qualified", "opportunity", "proposal", "negotiation"];
const OPP_EXCLUDED_STAGES = ["closed", "not_moving_forward"];

function statusFromDealStage(stage: string): ProjectionStatus {
  return stage === "proposal" ? "proposal" : stage === "lost_on_hold" ? "on_hold" : "likely";
}
function statusFromOpportunityStage(stage: string): ProjectionStatus {
  switch (stage) {
    case "active_budget": return "proposal";
    case "pre_construction_design": return "preconstruction";
    case "active_project": case "warranty": return "contracted";
    case "long_lead": return "on_hold";
    default: return "likely";
  }
}

// Deals (Qualified → Negotiation, not yet Pre-Con) and Pre-Con opportunities
// (not yet a job) that aren't in Projections, prefilled for the Anticipated form.
export async function listPipelineCandidates(): Promise<PipelineCandidate[]> {
  const sb = getSupabaseAdmin();
  const [deals, opps, taken, jobs, staff] = await Promise.all([
    sb.from("deals").select("id,title,stage,contact_id,estimated_value,target_start_date,expected_close_date,owner_id")
      .in("stage", DEAL_CANDIDATE_STAGES).is("opportunity_id", null),
    sb.from("pipeline_opportunities").select("id,opportunity_name,stage,contact_id,projected_construction_value,current_budget_total,estimated_project_value,projected_construction_start_date,start_date,projected_completion_date,project_manager,superintendent,job_number")
      .not("stage", "in", `(${OPP_EXCLUDED_STAGES.join(",")})`),
    sb.from("projections").select("deal_id,opportunity_id").is("archived_at", null),
    sb.from("jobs").select("related_opportunity_id").not("related_opportunity_id", "is", null).is("archived_at", null),
    sb.from("staff_users").select("id,display_name").in("status", ["active", "invited"]),
  ]);
  const takenDeals = new Set((taken.data ?? []).map((t) => t.deal_id).filter(Boolean));
  const takenOpps = new Set([...(taken.data ?? []).map((t) => t.opportunity_id), ...(jobs.data ?? []).map((j) => j.related_opportunity_id)].filter(Boolean));
  const contactIds = [...new Set([...(deals.data ?? []), ...(opps.data ?? [])].map((r) => r.contact_id).filter(Boolean))] as string[];
  const { data: contacts } = contactIds.length ? await sb.from("contacts").select("id,first_name,last_name").in("id", contactIds) : { data: [] };
  const contactName = new Map((contacts ?? []).map((c) => [c.id, [c.first_name, c.last_name].filter(Boolean).join(" ")]));
  // Opportunity PM/Super are free-text names; best-effort match to staff.
  const staffByName = new Map((staff.data ?? []).filter((s) => s.display_name).map((s) => [String(s.display_name).trim().toLowerCase(), s.id as string]));
  const matchStaff = (name: string | null) => (name ? staffByName.get(name.split(" — ")[0].trim().toLowerCase()) ?? null : null);

  const out: PipelineCandidate[] = [];
  for (const d of deals.data ?? []) {
    if (takenDeals.has(d.id)) continue;
    out.push({
      kind: "deal", id: d.id, name: d.title ?? "Untitled deal", client_name: contactName.get(d.contact_id) || null, contact_id: d.contact_id,
      value: Number(d.estimated_value ?? 0), start: d.target_start_date ?? null, finish: null,
      status: statusFromDealStage(d.stage), stage: d.stage, pm_staff_id: null, super_staff_id: null,
    });
  }
  for (const o of opps.data ?? []) {
    if (takenOpps.has(o.id)) continue;
    out.push({
      kind: "opportunity", id: o.id, name: o.opportunity_name ?? o.job_number ?? "Untitled opportunity", client_name: contactName.get(o.contact_id) || null, contact_id: o.contact_id,
      value: Number(o.projected_construction_value ?? o.current_budget_total ?? o.estimated_project_value ?? 0),
      start: o.projected_construction_start_date ?? o.start_date ?? null, finish: o.projected_completion_date ?? null,
      status: statusFromOpportunityStage(o.stage), stage: o.stage,
      pm_staff_id: matchStaff(o.project_manager), super_staff_id: matchStaff(o.superintendent),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Where a deal / opportunity / job sits in Projections (for "In Projections"
// badges and buttons on other pages).
export async function findLink(by: { deal_id?: string | null; opportunity_id?: string | null; job_id?: string | null }): Promise<string | null> {
  const col = by.job_id ? "job_id" : by.opportunity_id ? "opportunity_id" : by.deal_id ? "deal_id" : null;
  const val = by.job_id ?? by.opportunity_id ?? by.deal_id;
  if (!col || !val) return null;
  const { data } = await getSupabaseAdmin().from("projections").select("id").eq(col, val).is("archived_at", null).limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

// ── Actuals (external billing) ────────────────────────────────────────────

export async function addActual(id: string, input: { month: string; amount: number; note?: string | null }, actor: Actor) {
  await getProjection(id);
  if (!/^\d{4}-\d{2}/.test(input.month ?? "")) throw new ProjectionError("Month is required.");
  if (!Number.isFinite(input.amount) || input.amount === 0) throw new ProjectionError("Enter a non-zero amount.");
  const month = monthOf(input.month);
  const { error } = await getSupabaseAdmin().from("projection_actuals").insert({
    projection_id: id, month, amount: round2(input.amount), source: "manual", note: input.note?.trim() || null, created_by: actor.id,
  });
  if (error) throw new Error(error.message);
  await logActivity({ projectionId: id, action: "actual_added", actor, detail: { month, amount: round2(input.amount), source: "manual" } });
}

export async function deleteActual(id: string, actualId: string, actor: Actor) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("projection_actuals").select("month,amount,source").eq("id", actualId).eq("projection_id", id).maybeSingle();
  if (!data) throw new ProjectionError("Billing entry not found.", 404);
  const { error } = await sb.from("projection_actuals").delete().eq("id", actualId);
  if (error) throw new Error(error.message);
  await logActivity({ projectionId: id, action: "actual_deleted", actor, detail: data as Record<string, unknown> });
}

// "New actuals — review forecast": keep the forecast as is, or respread what's
// remaining over the future forecast months. Either way the latest billed
// month is marked reviewed.
export async function reviewActuals(id: string, mode: "keep" | "redistribute", actor: Actor, today = new Date()) {
  const p = await getProjection(id);
  const ctx = await loadContext([p]);
  const currentMonth = monthOf(today);
  const actuals = actualsFor(p, ctx);
  const latest = actuals.map((a) => a.month).filter((m) => m <= currentMonth).sort().pop() ?? currentMonth;
  if (mode === "redistribute") {
    const existing = ctx.projectedBy.get(id) ?? {};
    const row = resolveRow(p, ctx, [currentMonth], currentMonth, isoDate(today));
    const months = spreadTargets(row, existing, currentMonth);
    if (!months.length) throw new ProjectionError("Set forecast dates before redistributing.");
    await writeMonths(id, respreadFuture(existing, Math.max(row.remaining, 0), months, currentMonth), existing);
  }
  const { error } = await getSupabaseAdmin().from("projections").update({ actuals_reviewed_through: latest, updated_by: actor.id, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logActivity({ projectionId: id, action: "actuals_reviewed", actor, detail: { mode, through: latest } });
}

// ── CSV import (Adaptive / QuickBooks billing exports) ────────────────────

export type ImportRowInput = { customer?: string | null; job?: string | null; date: string; amount: number; ref?: string | null; memo?: string | null };
export type ImportPreviewRow = ImportRowInput & {
  index: number;
  month: string | null;
  projection_id: string | null;
  projection_name: string | null;
  matched_by: "accounting_customer_id" | "job_number" | "name" | null;
  actuals_source: ActualsSource | null;
  external_ref: string;
  duplicate: boolean;
  error: string | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const externalRef = (r: ImportRowInput) => (r.ref?.trim() ? `ref:${r.ref.trim()}` : `row:${r.date}|${round2(r.amount)}|${norm(r.customer || r.job)}`);

type MatchTarget = Pick<Projection, "id" | "job_id" | "name" | "actuals_source">;

// Match billing rows to projections: accounting customer id first, then job
// number, then job / project name. Unmatched rows come back for review.
export async function previewImport(rows: ImportRowInput[]): Promise<ImportPreviewRow[]> {
  const sb = getSupabaseAdmin();
  const { data: projData } = await sb.from("projections").select("id,job_id,name,actuals_source").is("archived_at", null);
  const projections = (projData ?? []) as MatchTarget[];
  const jobIds = projections.map((p) => p.job_id).filter(Boolean) as string[];
  const { data: jobs } = jobIds.length ? await sb.from("jobs").select("id,job_name,job_number,accounting_customer_id").in("id", jobIds) : { data: [] };
  const jobById = new Map((jobs ?? []).map((j) => [j.id as string, j as { job_name: string; job_number: string | null; accounting_customer_id: string | null }]));
  const shortNumber = (v: string) => v.split("_").slice(0, 2).join("_");
  const byCustomer = new Map<string, MatchTarget>();
  const byNumber = new Map<string, MatchTarget>();
  const byName = new Map<string, MatchTarget>();
  for (const p of projections) {
    const j = p.job_id ? jobById.get(p.job_id) : undefined;
    if (j?.accounting_customer_id) byCustomer.set(norm(j.accounting_customer_id), p);
    if (j?.job_number) { byNumber.set(norm(j.job_number), p); byNumber.set(norm(shortNumber(j.job_number)), p); }
    const name = j?.job_name ?? p.name;
    if (name) byName.set(norm(name), p);
  }
  const nameOf = (p: MatchTarget) => (p.job_id ? jobById.get(p.job_id)?.job_name : null) ?? p.name ?? "Untitled";

  const refs = rows.map(externalRef);
  const { data: existing } = refs.length ? await sb.from("projection_actuals").select("external_ref").in("external_ref", refs) : { data: [] };
  const seen = new Set((existing ?? []).map((e) => e.external_ref));

  return rows.map((r, index) => {
    const valid = DATE_RE.test(r.date ?? "") && Number.isFinite(r.amount) && r.amount !== 0;
    const keys = [r.customer, r.job].map(norm).filter(Boolean);
    let hit: MatchTarget | undefined;
    let matched_by: ImportPreviewRow["matched_by"] = null;
    for (const k of keys) { hit = byCustomer.get(k); if (hit) { matched_by = "accounting_customer_id"; break; } }
    if (!hit) for (const k of keys) { hit = byNumber.get(k) ?? byNumber.get(shortNumber(k)); if (hit) { matched_by = "job_number"; break; } }
    if (!hit) for (const k of keys) { hit = byName.get(k); if (hit) { matched_by = "name"; break; } }
    return {
      ...r, index, month: valid ? monthOf(r.date) : null,
      projection_id: hit?.id ?? null, projection_name: hit ? nameOf(hit) : null, matched_by,
      actuals_source: hit?.actuals_source ?? null,
      external_ref: refs[index], duplicate: seen.has(refs[index]),
      error: valid ? null : "Needs a date and a non-zero amount",
    };
  });
}

// Save confirmed rows as csv_import actuals. Re-imports are skipped by
// external_ref. With switchSource, matched projections that read CMI invoices
// move to external billing so nothing is counted twice.
export async function importActuals(rows: { projection_id: string; date: string; amount: number; external_ref: string; note?: string | null }[], switchSource: boolean, actor: Actor) {
  const sb = getSupabaseAdmin();
  const clean = rows.filter((r) => r.projection_id && DATE_RE.test(r.date) && Number.isFinite(r.amount) && r.amount !== 0 && r.external_ref);
  if (!clean.length) throw new ProjectionError("No valid rows to import.");
  const ids = [...new Set(clean.map((r) => r.projection_id))];
  const { data: valid } = await sb.from("projections").select("id,actuals_source").in("id", ids).is("archived_at", null);
  const validIds = new Map((valid ?? []).map((p) => [p.id as string, p.actuals_source as ActualsSource]));
  const { data: existing } = await sb.from("projection_actuals").select("projection_id,external_ref").in("projection_id", ids).eq("source", "csv_import");
  const seen = new Set((existing ?? []).map((e) => `${e.projection_id}|${e.external_ref}`));
  const insert = clean
    .filter((r) => validIds.has(r.projection_id) && !seen.has(`${r.projection_id}|${r.external_ref}`))
    .filter((r, i, all) => all.findIndex((x) => x.projection_id === r.projection_id && x.external_ref === r.external_ref) === i)
    .map((r) => ({ projection_id: r.projection_id, month: monthOf(r.date), amount: round2(r.amount), source: "csv_import", external_ref: r.external_ref, note: r.note?.trim() || null, created_by: actor.id }));
  if (insert.length) {
    const { error } = await sb.from("projection_actuals").insert(insert);
    if (error) throw new Error(error.message);
  }
  const switched: string[] = [];
  if (switchSource) {
    const toSwitch = [...new Set(insert.map((r) => r.projection_id))].filter((id) => validIds.get(id) === "cmi_invoices");
    if (toSwitch.length) {
      const { error } = await sb.from("projections").update({ actuals_source: "external", updated_by: actor.id, updated_at: new Date().toISOString() }).in("id", toSwitch);
      if (error) throw new Error(error.message);
      switched.push(...toSwitch);
    }
  }
  for (const id of new Set(insert.map((r) => r.projection_id))) {
    const mine = insert.filter((r) => r.projection_id === id);
    await logActivity({ projectionId: id, action: "actuals_imported", actor, detail: { rows: mine.length, total: round2(mine.reduce((s, r) => s + r.amount, 0)), switched_source: switched.includes(id) } });
  }
  return { imported: insert.length, skipped: clean.length - insert.length, invalid: rows.length - clean.length, switched: switched.length };
}

// ── Read models for other surfaces (all callers must be admin-gated) ──────

export type JobForecast =
  | { projection_id: null }
  | {
      projection_id: string; include: boolean; status: ProjectionStatus; forecast_start: string | null; forecast_finish: string | null;
      total: number; billed: number; remaining: number; allocation: ProjectionRow["allocation"]; unallocated: number;
      next3: { month: string; projected: number }[];
    };

// Job Summary "Forecast" card.
export async function loadJobForecast(jobId: string, today = new Date()): Promise<JobForecast> {
  const id = await findLink({ job_id: jobId });
  if (!id) return { projection_id: null };
  const detail = await loadDetail(id, today);
  const r = detail.row;
  return {
    projection_id: id, include: r.include, status: r.status, forecast_start: r.forecast_start, forecast_finish: r.forecast_finish,
    total: r.total_revenue, billed: r.billed_to_date, remaining: r.remaining, allocation: r.allocation, unallocated: r.unallocated,
    next3: monthRange(detail.currentMonth, 3).map((m) => ({ month: m, projected: detail.months.find((x) => x.month === m)?.projected ?? 0 })),
  };
}

export type Outlook = {
  anyActuals: boolean;
  next3: { month: string; projected: number; actual: number }[];
  summary: ProjectionBoard["summary"];
  projects: number;
};

// Overview "Revenue Outlook" card and the Bolt summary tool.
export async function loadOutlook(today = new Date()): Promise<Outlook> {
  const board = await loadBoard({ today });
  return {
    anyActuals: board.anyActuals,
    next3: board.totals.slice(0, 3).map((t) => ({ month: t.month, projected: t.projected, actual: t.actual })),
    summary: board.summary,
    projects: board.rows.filter((r) => r.include).length,
  };
}
