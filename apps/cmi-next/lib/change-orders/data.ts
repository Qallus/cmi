import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nextJobNumber } from "@/lib/jobs/numbering";
import type { ChangeOrder, ChangeOrderDraft } from "./types";

export async function loadChangeOrders(jobId: string): Promise<ChangeOrder[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("change_orders").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as ChangeOrder[];
}

export async function getChangeOrder(id: string): Promise<ChangeOrder | null> {
  const { data, error } = await getSupabaseAdmin().from("change_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ChangeOrder) ?? null;
}

export async function createChangeOrder(jobId: string, draft: ChangeOrderDraft, actor?: string | null): Promise<ChangeOrder> {
  const co_number = await nextJobNumber("change_orders", "co_number", jobId, "CO");
  const { data, error } = await getSupabaseAdmin().from("change_orders")
    .insert({ ...draft, job_id: jobId, co_number, created_by: actor ?? null })
    .select().single();
  if (error) throw new Error(error.message);
  return data as ChangeOrder;
}

export async function updateChangeOrder(id: string, patch: Partial<ChangeOrderDraft>): Promise<ChangeOrder> {
  const clean = { ...patch } as Record<string, unknown>;
  delete clean.co_number; delete clean.job_id;
  // Stamp the approval date when a CO transitions into "approved".
  if (patch.status === "approved" && !patch.approved_date) clean.approved_date = new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabaseAdmin().from("change_orders")
    .update({ ...clean, updated_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as ChangeOrder;
}

export async function deleteChangeOrder(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("change_orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
