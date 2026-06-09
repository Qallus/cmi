import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ContactSubmission, ContactSubmissionStatus } from "./types";

export async function loadContactSubmissions(limit = 200): Promise<ContactSubmission[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contact_submissions")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as ContactSubmission[];
}

export async function createContactSubmission(
  draft: Omit<ContactSubmission, "id" | "created_at" | "submitted_at">
): Promise<ContactSubmission> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contact_submissions")
    .insert(draft)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ContactSubmission;
}

export async function updateContactSubmissionStatus(
  id: string,
  status: ContactSubmissionStatus
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("contact_submissions")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
