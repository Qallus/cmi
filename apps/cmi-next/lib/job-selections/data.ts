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
export async function selectionOnJob(selId: string, jobId: string): Promise<boolean> {
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
export type ClientSelectionAction = "approved" | "rejected" | "revision_requested" | "comment";

/** The client's notes, newest first, each stamped with the date and who wrote it. */
export function appendClientComment(existing: string | null | undefined, text: string, who: string, at: Date): string {
  const day = at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Phoenix" });
  return [`${day} · ${who}: ${text}`, existing?.trim()].filter(Boolean).join("\n");
}

const ACTION_WORD: Record<ClientSelectionAction, string> = {
  approved: "approved", rejected: "did not approve", revision_requested: "asked for a change to", comment: "commented on",
};

// A client approves, doesn't approve, asks for a change to, or comments on a
// selection from their portal. Comments add to the history instead of
// replacing it; the job's team hears about it (bell + push) and it's logged.
export async function clientDecideSelection(
  selId: string, jobId: string, action: ClientSelectionAction, comment: string | null, who: { id: string; name: string },
): Promise<ProjectSelection> {
  if (!(await selectionOnJob(selId, jobId))) throw new Error("Selection not found on this project.");
  const sb = getSupabaseAdmin();
  const { data: current, error: readErr } = await sb.from("project_selections")
    .select("name, client_comments").eq("id", selId).eq("client_visible", true).maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!current) throw new Error("Selection not found on this project.");

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const note = comment?.trim() || null;
  // The thread row first: it imports the old text before the new note is added to it.
  const { addClientComment } = await import("@/lib/selection-comments/data");
  await addClientComment(selId, jobId, who, action, note);
  const patch: Record<string, unknown> = { updated_at: now };
  if (note) patch.client_comments = appendClientComment(current.client_comments, note, who.name, nowDate);
  if (action === "approved") Object.assign(patch, { approval_status: "approved", client_approval_status: "approved", client_approved_at: now, selection_status: "client_approved" });
  if (action === "rejected" || action === "revision_requested") {
    Object.assign(patch, { approval_status: action, client_approval_status: action, client_rejected_at: now, selection_status: "rejected_needs_revision" });
  }
  const { data, error } = await sb.from("project_selections").update(patch).eq("id", selId).eq("client_visible", true).select().single();
  if (error) throw new Error(error.message);

  const title = `${who.name} ${ACTION_WORD[action]} ${current.name ?? "a selection"}`;
  await sb.from("selection_activity").insert({ selection_id: selId, action: `client.${action}`, description: note ? `${title}: ${note}` : title, metadata: { contact_id: who.id, job_id: jobId } })
    .then(() => undefined, () => undefined);
  // The team, the PM (even if muted) or else admins: bell, push and email.
  const { notifyClientActivity } = await import("@/lib/notifications/client-activity");
  await notifyClientActivity({
    jobId, kind: "selection_client_response", title, note,
    url: `/dashboard/jobs/${jobId}/selections?sel=${selId}&comments=1`, sourceTable: "project_selections", sourceId: selId,
    label: action === "comment" ? "Selection comment" : "Selection decision",
    facts: [{ label: "Selection", value: current.name ?? "Selection" }],
    ctaLabel: "Open the selection",
  });
  return data as ProjectSelection;
}
