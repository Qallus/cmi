// Bolt's job-awareness backbone. getJobOverview() resolves a job by id, job
// number, or name, then fans out one query per child area so Bolt can answer
// "what's the status of this job / what's outstanding / who's on it" in a single
// tool call instead of a dozen list_records round trips. Read-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ToolResult } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function resolveJob(sb: ReturnType<typeof getSupabaseAdmin>, identifier: string): Promise<Row | null> {
  const id = identifier.trim();
  if (UUID_RE.test(id)) {
    const { data } = await sb.from("jobs").select("*").eq("id", id).maybeSingle();
    if (data) return data as Row;
  }
  // Try exact job number, then fuzzy name/number search.
  const { data: byNum } = await sb.from("jobs").select("*").eq("job_number", id).maybeSingle();
  if (byNum) return byNum as Row;
  const { data: byName } = await sb
    .from("jobs").select("*")
    .or(`job_name.ilike.%${id}%,job_number.ilike.%${id}%,full_address.ilike.%${id}%`)
    .order("created_at", { ascending: false })
    .limit(1);
  return (byName?.[0] as Row) ?? null;
}

export async function getJobOverview(identifier: string): Promise<ToolResult> {
  if (!identifier || !identifier.trim()) return { error: "Provide a job id, job number, or name." };
  const sb = getSupabaseAdmin();
  const job = await resolveJob(sb, identifier);
  if (!job) return { error: `No job matched "${identifier}". Try list_records(job, search=…) to find it.` };

  const jobId: string = job.id;
  const clientIds = new Set<string>();

  // Fan out across every child area. Recent rows + a total count each.
  const num = (r: { count: number | null }) => r.count ?? 0;
  const [
    schedule, changeOrders, invoices, dailyLogs, files, updates, actionItems,
    selections, notes, contacts, vendors, internalUsers,
  ] = await Promise.all([
    sb.from("project_schedule_items").select("id,title,type,phase,status,progress,start_date,end_date,client_start_date,client_end_date,client_visible").eq("board_id", jobId).order("start_date", { ascending: true }).limit(50),
    sb.from("change_orders").select("id,co_number,title,status,amount,co_date").eq("job_id", jobId).order("created_at", { ascending: false }).limit(20),
    sb.from("invoices").select("id,invoice_number,title,status,amount,amount_paid,due_date").eq("job_id", jobId).order("created_at", { ascending: false }).limit(20),
    sb.from("daily_logs").select("id,log_date,title").eq("job_id", jobId).order("log_date", { ascending: false }).limit(10),
    sb.from("job_files").select("id", { count: "exact", head: true }).eq("job_id", jobId),
    sb.from("job_updates").select("id,title,visibility,client_action_required,created_at").eq("job_id", jobId).order("created_at", { ascending: false }).limit(10),
    sb.from("job_action_items").select("id,title,status,priority,due_date,assigned_contact_id").eq("job_id", jobId).order("created_at", { ascending: false }).limit(20),
    sb.from("project_selections").select("id,name,category,selection_status,approval_status,client_price").eq("job_id", jobId).order("created_at", { ascending: false }).limit(30),
    sb.from("job_notes").select("id,body,pinned,author_name,created_at").eq("job_id", jobId).order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(15),
    sb.from("job_contacts").select("contact_id,role,is_primary,contact:contacts(first_name,last_name,email,phone,company)").eq("job_id", jobId),
    sb.from("job_vendors").select("role,vendor:contacts(first_name,last_name,company,email,phone)").eq("job_id", jobId),
    sb.from("job_internal_users").select("role,user:staff_users(display_name,email,role_slug)").eq("job_id", jobId),
  ]);

  const scheduleRows = (schedule.data ?? []) as Row[];
  const projects = scheduleRows.filter((r) => r.type === "project");
  const tasks = scheduleRows.filter((r) => r.type !== "project");
  const invoiceRows = (invoices.data ?? []) as Row[];
  const openBalance = invoiceRows.reduce((sum, r) => sum + Math.max(0, (Number(r.amount) || 0) - (Number(r.amount_paid) || 0)), 0);
  const contactRows = (contacts.data ?? []) as Row[];
  for (const c of contactRows) if (c.contact_id) clientIds.add(c.contact_id);

  // Bookings + quotes attach to the job's client contacts (no direct job FK).
  const ids = [...clientIds];
  const [bookings, quotes] = await Promise.all([
    ids.length ? sb.from("booking_appointments").select("id", { count: "exact", head: true }).in("contact_id", ids) : Promise.resolve({ count: 0 }),
    ids.length ? sb.from("quotes").select("id", { count: "exact", head: true }).in("contact_id", ids) : Promise.resolve({ count: 0 }),
  ]);

  return {
    job: {
      id: job.id, job_number: job.job_number, job_name: job.job_name, status: job.status,
      contract_type: job.contract_type, contract_price: job.contract_price,
      current_phase: job.current_phase ?? null, progress_percentage: job.progress_percentage ?? null,
      next_milestone: job.next_milestone ?? null,
      projected_start_date: job.projected_start_date, projected_completion_date: job.projected_completion_date,
      actual_start_date: job.actual_start_date, actual_completion_date: job.actual_completion_date,
      full_address: job.full_address ?? null, project_manager: job.project_manager ?? null,
      internal_notes: job.internal_notes ?? null,
    },
    hierarchy_note: "This job's Project Manager board is board_id = job.id. Schedule items with type='project' are the job's Projects; the rest are tasks/milestones under them (Job → Project → Task). Schedule items carry internal dates (start_date/end_date) plus optional client-facing dates (client_start_date/client_end_date) — clients only see the client dates.",
    counts: {
      projects: projects.length, tasks: tasks.length,
      change_orders: (changeOrders.data ?? []).length, invoices: invoiceRows.length,
      open_invoice_balance: Math.round(openBalance * 100) / 100,
      daily_logs: (dailyLogs.data ?? []).length, files: num(files as { count: number | null }),
      updates: (updates.data ?? []).length, action_items: (actionItems.data ?? []).length,
      open_action_items: ((actionItems.data ?? []) as Row[]).filter((r) => r.status === "open" || r.status === "in_progress").length,
      selections: (selections.data ?? []).length, notes: (notes.data ?? []).length,
      contacts: contactRows.length, vendors: (vendors.data ?? []).length,
      internal_users: (internalUsers.data ?? []).length,
      bookings: num(bookings as { count: number | null }), quotes: num(quotes as { count: number | null }),
    },
    projects, tasks,
    change_orders: changeOrders.data ?? [],
    invoices: invoiceRows,
    daily_logs: dailyLogs.data ?? [],
    updates: updates.data ?? [],
    action_items: actionItems.data ?? [],
    selections: selections.data ?? [],
    notes: notes.data ?? [],
    contacts: contactRows,
    vendors: vendors.data ?? [],
    internal_users: internalUsers.data ?? [],
  };
}
