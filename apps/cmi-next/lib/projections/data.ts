// Projections data layer (server only). Reads jobs / change orders / invoices
// live and merges them with the forecast overrides in the projections tables.
// Never writes to jobs, invoices or pipeline records.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { jobTeamRole } from "@/lib/jobs/team-roles";
import { JOB_STATUS_META } from "@/lib/jobs/status";
import type { JobStatus } from "@/lib/jobs/types";
import {
  monthOf, monthRange, monthsBetween, evenSpread, spreadMonths, allocation, statusFromJob,
  isCommitted, monthTotals, beyondByYear, applyMonthEdit, respreadFuture, round2,
} from "./calc";
import {
  ACTIVE_JOB_STATUSES,
  type Projection, type ProjectionRow, type ProjectionBoard, type ProjectionDetail, type ProjectionStatus, type AddableJob,
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

  return {
    id: p.id,
    job_id: p.job_id,
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

  const soon = new Date(today); soon.setDate(soon.getDate() + 30);
  const todayIso = isoDate(today), soonIso = isoDate(soon);

  const rows = projections.map((p) => resolveRow(p, ctx, window, currentMonth, todayIso));
  rows.sort((a, b) => (a.forecast_start ?? "9999").localeCompare(b.forecast_start ?? "9999") || a.name.localeCompare(b.name));

  const included = rows.filter((r) => r.include);
  const totals = monthTotals(rows, window, currentMonth);
  const beyondTotals: Record<string, number> = {};
  for (const r of included) for (const [y, v] of Object.entries(r.beyond)) beyondTotals[y] = round2((beyondTotals[y] ?? 0) + v);
  const anyActuals = included.some((r) => r.has_actuals);
  const backlog = (pred: (r: ProjectionRow) => boolean) => round2(included.filter(pred).reduce((s, r) => s + Math.max(r.remaining, 0), 0));
  const started = totals.filter((t) => t.variance !== null);

  return {
    window,
    currentMonth,
    rows,
    totals,
    beyondTotals,
    anyActuals,
    summary: {
      projected12: round2(totals.reduce((s, t) => s + t.projected, 0)),
      actual12: round2(totals.reduce((s, t) => s + t.actual, 0)),
      varianceToDate: anyActuals && started.length ? round2(started.reduce((s, t) => s + (t.variance ?? 0), 0)) : null,
      remainingBacklog: backlog(() => true),
      contractedBacklog: backlog((r) => isCommitted(r.status)),
      potentialBacklog: backlog((r) => !isCommitted(r.status)),
      beyondBacklog: round2(Object.values(beyondTotals).reduce((s, v) => s + v, 0)),
      activeProjects: included.filter((r) => r.window_projected > 0).length,
      startingSoon: included.filter((r) => r.forecast_start && r.forecast_start >= todayIso && r.forecast_start <= soonIso).length,
      endingSoon: included.filter((r) => r.forecast_finish && r.forecast_finish >= todayIso && r.forecast_finish <= soonIso).length,
    },
  };
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
    },
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

export type ProjectionPatch = Partial<ProjectionDetail["overrides"]> & { respread?: boolean };

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
  if ("notes" in patch) set("notes", patch.notes?.trim() ? patch.notes.trim() : null);

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
      .insert({ job_id: jobId, created_by: actor.id, updated_by: actor.id })
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
