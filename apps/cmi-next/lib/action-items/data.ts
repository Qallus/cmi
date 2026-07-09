import { getSupabaseAdmin } from "@/lib/supabase/server";
import { notifyClient } from "@/lib/client-portal/notifications";
import type { ActionItem, ActionItemDraft } from "./types";

export async function loadJobActionItems(jobId: string): Promise<ActionItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("job_action_items").select("*, assigned_contact:contacts(first_name,last_name)").eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ActionItem[];
}

// A client's open action items for a job.
export async function loadClientActionItems(contactId: string, jobId: string): Promise<ActionItem[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("job_action_items").select("*").eq("job_id", jobId).eq("assigned_contact_id", contactId).order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ActionItem[];
}

export async function createActionItem(jobId: string, draft: ActionItemDraft, actor?: string | null): Promise<ActionItem> {
  const { data, error } = await getSupabaseAdmin()
    .from("job_action_items").insert({ ...draft, job_id: jobId, created_by: actor ?? null })
    .select("*, assigned_contact:contacts(first_name,last_name)").single();
  if (error) throw new Error(error.message);
  // Notify the assigned client that they have a new action item.
  if (data.assigned_contact_id) {
    notifyClient(data.assigned_contact_id, jobId, { type: "action_item", title: "Action needed", body: draft.title, link: `/client/jobs/${jobId}/action-items` }).catch(() => {});
  }
  return data as ActionItem;
}

export async function updateActionItem(id: string, patch: Partial<ActionItemDraft>): Promise<ActionItem> {
  const clean = { ...patch } as Record<string, unknown>;
  delete clean.job_id;
  if (patch.status === "completed" && !patch.completed_at) clean.completed_at = new Date().toISOString();
  const { data, error } = await getSupabaseAdmin()
    .from("job_action_items").update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id)
    .select("*, assigned_contact:contacts(first_name,last_name)").single();
  if (error) throw new Error(error.message);
  return data as ActionItem;
}

// Client marks their own item complete (scoped to their contact id).
export async function completeActionItemForClient(id: string, contactId: string): Promise<ActionItem> {
  const { data, error } = await getSupabaseAdmin()
    .from("job_action_items").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).eq("assigned_contact_id", contactId).select().single();
  if (error) throw new Error(error.message);
  return data as ActionItem;
}

export async function deleteActionItem(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("job_action_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
