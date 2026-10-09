// The people on a deal: homeowner, designer, architect, referring contractor…
//
// Each one is a real Contact, linked through deal_contacts with their role and
// one primary. deals.contact_id always mirrors the primary, because calls,
// texts, booking and the Closed Won → Pre-Con handoff all read it.
//
// Details are often partial at first: a designer bringing CMI a deal may hold
// back their client's phone and email until contracts are signed. Every field
// is optional; a contact needs only something to call them by.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const DEAL_CONTACT_ROLES = [
  "Homeowner", "Designer", "Architect", "General Contractor", "Referral Partner", "Property Manager", "Realtor", "Other",
] as const;

export type DealContactRow = {
  id: string;            // the deal_contacts link
  contact_id: string;
  role: string | null;
  is_primary: boolean;
  sort_order: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
};

export type DealContactInput = {
  /** Link an existing Contact (from the Contacts page) instead of typing one in. */
  contact_id?: string;
  first_name?: string; last_name?: string; email?: string | null; phone?: string | null;
  company?: string | null; role?: string | null; is_primary?: boolean;
};

export class DealContactError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** The contacts.type a new person gets, from their role on the deal. */
function contactTypeFor(role: string | null | undefined): string {
  if (role === "Homeowner") return "Lead";
  if (role === "Designer" || role === "Architect") return "Designer";
  return "Other";
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function listDealContacts(dealId: string): Promise<DealContactRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("deal_contacts")
    .select("id, contact_id, role, is_primary, sort_order, contacts(first_name, last_name, email, phone, company)")
    .eq("deal_id", dealId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new DealContactError(error.message, 500);
  type Row = { id: string; contact_id: string; role: string | null; is_primary: boolean; sort_order: number;
    contacts: { first_name: string; last_name: string; email: string | null; phone: string | null; company: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, contact_id: r.contact_id, role: r.role, is_primary: r.is_primary, sort_order: r.sort_order,
    first_name: r.contacts?.first_name ?? "", last_name: r.contacts?.last_name ?? "",
    email: r.contacts?.email ?? null, phone: r.contacts?.phone ?? null, company: r.contacts?.company ?? null,
  }));
}

export type ContactDealRow = { link_id: string; deal_id: string; title: string; job_number: string | null; stage: string; role: string | null; is_primary: boolean };

/** The deals a Contact is on, for the Contacts page. */
export async function listDealsForContact(contactId: string): Promise<ContactDealRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("deal_contacts")
    .select("id, deal_id, role, is_primary, deals(title, job_number, stage, archived_at)")
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false });
  if (error) throw new DealContactError(error.message, 500);
  type Row = { id: string; deal_id: string; role: string | null; is_primary: boolean;
    deals: { title: string | null; job_number: string | null; stage: string; archived_at: string | null } | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.deals && !r.deals.archived_at)
    .map((r) => ({
      link_id: r.id, deal_id: r.deal_id, title: (r.deals?.title ?? "").trim() || "Untitled deal",
      job_number: r.deals?.job_number ?? null, stage: r.deals?.stage ?? "", role: r.role, is_primary: r.is_primary,
    }));
}

/** Point deals.contact_id at whoever is primary now (or nobody). */
async function syncPrimary(dealId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("deal_contacts").select("contact_id").eq("deal_id", dealId).eq("is_primary", true).maybeSingle();
  await supabase.from("deals").update({ contact_id: (data as { contact_id: string } | null)?.contact_id ?? null }).eq("id", dealId);
}

async function makePrimary(dealId: string, linkId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  // Clear first: the partial unique index allows only one primary per deal.
  await supabase.from("deal_contacts").update({ is_primary: false }).eq("deal_id", dealId).neq("id", linkId);
  await supabase.from("deal_contacts").update({ is_primary: true }).eq("id", linkId);
}

/**
 * Add a person to a deal. If the email already belongs to a Contact, that
 * Contact is linked rather than duplicated (and their details are filled in
 * where blank, never overwritten).
 */
