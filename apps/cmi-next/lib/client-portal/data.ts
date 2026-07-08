// Client-portal data layer. EVERY loader is scoped to a job the client is
// associated with and returns only client-safe rows (client_visible +
// permission-gated). Callers must have already run assertJobAccess.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getJobPerms } from "./auth";
import type { ClientContact } from "./auth";

export type ClientJobCard = {
  id: string;
  job_number: string | null;
  job_name: string;
  job_type_name: string | null;
  status: string;
  full_address: string | null;
  project_managers: string[];
  current_phase: string | null;
  progress_percentage: number | null;
  last_client_update_at: string | null;
  cover_image_url: string | null;
};

export type ClientJobDetail = ClientJobCard & {
  street_address: string | null; city: string | null; state: string | null; zip_code: string | null;
  projected_start_date: string | null; actual_start_date: string | null;
  projected_completion_date: string | null; actual_completion_date: string | null;
  next_milestone: string | null; client_description: string | null;
  contract_type: string | null; square_feet: number | null; permit_number: string | null;
  funded_by_construction_loan: boolean | null;
  client_names: string[];
  project_manager_contacts: { name: string; email: string; phone: string | null }[];
  permissions: Record<string, boolean>;
};

async function projectManagersFor(jobIds: string[]): Promise<Map<string, { name: string; email: string; phone: string | null }[]>> {
  const map = new Map<string, { name: string; email: string; phone: string | null }[]>();
  if (jobIds.length === 0) return map;
  const { data } = await getSupabaseAdmin()
    .from("job_internal_users")
    .select("job_id, user:staff_users(display_name, email, phone)")
    .in("job_id", jobIds);
  for (const row of (data ?? []) as { job_id: string; user: { display_name?: string | null; email?: string; phone?: string | null } | null }[]) {
    if (!row.user?.display_name) continue;
    const list = map.get(row.job_id) ?? [];
    list.push({ name: row.user.display_name, email: row.user.email ?? "", phone: row.user.phone ?? null });
    map.set(row.job_id, list);
  }
  return map;
}

// The jobs this client may see in the portal.
export async function loadClientJobs(contactId: string): Promise<ClientJobCard[]> {
  const sb = getSupabaseAdmin();
  const { data: jcs } = await sb.from("job_contacts").select("job_id").eq("contact_id", contactId).eq("portal_access_enabled", true);
  const jobIds = (jcs ?? []).map((j) => j.job_id);
  if (jobIds.length === 0) return [];

  const { data: jobs } = await sb.from("jobs")
    .select("*, job_type:job_types(name)")
    .in("id", jobIds).eq("client_portal_enabled", true).is("archived_at", null)
    .order("last_client_update_at", { ascending: false, nullsFirst: false });
  const pmMap = await projectManagersFor(jobIds);

  return (jobs ?? []).map((j) => ({
    id: j.id, job_number: j.job_number, job_name: j.job_name,
    job_type_name: (j.job_type as { name?: string } | null)?.name ?? null,
    status: j.status, full_address: j.full_address,
    project_managers: (pmMap.get(j.id) ?? []).map((p) => p.name),
    current_phase: j.current_phase, progress_percentage: j.progress_percentage,
    last_client_update_at: j.last_client_update_at, cover_image_url: j.cover_image_url,
  }));
}

export async function getClientJob(contactId: string, jobId: string): Promise<ClientJobDetail | null> {
  const sb = getSupabaseAdmin();
  const { data: j } = await sb.from("jobs").select("*, job_type:job_types(name)").eq("id", jobId).eq("client_portal_enabled", true).maybeSingle();
  if (!j) return null;

  const [pmMap, { data: contacts }, permissions] = await Promise.all([
    projectManagersFor([jobId]),
    sb.from("job_contacts").select("contact:contacts(first_name,last_name)").eq("job_id", jobId),
    getJobPerms(contactId, jobId),
  ]);
  const pms = pmMap.get(jobId) ?? [];
  const client_names = ((contacts ?? []) as { contact: { first_name?: string; last_name?: string } | null }[])
    .map((c) => `${c.contact?.first_name ?? ""} ${c.contact?.last_name ?? ""}`.trim()).filter(Boolean);

  return {
    id: j.id, job_number: j.job_number, job_name: j.job_name,
    job_type_name: (j.job_type as { name?: string } | null)?.name ?? null,
    status: j.status, full_address: j.full_address,
    project_managers: pms.map((p) => p.name), current_phase: j.current_phase, progress_percentage: j.progress_percentage,
    last_client_update_at: j.last_client_update_at, cover_image_url: j.cover_image_url,
    street_address: j.street_address, city: j.city, state: j.state, zip_code: j.zip_code,
    projected_start_date: j.projected_start_date, actual_start_date: j.actual_start_date,
    projected_completion_date: j.projected_completion_date, actual_completion_date: j.actual_completion_date,
    next_milestone: j.next_milestone, client_description: j.client_description,
    contract_type: j.contract_type, square_feet: j.square_feet, permit_number: j.permit_number,
    funded_by_construction_loan: j.funded_by_construction_loan,
    client_names, project_manager_contacts: pms, permissions,
  };
}

