import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createContact } from "@/lib/contacts/data";
import { createQuote } from "@/lib/quotes/data";
import { addSubmissionToPipeline } from "@/lib/deals/data";
import type { Actor } from "@/lib/deals/types";
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

// ─── Bulk status + delete ─────────────────────────────────────────
export async function bulkUpdateSubmissionStatus(ids: string[], status: ContactSubmissionStatus): Promise<void> {
  if (!ids.length) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("contact_submissions").update({ status }).in("id", ids);
  if (error) throw new Error(error.message);
}

export async function deleteContactSubmissions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("contact_submissions").delete().in("id", ids);
  if (error) throw new Error(error.message);
}

// ─── Conversions (submission → contact / lead / deal) ─────────────
async function getSubmission(id: string): Promise<ContactSubmission> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("contact_submissions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Submission not found.");
  return data as ContactSubmission;
}

function submissionAddress(s: ContactSubmission): string | null {
  const line1 = [s.address_line1, s.address_line2].filter(Boolean).join(", ");
  const cityLine = [[s.city, s.state].filter(Boolean).join(", "), s.zip].filter(Boolean).join(" ");
  const full = [line1, cityLine].filter(Boolean).join(", ");
  return full || null;
}

const budgetLabel = (s: ContactSubmission) => s.budget_amount || s.project_budget || null;

// A single notes block that preserves everything the form captured.
function submissionNotes(s: ContactSubmission): string {
  const parts = [
    s.subject ? `Subject: ${s.subject}` : "",
    s.how_heard ? `How they heard: ${s.how_heard}` : "",
    budgetLabel(s) ? `Budget: ${budgetLabel(s)}` : "",
    s.project_status?.length ? `Project status: ${s.project_status.join(", ")}` : "",
    submissionAddress(s) ? `Address: ${submissionAddress(s)}` : "",
    s.message ? `\nMessage:\n${s.message}` : "",
  ].filter(Boolean);
  return parts.join("\n");
}

// Convert a submission into a Contact. Idempotent: if already linked, returns
// the existing contact id. Links the submission to the new contact.
export async function convertSubmissionToContact(id: string): Promise<{ contactId: string; created: boolean }> {
  const supabase = getSupabaseAdmin();
  const sub = await getSubmission(id);
  if (sub.contact_id) return { contactId: sub.contact_id, created: false };

  const contact = await createContact({
    first_name: sub.first_name,
    last_name: sub.last_name,
    email: sub.email,
    phone: sub.phone,
    company: null,
    type: "Lead",
    status: "active",
    address: submissionAddress(sub),
    city: sub.city,
    state: sub.state,
    zip: sub.zip,
    notes: submissionNotes(sub),
    tags: null,
    source: sub.how_heard || "website",
    lead_owner: null,
  });
  await supabase.from("contact_submissions").update({ contact_id: contact.id }).eq("id", id);
  return { contactId: contact.id, created: true };
}

// Convert a submission into a Lead (quote). Ensures a linked contact first.
export async function convertSubmissionToLead(id: string): Promise<{ quoteId: string }> {
  const sub = await getSubmission(id);
  const { contactId } = await convertSubmissionToContact(id);
  const quote = await createQuote({
    contact_id: contactId,
    name: `${sub.first_name} ${sub.last_name}`.trim() || sub.subject || "Lead",
    email: sub.email,
    phone: sub.phone,
    project_type: sub.project_status?.[0] ?? null,
    location: submissionAddress(sub),
    sq_ft: null,
    budget_range: budgetLabel(sub),
    timeline: null,
    services: sub.project_status?.length ? sub.project_status : null,
    description: submissionNotes(sub),
    status: "New",
    estimated_value: null,
    source: sub.how_heard || "website",
  });
  return { quoteId: quote.id };
}

// Convert a submission into a pipeline Deal. Ensures a linked contact first so
// the deal ties back to a real contact record, then delegates to the deals layer.
export async function convertSubmissionToDeal(id: string, actor?: Actor): Promise<{ dealId: string; created: boolean }> {
  const sub = await getSubmission(id);
  await convertSubmissionToContact(id);
  const { deal, created } = await addSubmissionToPipeline(id, { notes: submissionNotes(sub) }, actor);
  return { dealId: deal.id, created };
}

// ─── Detail page support ──────────────────────────────────────────
/** One submission, or null. Used by the detail page. */
export async function getContactSubmission(id: string): Promise<ContactSubmission | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("contact_submissions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ContactSubmission | null) ?? null;
}

/**
 * Newest-first ids, for the detail page's prev/next arrows.
 *
 * The list hands over its own ordering (which respects the active filter) when
 * you arrive by clicking a row; this is the fallback for a deep link or a
 * bookmarked submission, so the arrows always work.
 */
export async function loadSubmissionOrder(limit = 500): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contact_submissions")
    .select("id")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/**
 * Everything we have already said to, or heard from, this person.
 *
 * Matched on email and phone rather than contact_id, because most submissions
 * arrive before anyone has converted them to a contact — and knowing that a
 * lead already emailed twice last month is exactly what stops them being
 * answered as if they were new.
 */
export async function loadSubmissionThread(
  email: string | null,
  phone: string | null,
  limit = 25,
): Promise<ThreadMessage[]> {
  const handles = [email?.trim(), phone?.trim()].filter((v): v is string => !!v);
  if (handles.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const or = handles
    .flatMap((h) => [`to_address.eq.${h}`, `from_address.eq.${h}`])
    .join(",");

  const { data, error } = await supabase
    .from("messages")
    .select("id, direction, channel, subject, body, status, sent_at, created_at")
    .or(or)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ThreadMessage[];
}

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  channel: string;
  subject: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string;
};
