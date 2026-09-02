// Data-access layer for the Pipeline (deals) early funnel. All access goes
// through the service-role client (RLS is deny-by-default; role gating lives in
// the API routes), matching lib/pipeline/data.ts.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createOpportunity } from "@/lib/pipeline/data";
import { requiredFieldsForStage, DEAL_STAGE_META } from "./stages";
import type {
  Actor, Activity, ActivityDraft, Deal, DealDraft, DealSourceType,
  DealStage, DealStageHistoryRow, DealTask, DealTaskDraft,
} from "./types";

// Server-managed fields are never accepted from callers.
function sanitizeDraft<T extends Record<string, unknown>>(draft: Partial<T>): Partial<T> {
  const clone = { ...draft } as Record<string, unknown>;
  for (const k of ["id", "opportunity_id", "job_number", "created_at", "updated_at"]) delete clone[k];
  return clone as Partial<T>;
}

// ─── Deals CRUD ───────────────────────────────────────────────────
export async function loadDeals(): Promise<Deal[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Deal[];
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Deal) ?? null;
}

export async function createDeal(draft: DealDraft, actor?: Actor): Promise<Deal> {
  const supabase = getSupabaseAdmin();
  const stage = (draft.stage ?? "new_working") as DealStage;
  const insert = { ...sanitizeDraft(draft), stage, created_by: actor?.id ?? null };
  const { data, error } = await supabase.from("deals").insert(insert).select().single();
  if (error) throw new Error(error.message);
  const created = data as Deal;
  await recordStageChange(created.id, created.job_number, null, created.stage, actor, "Deal created");
  return created;
}

export async function updateDeal(id: string, patch: Partial<DealDraft>): Promise<Deal> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deals")
    .update(sanitizeDraft(patch))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Deal;
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export class StageChangeError extends Error {
  status: number;
  missing: string[];
  constructor(message: string, missing: string[] = [], status = 422) {
    super(message);
    this.missing = missing;
    this.status = status;
  }
}

// Move a deal to a new stage. The early funnel allows free movement between
// stages; the only guard is that lost_on_hold requires a lost_reason. Moving
// into closed_won triggers the Pre-Con handoff (once).
export async function changeStage(
  id: string,
  to: DealStage,
  patch: Partial<DealDraft> = {},
  actor?: Actor,
  note?: string | null,
): Promise<Deal> {
  const current = await getDeal(id);
  if (!current) throw new StageChangeError("Deal not found.", [], 404);

  const merged = { ...current, ...patch } as Deal;
  const missing = requiredFieldsForStage(to).filter((f) => {
    const v = merged[f];
    return v === null || v === undefined || v === "";
  }) as string[];
  if (missing.length) {
    throw new StageChangeError(
      `Moving to "${DEAL_STAGE_META[to].label}" requires: ${missing.join(", ")}.`,
      missing,
    );
  }

  const from = current.stage;
  const updated = await updateDeal(id, { ...sanitizeDraft(patch), stage: to });
  await recordStageChange(id, updated.job_number, from, to, actor, note);

  // Pre-Con handoff: first time a deal reaches closed_won, mint the opportunity.
  if (to === "closed_won" && !current.opportunity_id) {
    return closeWonToPreCon(updated, actor);
  }
  return updated;
}

async function recordStageChange(
  dealId: string, jobNumber: string | null, from: string | null, to: string,
  actor?: Actor, note?: string | null,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase.from("deal_stage_history").insert({
    deal_id: dealId,
    job_number: jobNumber,
    from_stage: from,
    to_stage: to,
    changed_by: actor?.name ?? null,
    changed_by_id: actor?.id ?? null,
    note: note ?? null,
  });
}

export async function loadStageHistory(dealId: string): Promise<DealStageHistoryRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deal_stage_history")
    .select("*")
    .eq("deal_id", dealId)
    .order("changed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DealStageHistoryRow[];
}

// ─── Pre-Con handoff ──────────────────────────────────────────────
// On closed_won, create the pipeline_opportunities (Pre-Con) record via the
// existing pipeline layer (which mints the CM-YYYY-#### number), then back-link
// it onto the deal along with the number for quick reference.
export async function closeWonToPreCon(deal: Deal, actor?: Actor): Promise<Deal> {
  const opp = await createOpportunity(
    {
      opportunity_name: deal.title,
      contact_id: deal.contact_id ?? null,
      estimated_project_value: deal.estimated_value ?? null,
      estimated_budget_range: null,
      source: deal.source ?? null,
      notes: deal.notes ?? null,
      assigned_owner_id: deal.owner_id ?? null,
      stage: "opportunity",
    },
    actor,
  );
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deals")
    .update({ opportunity_id: opp.id, job_number: opp.job_number })
    .eq("id", deal.id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Deal;
}

// ─── Add to Pipeline (from Contact / Quote / Form submission) ─────
async function findDealBySource(sourceType: DealSourceType, sourceId: string): Promise<Deal | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();
  return (data as Deal) ?? null;
}

export type AddResult = { deal: Deal; created: boolean };

