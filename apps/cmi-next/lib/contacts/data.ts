import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Contact, ContactDraft } from "./types";
import { blockingDuplicate, fullName, type DuplicateMatch } from "./duplicates";

/**
 * Thrown instead of letting a raw unique-violation reach the screen. Carries
 * the contact that's already on file so the UI can offer to open it.
 */
export class DuplicateContactError extends Error {
  status = 409;
  existing: DuplicateMatch;
  constructor(existing: DuplicateMatch, message: string) {
    super(message);
    this.existing = existing;
  }
}

export async function loadContacts(): Promise<Contact[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("last_activity", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

/**
 * Create a contact, refusing one that already exists.
 *
 * `confirmed: true` means a person looked at the suggested match and said it's
 * a different human — that lets a "likely" match through, but never a taken
 * email address, which the database rejects regardless.
 */
export async function createContact(
  draft: ContactDraft,
  opts: { confirmed?: boolean } = {},
): Promise<Contact> {
  const supabase = getSupabaseAdmin();
  // Addresses are matched case-insensitively, so store them that way too.
  const email = draft.email ? draft.email.trim().toLowerCase() : draft.email;

  const clash = await blockingDuplicate({
    first: draft.first_name,
    last: draft.last_name,
    email,
    phone: draft.phone,
    company: draft.company,
  }, opts);

  if (clash) {
    throw new DuplicateContactError(
      clash,
      clash.reason === "same email"
        ? `${clash.email} already belongs to ${fullName(clash)}.`
        : `${fullName(clash)} looks like the same person (${clash.reason}). Open them instead, or confirm this is someone different.`,
    );
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...draft, email, last_activity: new Date().toISOString() })
    .select()
    .single();
  if (error) {
    // Belt and braces: a race between the check above and the insert.
    if (error.code === "23505") {
      throw new Error(`That email address is already on another contact.`);
    }
    throw new Error(error.message);
  }
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