// ── Client-visible collections (all scoped + visibility filtered) ──
export async function loadClientUpdates(jobId: string) {
  const { data } = await getSupabaseAdmin().from("job_updates")
    .select("*").eq("job_id", jobId).eq("visibility", "client_visible").order("created_at", { ascending: false });
  return data ?? [];
}

const IMAGE_RE = /^image\//;
export async function loadClientFiles(jobId: string) {
  const { data } = await getSupabaseAdmin().from("job_files")
    .select("*").eq("job_id", jobId).eq("client_visible", true).order("created_at", { ascending: false });
  const files = data ?? [];
  return {
    photos: files.filter((f) => IMAGE_RE.test(f.mime_type ?? "")),
    documents: files.filter((f) => !IMAGE_RE.test(f.mime_type ?? "")),
  };
}

export async function loadClientChangeOrders(jobId: string) {
  const { data } = await getSupabaseAdmin().from("change_orders")
    .select("*").eq("job_id", jobId).eq("client_visible", true).order("created_at", { ascending: false });
  return data ?? [];
}

// Financials are gated by the client's permissions (price_summary / invoices).
export async function loadClientFinancials(jobId: string, perms: Record<string, boolean>) {
  const sb = getSupabaseAdmin();
  const { data: job } = await sb.from("jobs").select("contract_price").eq("id", jobId).maybeSingle();
  const invoices = perms.invoices
    ? (await sb.from("invoices").select("invoice_number,title,status,issue_date,due_date,amount,amount_paid").eq("job_id", jobId).eq("client_visible", true).order("issue_date")).data ?? []
    : [];
  const approvedCOs = (await sb.from("change_orders").select("amount").eq("job_id", jobId).eq("status", "approved").eq("client_visible", true)).data ?? [];
  return {
    show_price_summary: !!perms.price_summary,
    show_invoices: !!perms.invoices,
    contract_price: job?.contract_price ?? 0,
    approved_change_orders_total: approvedCOs.reduce((s, c) => s + Number(c.amount ?? 0), 0),
    invoices,
  };
}

export async function loadClientMessages(jobId: string) {
  const { data } = await getSupabaseAdmin().from("job_messages")
    .select("*").eq("job_id", jobId).eq("visibility", "client_visible").order("created_at", { ascending: true });
  return data ?? [];
}

export async function postClientMessage(jobId: string, contact: ClientContact, body: string, category = "general") {
  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.company || contact.email;
  const { data, error } = await getSupabaseAdmin().from("job_messages")
    .insert({ job_id: jobId, sender_type: "client", sender_id: contact.id, sender_name: name, body, category, visibility: "client_visible" })
    .select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function loadClientWarranty(jobId: string, contactId: string) {
  const { data } = await getSupabaseAdmin().from("warranty_requests")
    .select("*").eq("job_id", jobId).eq("contact_id", contactId).order("submitted_at", { ascending: false });
  return data ?? [];
}

export async function createClientWarranty(jobId: string, contact: ClientContact, input: { request_title: string; request_description?: string; category?: string; location_in_home?: string; priority?: string; photos?: string[] }) {
  const sb = getSupabaseAdmin();
  const { data: job } = await sb.from("jobs").select("job_number").eq("id", jobId).maybeSingle();
  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.company || contact.email;
  const { data, error } = await sb.from("warranty_requests").insert({
    job_id: jobId, job_number: job?.job_number ?? null, contact_id: contact.id,
    submitted_by: name, submitter_email: contact.email, submitter_phone: contact.phone ?? null,
    request_title: input.request_title, request_description: input.request_description ?? null,
    category: input.category ?? null, location_in_home: input.location_in_home ?? null,
    priority: input.priority ?? "normal", photos: input.photos ?? null, status: "submitted",
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}