export async function addDealContact(dealId: string, input: DealContactInput): Promise<DealContactRow[]> {
  const supabase = getSupabaseAdmin();
  const first = clean(input.first_name), last = clean(input.last_name);
  const email = clean(input.email).toLowerCase() || null;
  const phone = clean(input.phone) || null;
  const company = clean(input.company) || null;

  let contactId: string | null = null;
  if (input.contact_id) {
    const { data: existing } = await supabase.from("contacts").select("id").eq("id", input.contact_id).maybeSingle();
    if (!existing) throw new DealContactError("That contact no longer exists.", 404);
    contactId = input.contact_id;
  } else if (!first && !last && !email && !phone) {
    throw new DealContactError("Add at least a name, phone or email.");
  }
  if (!contactId && email) {
    const { data: existing } = await supabase.from("contacts").select("id, first_name, last_name, phone, company").ilike("email", email).maybeSingle();
    if (existing) {
      const e = existing as { id: string; first_name: string; last_name: string; phone: string | null; company: string | null };
      contactId = e.id;
      const fill: Record<string, string> = {};
      if (!e.first_name && first) fill.first_name = first;
      if (!e.last_name && last) fill.last_name = last;
      if (!e.phone && phone) fill.phone = phone;
      if (!e.company && company) fill.company = company;
      if (Object.keys(fill).length) await supabase.from("contacts").update(fill).eq("id", e.id);
    }
  }
  if (!contactId) {
    const { data, error } = await supabase.from("contacts").insert({
      first_name: first, last_name: last, email, phone, company,
      type: contactTypeFor(input.role), source: "Pipeline",
    }).select("id").single();
    if (error) throw new DealContactError(error.message, 500);
    contactId = (data as { id: string }).id;
  }

  const current = await listDealContacts(dealId);
  if (current.some((c) => c.contact_id === contactId)) throw new DealContactError("That person is already on this deal.");
  const primary = input.is_primary || current.length === 0;
  const { data: link, error } = await supabase.from("deal_contacts").insert({
    deal_id: dealId, contact_id: contactId, role: clean(input.role) || null, is_primary: false,
    sort_order: current.length,
  }).select("id").single();
  if (error) throw new DealContactError(error.message, 500);
  if (primary) { await makePrimary(dealId, (link as { id: string }).id); await syncPrimary(dealId); }
  return listDealContacts(dealId);
}

/** Edit a person's details (on their Contact) and their role on this deal. */
export async function updateDealContact(dealId: string, linkId: string, input: DealContactInput): Promise<DealContactRow[]> {
  const supabase = getSupabaseAdmin();
  const { data: link } = await supabase.from("deal_contacts").select("id, contact_id").eq("id", linkId).eq("deal_id", dealId).maybeSingle();
  if (!link) throw new DealContactError("That contact isn't on this deal.", 404);
  const contactId = (link as { contact_id: string }).contact_id;

  const contactPatch: Record<string, unknown> = {};
  if (input.first_name !== undefined) contactPatch.first_name = clean(input.first_name);
  if (input.last_name !== undefined) contactPatch.last_name = clean(input.last_name);
  if (input.phone !== undefined) contactPatch.phone = clean(input.phone) || null;
  if (input.company !== undefined) contactPatch.company = clean(input.company) || null;
  if (input.email !== undefined) {
    const email = clean(input.email).toLowerCase() || null;
    if (email) {
      const { data: taken } = await supabase.from("contacts").select("id").ilike("email", email).neq("id", contactId).maybeSingle();
      if (taken) throw new DealContactError("Another contact already uses that email. Remove this one and add that person instead.");
    }
    contactPatch.email = email;
  }
  if (Object.keys(contactPatch).length) {
    const { error } = await supabase.from("contacts").update(contactPatch).eq("id", contactId);
    if (error) throw new DealContactError(error.message, 500);
  }
  if (input.role !== undefined) await supabase.from("deal_contacts").update({ role: clean(input.role) || null }).eq("id", linkId);
  if (input.is_primary) { await makePrimary(dealId, linkId); await syncPrimary(dealId); }
  return listDealContacts(dealId);
}

/** Take someone off the deal. Their Contact stays in Contacts. */
export async function removeDealContact(dealId: string, linkId: string): Promise<DealContactRow[]> {
  const supabase = getSupabaseAdmin();
  const { data: link } = await supabase.from("deal_contacts").select("is_primary").eq("id", linkId).eq("deal_id", dealId).maybeSingle();
  if (!link) throw new DealContactError("That contact isn't on this deal.", 404);
  await supabase.from("deal_contacts").delete().eq("id", linkId);
  if ((link as { is_primary: boolean }).is_primary) {
    // The next person up becomes primary, so the deal keeps a contact.
    const rest = await listDealContacts(dealId);
    if (rest[0]) await makePrimary(dealId, rest[0].id);
    await syncPrimary(dealId);
  }
  return listDealContacts(dealId);
}
