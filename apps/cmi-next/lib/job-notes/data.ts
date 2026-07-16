import { getSupabaseAdmin } from "@/lib/supabase/server";

// Unified job notes stream (Jobs Phase 2). Service-role; API authorizes staff.
export type JobNote = {
  id: string;
  job_id: string;
  author_staff_id: string | null;
  author_name: string | null;
  body: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

export async function loadJobNotes(jobId: string): Promise<JobNote[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("job_notes")
    .select("*")
    .eq("job_id", jobId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as JobNote[];
}

export async function createJobNote(jobId: string, body: string, actor: { id: string; email?: string | null }): Promise<JobNote> {
  const sb = getSupabaseAdmin();
  const text = body.trim();
  if (!text) throw new Error("Note can't be empty.");
  const { data: staff } = await sb.from("staff_users").select("display_name, email").eq("id", actor.id).maybeSingle();
  const authorName = staff?.display_name || staff?.email || actor.email || "Staff";
  const { data, error } = await sb
    .from("job_notes")
    .insert({ job_id: jobId, author_staff_id: actor.id, author_name: authorName, body: text })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as JobNote;
}

export async function updateJobNote(id: string, patch: { pinned?: boolean; body?: string }): Promise<JobNote> {
  const sb = getSupabaseAdmin();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.pinned !== undefined) updates.pinned = patch.pinned;
  if (patch.body !== undefined) updates.body = String(patch.body).trim();
  const { data, error } = await sb.from("job_notes").update(updates).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data as JobNote;
}

export async function deleteJobNote(id: string): Promise<{ ok: true }> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("job_notes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
