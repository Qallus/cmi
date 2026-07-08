// Data-access layer for the Jobs feature. All access uses the service-role
// client (RLS bypassed server-side); role gating lives in the API routes.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { geocodeAddress } from "./geocode";
import { opportunityStageToJobStatus } from "./status";
import type {
  Job, JobDraft, JobType, JobGroup, JobContact, JobInternalUser, JobVendor,
  JobSettings, JobInsurance, JobWithRelations, PriceSummary, JobStatus,
} from "./types";

type Actor = { name?: string | null; id?: string | null };

// A denormalized row for the Jobs List / Map (derived client/PM/type fields).
export type JobListRow = Job & {
  type_name: string | null;
  type_color: string | null;
  group_name: string | null;
  clients: { name: string; phone: string | null }[];
  project_managers: string[];
};

export class JobError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function fullAddress(d: Partial<Job>): string | null {
  const s = [d.street_address, d.city, d.state, d.zip_code].map((x) => (x ?? "").trim()).filter(Boolean);
  return s.length ? s.join(", ") : null;
}

function sanitize(draft: Partial<Job>): Partial<Job> {
  const clone = { ...draft } as Record<string, unknown>;
  delete clone.id; delete clone.job_number; delete clone.created_at; delete clone.updated_at; delete clone.archived_at;
  return clone as Partial<Job>;
}

// job_name must be globally unique (doc requirement). Append " (n)" on collision
// so conversions/templates don't fail hard on a duplicate name.
async function ensureUniqueJobName(base: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const root = base.trim() || "New Job";
  let candidate = root;
  for (let i = 0; i < 50; i++) {
    const { data } = await sb.from("jobs").select("id").eq("job_name", candidate).maybeSingle();
    if (!data) return candidate;
    candidate = `${root} (${i + 2})`;
  }
  return `${root} ${Date.now().toString(36)}`;
}

async function logJobActivity(jobId: string, action: string, detail: string | null, actor?: Actor) {
  await getSupabaseAdmin().from("job_activity_logs").insert({
    job_id: jobId, action, detail: detail ?? null,
    actor: actor?.name ?? null, actor_id: actor?.id ?? null,
  });
}

// ─── Reference data ────────────────────────────────────────────
export async function loadJobTypes(): Promise<JobType[]> {
  const { data, error } = await getSupabaseAdmin().from("job_types").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as JobType[];
}
export async function loadJobGroups(): Promise<JobGroup[]> {
  const { data, error } = await getSupabaseAdmin().from("job_groups").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as JobGroup[];
}
export async function createJobType(input: Partial<JobType>): Promise<JobType> {
  const { data, error } = await getSupabaseAdmin().from("job_types").insert(input).select().single();
  if (error) throw new JobError(error.message);
  return data as JobType;
}
export async function createJobGroup(input: Partial<JobGroup>): Promise<JobGroup> {
  const { data, error } = await getSupabaseAdmin().from("job_groups").insert(input).select().single();
  if (error) throw new JobError(error.message);
  return data as JobGroup;
}

