import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Quote, QuoteDraft } from "./types";

export async function loadQuotes(): Promise<Quote[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Quote[];
}

export async function createQuote(draft: QuoteDraft): Promise<Quote> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("quotes").insert(draft).select().single();
  if (error) throw new Error(error.message);
  return data as Quote;
}

export async function updateQuote(id: string, patch: Partial<QuoteDraft>): Promise<Quote> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("quotes")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Quote;
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
