// Data-access layer for the sales pipeline. All access goes through the
// service-role client (RLS is bypassed server-side; role gating lives in the
// API routes / agent registry, matching the rest of the app).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { validateTransition, derivedTransitionPatch, STAGE_META } from "./stages";
import type { Opportunity, OpportunityDraft, PipelineStage, StageHistoryRow, WarrantyRequest } from "./types";

// job_number is intentionally NOT accepted from callers — the DB trigger owns it.
function sanitizeDraft(draft: Partial<Opportunity>): Partial<Opportunity> {
  const clone = { ...draft } as Record<string, unknown>;
  delete clone.id;
  delete clone.job_number;
  delete clone.created_at;
  delete clone.updated_at;
  return clone as Partial<Opportunity>;
}

export async function loadOpportunities(): Promise<Opportunity[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_opportunities")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Opportunity[];
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("pipeline_opportunities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Opportunity) ?? null;
}

// Create an Opportunity. This is the ONLY entry point that mints a job number
// (via the DB insert trigger) — callers pass no job_number. An initial stage
// history row is written so conversion reporting has a baseline.
export async function createOpportunity(
  draft: OpportunityDraft,
  actor?: { name?: string | null; id?: string | null },
): Promise<Opportunity> {
  const supabase = getSupabaseAdmin();
  const stage = (draft.stage ?? "opportunity") as PipelineStage;
  const { data, error } = await supabase
    .from("pipeline_opportunities")
    .insert({ ...sanitizeDraft(draft), stage })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const created = data as Opportunity;

  await recordStageChange(created.id, created.job_number, null, created.stage, actor, "Opportunity created");
  return created;
}

export async function updateOpportunity(id: string, patch: Partial<OpportunityDraft>): Promise<Opportunity> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_opportunities")
    .update({ ...sanitizeDraft(patch), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Opportunity;
}

export async function deleteOpportunity(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("pipeline_opportunities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export class TransitionError extends Error {
  status: number;
  missing: string[];
  constructor(message: string, missing: string[] = [], status = 422) {
    super(message);
    this.missing = missing;
    this.status = status;
  }
}

// Move a record to a new stage. Validates the transition (allowed path +
// required fields on the merged record), applies any derived side-effects
// (warranty dates, lost/closed dates), persists, and logs the change.
export async function transitionStage(
  id: string,
  to: PipelineStage,
  patch: Partial<Opportunity> = {},
  actor?: { name?: string | null; id?: string | null },
  note?: string | null,
): Promise<Opportunity> {
  const current = await getOpportunity(id);
  if (!current) throw new TransitionError("Opportunity not found.", [], 404);

  const check = validateTransition(current, to, patch);
  if (!check.ok) throw new TransitionError(check.error, check.missing);

  const today = new Date().toISOString().slice(0, 10);
  const derived = derivedTransitionPatch(to, patch, today);
  const updated = await updateOpportunity(id, { ...sanitizeDraft(patch), ...derived, stage: to });

  await recordStageChange(id, updated.job_number, current.stage, to, actor, note);
  return updated;
}

async function recordStageChange(
  opportunityId: string,
  jobNumber: string | null,
  from: string | null,
  to: string,
  actor?: { name?: string | null; id?: string | null },
  note?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("pipeline_stage_history").insert({
    opportunity_id: opportunityId,
    job_number: jobNumber,
    from_stage: from,
    to_stage: to,
    changed_by: actor?.name ?? null,
    changed_by_id: actor?.id ?? null,
    note: note ?? null,
  });
}

export async function loadStageHistory(): Promise<StageHistoryRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("pipeline_stage_history")
    .select("*")
    .order("changed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as StageHistoryRow[];
}

// ─── Conversion: Lead → Opportunity ────────────────────────────
// A quote (or contact) is a Lead. Converting mints the job number. Required
// fields for this transition (doc §12): opportunity_name, assigned_owner,
// a scope/description, and the job_number (auto).
export async function convertQuoteToOpportunity(
  quoteId: string,
  overrides: Partial<OpportunityDraft>,
  actor?: { name?: string | null; id?: string | null },
): Promise<Opportunity> {
  const supabase = getSupabaseAdmin();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!quote) throw new Error("Quote not found.");

  const draft: OpportunityDraft = {
    opportunity_name: overrides.opportunity_name || quote.name || "New Opportunity",
    contact_id: quote.contact_id ?? null,
    linked_quote_id: quote.id,
    project_type: quote.project_type ?? null,
    project_address: quote.location ?? null,
    estimated_budget_range: quote.budget_range ?? null,
    estimated_project_value: quote.estimated_value ?? null,
    source: quote.source ?? null,
    notes: quote.description ?? null,
    stage: "opportunity",
    ...overrides,
  };
  const created = await createOpportunity(draft, actor);

  // Mark the quote as won/converted so it drops out of the open lead list.
  await supabase.from("quotes").update({ status: "Won", updated_at: new Date().toISOString() }).eq("id", quoteId);
  return created;
}

export async function convertContactToOpportunity(
  contactId: string,
  overrides: Partial<OpportunityDraft>,
  actor?: { name?: string | null; id?: string | null },
): Promise<Opportunity> {
  const supabase = getSupabaseAdmin();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).maybeSingle();
  if (!contact) throw new Error("Contact not found.");

  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.company || "New Opportunity";
  const draft: OpportunityDraft = {
    opportunity_name: overrides.opportunity_name || `${name} — Project`,
    contact_id: contact.id,
    project_address: contact.address ?? null,
    city: contact.city ?? null,
    state: contact.state ?? null,
    zip_code: contact.zip ?? null,
    source: contact.source ?? null,
    stage: "opportunity",
    ...overrides,
  };
  return createOpportunity(draft, actor);
}

// ─── Warranty requests ─────────────────────────────────────────
export async function loadWarrantyRequests(): Promise<WarrantyRequest[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("warranty_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as WarrantyRequest[];
}

export async function createWarrantyRequest(input: Partial<WarrantyRequest>): Promise<WarrantyRequest> {
  const supabase = getSupabaseAdmin();
  // If tied to an opportunity, backfill the job number for convenience.
  let jobNumber = input.job_number ?? null;
  if (!jobNumber && input.opportunity_id) {
    const opp = await getOpportunity(input.opportunity_id);
    jobNumber = opp?.job_number ?? null;
  }
  const { data, error } = await supabase
    .from("warranty_requests")
    .insert({ ...input, job_number: jobNumber })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as WarrantyRequest;
}

export async function updateWarrantyRequest(id: string, patch: Partial<WarrantyRequest>): Promise<WarrantyRequest> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("warranty_requests")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as WarrantyRequest;
}

// Re-export for convenience in API routes.
export { STAGE_META };