// ─── List (denormalized rows for table + map) ──────────────────
export async function loadJobList(opts?: { includeTemplates?: boolean; includeArchived?: boolean }): Promise<JobListRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("jobs").select("*").order("created_at", { ascending: false });
  if (!opts?.includeArchived) q = q.is("archived_at", null);
  if (!opts?.includeTemplates) q = q.eq("is_template", false);
  const { data: jobs, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (jobs ?? []) as Job[];
  if (rows.length === 0) return [];

  const jobIds = rows.map((j) => j.id);
  const [{ data: types }, { data: groups }, { data: jcs }, { data: jus }] = await Promise.all([
    sb.from("job_types").select("id,name,color"),
    sb.from("job_groups").select("id,name"),
    sb.from("job_contacts").select("job_id,is_primary,contact:contacts(first_name,last_name,phone)").in("job_id", jobIds),
    sb.from("job_internal_users").select("job_id,user:staff_users(display_name)").in("job_id", jobIds),
  ]);

  const typeMap = new Map((types ?? []).map((t) => [t.id, t]));
  const groupMap = new Map((groups ?? []).map((g) => [g.id, g]));
  const clientsByJob = new Map<string, { name: string; phone: string | null }[]>();
  for (const row of (jcs ?? []) as { job_id: string; is_primary: boolean; contact: { first_name?: string; last_name?: string; phone?: string | null } | null }[]) {
    const c = row.contact;
    if (!c) continue;
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
    const list = clientsByJob.get(row.job_id) ?? [];
    if (row.is_primary) list.unshift({ name, phone: c.phone ?? null });
    else list.push({ name, phone: c.phone ?? null });
    clientsByJob.set(row.job_id, list);
  }
  const pmByJob = new Map<string, string[]>();
  for (const row of (jus ?? []) as { job_id: string; user: { display_name?: string | null } | null }[]) {
    if (!row.user?.display_name) continue;
    const list = pmByJob.get(row.job_id) ?? [];
    list.push(row.user.display_name);
    pmByJob.set(row.job_id, list);
  }

  return rows.map((j) => ({
    ...j,
    type_name: j.job_type_id ? typeMap.get(j.job_type_id)?.name ?? null : null,
    type_color: j.job_type_id ? typeMap.get(j.job_type_id)?.color ?? null : null,
    group_name: j.job_group_id ? groupMap.get(j.job_group_id)?.name ?? null : null,
    clients: clientsByJob.get(j.id) ?? [],
    project_managers: pmByJob.get(j.id) ?? [],
  }));
}