export async function addContactToPipeline(contactId: string, overrides: Partial<DealDraft>, actor?: Actor): Promise<AddResult> {
  const existing = await findDealBySource("contact", contactId);
  if (existing) return { deal: existing, created: false };

  const supabase = getSupabaseAdmin();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", contactId).maybeSingle();
  if (!contact) throw new Error("Contact not found.");
  const name = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || contact.company || "New Deal";

  const deal = await createDeal({
    title: overrides.title || `${name} — Project`,
    contact_id: contact.id,
    source_type: "contact",
    source_id: contact.id,
    source: contact.source ?? null,
    ...overrides,
  }, actor);
  return { deal, created: true };
}

export async function addQuoteToPipeline(quoteId: string, overrides: Partial<DealDraft>, actor?: Actor): Promise<AddResult> {
  const existing = await findDealBySource("quote", quoteId);
  if (existing) return { deal: existing, created: false };

  const supabase = getSupabaseAdmin();
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!quote) throw new Error("Quote not found.");

  const deal = await createDeal({
    title: overrides.title || quote.name || "New Deal",
    contact_id: quote.contact_id ?? null,
    source_type: "quote",
    source_id: quote.id,
    source: quote.source ?? null,
    estimated_value: quote.estimated_value ?? null,
    ...overrides,
  }, actor);
  return { deal, created: true };
}

export async function addSubmissionToPipeline(submissionId: string, overrides: Partial<DealDraft>, actor?: Actor): Promise<AddResult> {
  const existing = await findDealBySource("contact_submission", submissionId);
  if (existing) return { deal: existing, created: false };

  const supabase = getSupabaseAdmin();
  const { data: sub } = await supabase.from("contact_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (!sub) throw new Error("Form submission not found.");
  const name = `${sub.first_name ?? ""} ${sub.last_name ?? ""}`.trim() || "New Deal";

  const deal = await createDeal({
    title: overrides.title || `${name} — ${sub.subject || "Inquiry"}`,
    contact_id: sub.contact_id ?? null,
    source_type: "contact_submission",
    source_id: sub.id,
    source: sub.how_heard ?? "website",
    notes: sub.message ?? null,
    ...overrides,
  }, actor);
  return { deal, created: true };
}

// ─── Activities (touch log) + optional next task ──────────────────
export async function loadActivities(filter: { dealId?: string; contactId?: string; jobId?: string }): Promise<Activity[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("activities").select("*").order("occurred_at", { ascending: false });
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  if (filter.contactId) q = q.eq("contact_id", filter.contactId);
  if (filter.jobId) q = q.eq("job_id", filter.jobId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Activity[];
}

// Log an activity and bump the deal's last_activity_at. Optionally spawn the
// next task in the same call (quick-entry form, spec §8).
export async function logActivity(
  draft: ActivityDraft,
  actor?: Actor,
  nextTask?: { title: string; assigned_to?: string | null; due_at?: string | null } | null,
): Promise<{ activity: Activity; task: DealTask | null }> {
  const supabase = getSupabaseAdmin();
  const insert = {
    ...draft,
    created_by: actor?.id ?? draft.created_by ?? null,
    created_by_name: actor?.name ?? draft.created_by_name ?? null,
    occurred_at: draft.occurred_at ?? new Date().toISOString(),
    metadata: draft.metadata ?? {},
  };
  const { data, error } = await supabase.from("activities").insert(insert).select().single();
  if (error) throw new Error(error.message);
  const activity = data as Activity;

  if (activity.deal_id) {
    await supabase.from("deals").update({ last_activity_at: activity.occurred_at }).eq("id", activity.deal_id);
  }

  let task: DealTask | null = null;
  if (nextTask?.title) {
    task = await createDealTask({
      deal_id: activity.deal_id,
      contact_id: activity.contact_id,
      title: nextTask.title,
      assigned_to: nextTask.assigned_to ?? null,
      due_at: nextTask.due_at ?? null,
      created_from_activity_id: activity.id,
    }, actor);
  }
  return { activity, task };
}

// ─── Deal tasks ───────────────────────────────────────────────────
export async function loadDealTasks(filter: { dealId?: string; assignedTo?: string; openOnly?: boolean }): Promise<DealTask[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("deal_tasks").select("*").order("due_at", { ascending: true, nullsFirst: false });
  if (filter.dealId) q = q.eq("deal_id", filter.dealId);
  if (filter.assignedTo) q = q.eq("assigned_to", filter.assignedTo);
  if (filter.openOnly) q = q.is("completed_at", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as DealTask[];
}

export async function createDealTask(draft: DealTaskDraft, actor?: Actor): Promise<DealTask> {
  const supabase = getSupabaseAdmin();
  const insert = { ...draft, created_by: actor?.id ?? draft.created_by ?? null };
  const { data, error } = await supabase.from("deal_tasks").insert(insert).select().single();
  if (error) throw new Error(error.message);
  return data as DealTask;
}

export async function updateDealTask(id: string, patch: Partial<DealTaskDraft>): Promise<DealTask> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("deal_tasks").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as DealTask;
}
