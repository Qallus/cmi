import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Contact, ContactDraft } from "./types";

export async function loadContacts(): Promise<Contact[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("last_activity", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

export async function createContact(draft: ContactDraft): Promise<Contact> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...draft, last_activity: new Date().toISOString() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function updateContact(id: string, patch: Partial<ContactDraft>): Promise<Contact> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Contact;
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
