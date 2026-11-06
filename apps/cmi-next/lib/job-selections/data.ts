// Job-scoped selections — reuse the rich `project_selections` table (which
// already carries the client approval model) via the new job_id column.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyJobClients } from "@/lib/client-portal/notifications";
import type { ProjectSelection } from "@/lib/selections/types";

export type JobSelectionDraft = Partial<Omit<ProjectSelection, "id" | "created_at" | "updated_at">> & { name: string };

// Selections attached directly (job_id) OR via a reusable association row.
async function loadSelectionsForJob(jobId: string, opts: { clientVisibleOnly?: boolean } = {}): Promise<ProjectSelection[]> {
  const sb = getSupabaseAdmin();
  let direct = sb.from("project_selections").select("*").eq("job_id", jobId);
  if (opts.clientVisibleOnly) direct = direct.eq("client_visible", true);
  const [directRes, assocRes] = await Promise.all([
    direct,
    sb.from("selection_associations").select("selection_id").eq("job_id", jobId),
  ]);
  if (directRes.error) throw new Error(directRes.error.message);

  const rows = [...(directRes.data ?? [])];
  const haveIds = new Set(rows.map((r) => r.id));
  const assocIds = (assocRes.data ?? []).map((a) => a.selection_id).filter((id) => !haveIds.has(id));
  if (assocIds.length) {
    let assocQ = sb.from("project_selections").select("*").in("id", assocIds);
    if (opts.clientVisibleOnly) assocQ = assocQ.eq("client_visible", true);
    const { data: assoc } = await assocQ;
    for (const r of assoc ?? []) rows.push(r);
  }
  return rows as ProjectSelection[];
}

export async function loadJobSelections(jobId: string): Promise<ProjectSelection[]> {
  const rows = await loadSelectionsForJob(jobId);
  rows.sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")));
  return rows;
}

// Is this selection on the job, directly or through an association row?
async function selectionOnJob(selId: string, jobId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const [direct, assoc] = await Promise.all([
    sb.from("project_selections").select("id").eq("id", selId).eq("job_id", jobId).maybeSingle(),
    sb.from("selection_associations").select("selection_id").eq("selection_id", selId).eq("job_id", jobId).maybeSingle(),
  ]);
  return Boolean(direct.data || assoc.data);
}

// All selections available to attach to a job (for the "Add Existing" picker).
export async function listAttachableSelections(): Promise<ProjectSelection[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("project_selections").select("*").order("updated_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectSelection[];
}

// Attach existing selections to a job via association rows (reusable, no move).
export async function attachSelectionsToJob(jobId: string, selectionIds: string[], userId: string | null): Promise<ProjectSelection[]> {
  const sb = getSupabaseAdmin();
  for (const selection_id of selectionIds) {
    const { error } = await sb.from("selection_associations").insert({ selection_id, job_id: jobId, created_by: userId });
    if (error && error.code !== "23505") throw new Error(error.message);
  }
  const { data } = await sb.from("project_selections").select("*").in("id", selectionIds);
  return (data ?? []) as ProjectSelection[];
}

// Client-facing: only client-visible selections for the job.
export async function loadClientJobSelections(jobId: string): Promise<ProjectSelection[]> {
  const rows = await loadSelectionsForJob(jobId, { clientVisibleOnly: true });
  rows.sort((a, b) => String(a.category ?? "").localeCompare(String(b.category ?? "")));
  return rows;
}

// Notify clients when a selection is put into "pending" client approval.
async function maybeNotifyApproval(jobId: string, row: { approval_status?: string | null; client_visible?: boolean | null; name?: string | null }) {
  if (row.approval_status === "pending" && row.client_visible) {
    notifyJobClients(jobId, { type: "selection_approval", title: "A selection needs your approval", body: row.name ?? undefined, link: `/client/jobs/${jobId}/selections` }).catch(() => {});
  }
}

export async function createJobSelection(jobId: string, draft: JobSelectionDraft): Promise<ProjectSelection> {
  const { data, error } = await getSupabaseAdmin()
    .from("project_selections").insert({ ...draft, job_id: jobId }).select().single();
  if (error) throw new Error(error.message);
  await maybeNotifyApproval(jobId, data);
  return data as ProjectSelection;
}

export async function updateJobSelection(id: string, patch: Partial<JobSelectionDraft>): Promise<ProjectSelection> {
  const clean = { ...patch } as Record<string, unknown>;
  delete clean.job_id;
  const { data, error } = await getSupabaseAdmin()
    .from("project_selections").update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  if (data.job_id) await maybeNotifyApproval(data.job_id, data);
  return data as ProjectSelection;
}

export async function deleteJobSelection(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("project_selections").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Client decision on a selection: approve or request changes (with a comment).
export async function clientDecideSelection(
  selId: string, jobId: string, decision: "approved" | "revision_requested", comment: string | null,
): Promise<ProjectSelection> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    approval_status: decision,
    client_comments: comment ?? null,
    updated_at: now,
    ...(decision === "approved"
      ? { client_approved_at: now, selection_status: "client_approved" }
      : { client_rejected_at: now, selection_status: "rejected_needs_revision" }),
  };
  if (!(await selectionOnJob(selId, jobId))) throw new Error("Selection not found on this project.");
  const { data, error } = await getSupabaseAdmin()
    .from("project_selections").update(patch).eq("id", selId).eq("client_visible", true).select().single();
  if (error) throw new Error(error.message);
  return data as ProjectSelection;
}