export async function loadTemplates(): Promise<Job[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("jobs").select("*").eq("is_template", true).is("archived_at", null).order("job_name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Job[];
}

// ─── Single job with relations ─────────────────────────────────
export async function getJob(id: string): Promise<JobWithRelations | null> {
  const sb = getSupabaseAdmin();
  const { data: job, error } = await sb.from("jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!job) return null;

  const [jt, jg, contacts, users, vendors, settings, insurance] = await Promise.all([
    job.job_type_id ? sb.from("job_types").select("*").eq("id", job.job_type_id).maybeSingle() : Promise.resolve({ data: null }),
    job.job_group_id ? sb.from("job_groups").select("*").eq("id", job.job_group_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("job_contacts").select("*, contact:contacts(id,first_name,last_name,email,phone,company)").eq("job_id", id),
    sb.from("job_internal_users").select("*, user:staff_users(id,display_name,email,role_slug)").eq("job_id", id),
    sb.from("job_vendors").select("*, vendor:contacts(id,first_name,last_name,company,email,phone)").eq("job_id", id),
    sb.from("job_settings").select("*").eq("job_id", id).maybeSingle(),
    sb.from("job_insurance").select("*").eq("job_id", id).maybeSingle(),
  ]);

  return {
    ...(job as Job),
    job_type: (jt.data as JobType) ?? null,
    job_group: (jg.data as JobGroup) ?? null,
    contacts: (contacts.data ?? []) as JobContact[],
    internal_users: (users.data ?? []) as JobInternalUser[],
    vendors: (vendors.data ?? []) as JobVendor[],
    settings: (settings.data as JobSettings) ?? null,
    insurance: (insurance.data as JobInsurance) ?? null,
  };
}

// ─── Create / update / archive ─────────────────────────────────
// Creating a job mints its YY_###_Name job number (via the DB trigger), unless a
// job_number is passed explicitly (staff override). Default job_settings and
// job_insurance rows are created so the Info tabs always have a record to edit.
export async function createJob(draft: JobDraft, actor?: Actor): Promise<Job> {
  const sb = getSupabaseAdmin();
  const clean = sanitize(draft);
  clean.job_name = await ensureUniqueJobName(draft.job_name);
  clean.full_address = fullAddress(clean);

  // Best-effort geocode when we have an address but no coordinates.
  if (clean.full_address && (clean.latitude == null || clean.longitude == null)) {
    const geo = await geocodeAddress(clean);
    if (geo) { clean.latitude = geo.latitude; clean.longitude = geo.longitude; }
  }
  if (actor?.name && !clean.created_by) clean.created_by = actor.name;

  const { data, error } = await sb.from("jobs").insert(clean).select().single();
  if (error) throw new JobError(error.message);
  const job = data as Job;

  await Promise.all([
    sb.from("job_settings").upsert({ job_id: job.id }, { onConflict: "job_id" }),
    sb.from("job_insurance").upsert({ job_id: job.id }, { onConflict: "job_id" }),
  ]);
  await logJobActivity(job.id, "created", `Job created (${job.job_number ?? "template"})`, actor);
  return job;
}

export async function updateJob(id: string, patch: Partial<JobDraft>, actor?: Actor): Promise<Job> {
  const sb = getSupabaseAdmin();
  const before = await sb.from("jobs").select("status,job_number,street_address,city,state,zip_code,latitude,longitude").eq("id", id).maybeSingle();
  const clean = sanitize(patch);

  const addressTouched = ["street_address", "city", "state", "zip_code"].some((k) => k in clean);
  if (addressTouched) {
    clean.full_address = fullAddress({ ...(before.data ?? {}), ...clean });
    // Re-geocode when the address changed and no explicit coordinates were sent.
    if (!("latitude" in clean) && !("longitude" in clean)) {
      const geo = await geocodeAddress({ ...(before.data ?? {}), ...clean });
      clean.latitude = geo?.latitude ?? null;
      clean.longitude = geo?.longitude ?? null;
    }
  }

  const { data, error } = await sb.from("jobs").update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new JobError(error.message);
  const job = data as Job;

  if (before.data && clean.status && before.data.status !== clean.status) {
    await logJobActivity(id, "status_changed", `${before.data.status} → ${clean.status}`, actor);
  }
  return job;
}

export async function archiveJob(id: string, actor?: Actor): Promise<void> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("jobs").update({ archived_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new JobError(error.message);
  await logJobActivity(id, "archived", "Job archived", actor);
}

// ─── Sub-entities: clients / internal users / vendors ──────────
export async function addJobContact(jobId: string, input: Partial<JobContact>): Promise<JobContact> {
  const { data, error } = await getSupabaseAdmin().from("job_contacts")
    .insert({ job_id: jobId, contact_id: input.contact_id, role: input.role ?? "client", is_primary: input.is_primary ?? false, portal_access_enabled: input.portal_access_enabled ?? false, permissions: input.permissions ?? {} })
    .select("*, contact:contacts(id,first_name,last_name,email,phone,company)").single();
  if (error) throw new JobError(error.message);
  return data as JobContact;
}
export async function updateJobContact(id: string, patch: Partial<JobContact>): Promise<JobContact> {
  const { data, error } = await getSupabaseAdmin().from("job_contacts").update(patch).eq("id", id)
    .select("*, contact:contacts(id,first_name,last_name,email,phone,company)").single();
  if (error) throw new JobError(error.message);
  return data as JobContact;
}
export async function removeJobContact(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_contacts").delete().eq("id", id);
  if (error) throw new JobError(error.message);
}

export async function addJobInternalUser(jobId: string, input: Partial<JobInternalUser>): Promise<JobInternalUser> {
  const { data, error } = await getSupabaseAdmin().from("job_internal_users")
    .insert({ job_id: jobId, staff_user_id: input.staff_user_id, role: input.role ?? null, access_statuses: input.access_statuses ?? ["open"], notifications_enabled: input.notifications_enabled ?? true })
    .select("*, user:staff_users(id,display_name,email,role_slug)").single();
  if (error) throw new JobError(error.message);
  return data as JobInternalUser;
}
export async function updateJobInternalUser(id: string, patch: Partial<JobInternalUser>): Promise<JobInternalUser> {
  const { data, error } = await getSupabaseAdmin().from("job_internal_users").update(patch).eq("id", id)
    .select("*, user:staff_users(id,display_name,email,role_slug)").single();
  if (error) throw new JobError(error.message);
  return data as JobInternalUser;
}
export async function removeJobInternalUser(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_internal_users").delete().eq("id", id);
  if (error) throw new JobError(error.message);
}

export async function addJobVendor(jobId: string, input: Partial<JobVendor>): Promise<JobVendor> {
  const { data, error } = await getSupabaseAdmin().from("job_vendors")
    .insert({ job_id: jobId, vendor_contact_id: input.vendor_contact_id, role: input.role ?? null, access_permissions: input.access_permissions ?? {}, notifications_enabled: input.notifications_enabled ?? true })
    .select("*, vendor:contacts(id,first_name,last_name,company,email,phone)").single();
  if (error) throw new JobError(error.message);
  return data as JobVendor;
}
export async function updateJobVendor(id: string, patch: Partial<JobVendor>): Promise<JobVendor> {
  const { data, error } = await getSupabaseAdmin().from("job_vendors").update(patch).eq("id", id)
    .select("*, vendor:contacts(id,first_name,last_name,company,email,phone)").single();
  if (error) throw new JobError(error.message);
  return data as JobVendor;
}
export async function removeJobVendor(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_vendors").delete().eq("id", id);
  if (error) throw new JobError(error.message);
}

export async function upsertJobSettings(jobId: string, patch: Partial<JobSettings>): Promise<JobSettings> {
  const { data, error } = await getSupabaseAdmin().from("job_settings")
    .upsert({ ...patch, job_id: jobId, updated_at: new Date().toISOString() }, { onConflict: "job_id" })
    .select().single();
  if (error) throw new JobError(error.message);
  return data as JobSettings;
}
export async function upsertJobInsurance(jobId: string, patch: Partial<JobInsurance>): Promise<JobInsurance> {
  const { data, error } = await getSupabaseAdmin().from("job_insurance")
    .upsert({ ...patch, job_id: jobId, updated_at: new Date().toISOString() }, { onConflict: "job_id" })
    .select().single();
  if (error) throw new JobError(error.message);
  return data as JobInsurance;
}

// ─── Lead/Opportunity → Job conversion ─────────────────────────
// Promote a pipeline Opportunity into a real Job. Copies name/address/PM/
// contract from the opportunity, links related_opportunity_id + related_lead_id,
// derives the initial job status from the opportunity's stage, and (if the
// opportunity has a contact) seeds the job's client list.
export async function convertOpportunityToJob(
  opportunityId: string,
  overrides: Partial<JobDraft>,
  actor?: Actor,
): Promise<Job> {
  const sb = getSupabaseAdmin();
  const { data: opp } = await sb.from("pipeline_opportunities").select("*").eq("id", opportunityId).maybeSingle();
  if (!opp) throw new JobError("Opportunity not found.", 404);

  // Reuse an already-linked job if one exists (idempotent promotion).
  const { data: existing } = await sb.from("jobs").select("*").eq("related_opportunity_id", opportunityId).is("archived_at", null).maybeSingle();
  if (existing) return existing as Job;

  const draft: JobDraft = {
    job_name: overrides.job_name || opp.opportunity_name || "New Job",
    related_opportunity_id: opportunityId,
    related_lead_id: opp.contact_id ?? null,
    status: opportunityStageToJobStatus(opp.stage),
    street_address: opp.project_address ?? null,
    city: opp.city ?? null,
    state: opp.state ?? null,
    zip_code: opp.zip_code ?? null,
    contract_price: opp.contract_value ?? opp.estimated_project_value ?? null,
    internal_notes: opp.notes ?? null,
    ...overrides,
  };
  const job = await createJob(draft, actor);

  // Seed the client list from the opportunity's linked contact.
  if (opp.contact_id) {
    await sb.from("job_contacts").insert({ job_id: job.id, contact_id: opp.contact_id, role: "client", is_primary: true }).select("id").maybeSingle();
  }
  await logJobActivity(job.id, "converted_from_opportunity", `Promoted from opportunity ${opp.job_number ?? opportunityId}`, actor);
  return job;
}

// ─── Create from template ──────────────────────────────────────
// Copies SAFE template data only (job details, settings, group/type, schedule
// shape). Never copies invoices, payments, actual costs, daily logs, messages,
// change orders, or warranty history (doc §Template Import Should Not Copy).
export async function createJobFromTemplate(
  templateId: string,
  input: { job_name: string; job_group_id?: string | null; job_type_id?: string | null; projected_start_date?: string | null; turn_schedule_online?: boolean; contract_type?: string | null; contact_id?: string | null; accounting_customer_id?: string | null; status?: JobStatus },
  actor?: Actor,
): Promise<Job> {
  const sb = getSupabaseAdmin();
  const { data: tpl } = await sb.from("jobs").select("*").eq("id", templateId).maybeSingle();
  if (!tpl) throw new JobError("Template not found.", 404);
  const { data: tplSettings } = await sb.from("job_settings").select("*").eq("job_id", templateId).maybeSingle();

  const draft: JobDraft = {
    job_name: input.job_name,
    is_template: false,
    source_template_id: templateId,
    status: input.status ?? "draft",
    job_type_id: input.job_type_id ?? tpl.job_type_id ?? null,
    job_group_id: input.job_group_id ?? tpl.job_group_id ?? null,
    contract_type: (input.contract_type as JobDraft["contract_type"]) ?? tpl.contract_type ?? null,
    projected_start_date: input.projected_start_date ?? null,
    schedule_color: tpl.schedule_color ?? null,
    work_days: tpl.work_days ?? null,
    internal_notes: tpl.internal_notes ?? null,
    vendor_notes: tpl.vendor_notes ?? null,
    accounting_customer_id: input.accounting_customer_id ?? null,
  };
  const job = await createJob(draft, actor);

  // Copy safe advanced settings from the template.
  if (tplSettings) {
    const { id: _id, job_id: _j, updated_at: _u, ...safe } = tplSettings as JobSettings & Record<string, unknown>;
    void _id; void _j; void _u;
    await upsertJobSettings(job.id, { ...safe, schedule_online: !!input.turn_schedule_online });
  } else {
    await upsertJobSettings(job.id, { schedule_online: !!input.turn_schedule_online });
  }
  if (input.contact_id) {
    await sb.from("job_contacts").insert({ job_id: job.id, contact_id: input.contact_id, role: "client", is_primary: true }).select("id").maybeSingle();
  }
  await logJobActivity(job.id, "created_from_template", `Created from template ${tpl.job_name}`, actor);
  return job;
}

// ─── Price summary ─────────────────────────────────────────────
// Assembles the printable price summary. Change orders and invoices are
// placeholders (empty) until those modules/tables exist — the contract price
// still drives the grand total. See docs/features/cmi-jobs-implementation.md.
export async function buildPriceSummary(jobId: string): Promise<PriceSummary> {
  const job = await getJobBasic(jobId);
  if (!job) throw new JobError("Job not found.", 404);
  const contract_price = job.contract_price ?? 0;
  const change_orders: PriceSummary["change_orders"] = []; // TODO: change_orders table
  const invoices: PriceSummary["invoices"] = [];           // TODO: invoices table
  const approved_change_orders_total = change_orders.reduce((s, c) => s + c.price, 0);
  const invoice_total = invoices.reduce((s, i) => s + i.amount, 0);
  const invoice_paid_total = invoices.reduce((s, i) => s + i.paid, 0);
  const invoice_balance_total = invoices.reduce((s, i) => s + i.balance, 0);
  const grand_total = contract_price + approved_change_orders_total;
  return { job, contract_price, change_orders, invoices, approved_change_orders_total, invoice_total, invoice_paid_total, invoice_balance_total, grand_total };
}

async function getJobBasic(id: string): Promise<Job | null> {
  const { data, error } = await getSupabaseAdmin().from("jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Job) ?? null;
}
