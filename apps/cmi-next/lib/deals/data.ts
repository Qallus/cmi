// Data-access layer for the Pipeline (deals) early funnel. All access goes
// through the service-role client (RLS is deny-by-default; role gating lives in
// the API routes), matching lib/pipeline/data.ts.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { createOpportunity } from "@/lib/pipeline/data";
import { linkDealToOpportunity } from "@/lib/projections/links";
import { geocodeAddress } from "@/lib/jobs/geocode";
import { requiredFieldsForStage, DEAL_STAGE_META } from "./stages";
import type {
  Actor, Activity, ActivityDraft, Deal, DealChecklistItem, DealChecklistProgress, DealDraft, DealSourceType,
  DealStage, DealStageHistoryRow, DealTask, DealTaskDraft,
} from "./types";

// Server-managed fields are never accepted from callers.
function sanitizeDraft<T extends Record<string, unknown>>(draft: Partial<T>): Partial<T> {
  const clone = { ...draft } as Record<string, unknown>;
  // Archive state moves through archiveDeal/unarchiveDeal, never a PATCH body.
  for (const k of ["id", "opportunity_id", "job_number", "created_at", "updated_at", "archived_at", "archived_by"]) delete clone[k];
  return clone as Partial<T>;
}

// Best-effort geocode + full_address when address parts are present and no
// explicit coordinates were provided. Mirrors the jobs geocode-on-save behavior.
async function withGeocode(draft: Partial<Deal>): Promise<Partial<Deal>> {
  const hasAddressPart = draft.street_address || draft.city || draft.state || draft.zip;
  if (!hasAddressPart) return draft;
  const out: Partial<Deal> = { ...draft };
  out.full_address = [draft.street_address, [draft.city, draft.state].filter(Boolean).join(", "), draft.zip]
    .map((p) => (p ?? "").trim()).filter(Boolean).join(", ") || null;
  if (draft.latitude == null && draft.longitude == null) {
    const geo = await geocodeAddress({ street_address: draft.street_address, city: draft.city, state: draft.state, zip_code: draft.zip });
    if (geo) { out.latitude = geo.latitude; out.longitude = geo.longitude; }
  }
  return out;
}

// ─── Deals CRUD ───────────────────────────────────────────────────
/** Archived deals are hidden from the board unless explicitly asked for. */
export async function loadDeals(opts: { includeArchived?: boolean } = {}): Promise<Deal[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase
    .from("deals")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!opts.includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q;
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
  const insert = { ...(await withGeocode(sanitizeDraft(draft))), stage, created_by: actor?.id ?? null, updated_by: actor?.id ?? null };
  const { data, error } = await supabase.from("deals").insert(insert).select().single();
  if (error) throw new Error(error.message);
  const created = data as Deal;
  await recordStageChange(created.id, created.job_number, null, created.stage, actor, "Deal created");
  return created;
}

// `actor` is stamped onto updated_by so the change log can attribute the edit.
export async function updateDeal(id: string, patch: Partial<DealDraft>, actor?: Actor): Promise<Deal> {
  const supabase = getSupabaseAdmin();
  // Re-geocode only when an address field is part of this update.
  const addressTouched = ["street_address", "city", "state", "zip"].some((k) => k in patch);
  const clean = sanitizeDraft(patch);
  const finalPatch = addressTouched ? await withGeocode({ ...clean, latitude: null, longitude: null }) : clean;
  if (actor?.id) (finalPatch as Record<string, unknown>).updated_by = actor.id;
  const { data, error } = await supabase
    .from("deals")
    .update(finalPatch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Deal;
}

/**
 * Archive leaves the active pipeline but keeps the record, its activities,
 * tasks and stage history, so it can be restored. Permanent removal is
 * deleteDeal(), which is Super-Admin only at the route.
 */
export async function archiveDeal(id: string, actor?: Actor): Promise<Deal> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deals")
    .update({ archived_at: new Date().toISOString(), archived_by: actor?.id ?? null, updated_by: actor?.id ?? null })
    .eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Deal;
}

export async function unarchiveDeal(id: string, actor?: Actor): Promise<Deal> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("deals")
    .update({ archived_at: null, archived_by: null, updated_by: actor?.id ?? null })
    .eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Deal;
}

/**
 * Copy a deal as a fresh lead. The client, address, value and notes carry
 * over; anything earned by the original — its job number, Pre-Con handoff,
 * stage, activity and tasks — does not.
 */
export async function duplicateDeal(id: string, actor?: Actor): Promise<Deal> {
  const source = await getDeal(id);
  if (!source) throw new Error("Deal not found.");

  const {
    id: _id, job_number: _jn, opportunity_id: _oid, created_at: _ca, updated_at: _ua,
    created_by: _cb, updated_by: _ub, archived_at: _aa, archived_by: _ab,
    last_activity_at: _la, stage: _stage, source_type: _st, source_id: _si,
    ...carried
  } = source as Deal & Record<string, unknown>;

  return createDeal(
    { ...(carried as Partial<DealDraft>), title: `${source.title} (copy)`, stage: "new_working" } as DealDraft,
    actor,
  );
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
  const updated = await updateDeal(id, { ...sanitizeDraft(patch), stage: to }, actor);
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
  // A deal already in Projections follows the work into Pre-Con.
  await linkDealToOpportunity(deal.id, opp.id, actor);
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
    street_address: contact.address ?? null,
    city: contact.city ?? null,
    state: contact.state ?? null,
    zip: contact.zip ?? null,
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
    street_address: [sub.address_line1, sub.address_line2].filter(Boolean).join(", ") || null,
    city: sub.city ?? null,
    state: sub.state ?? null,
    zip: sub.zip ?? null,
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

export async function deleteDealTask(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("deal_tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateDealTask(id: string, patch: Partial<DealTaskDraft>): Promise<DealTask> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("deal_tasks").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as DealTask;
}

// ─── Stage checklist progress ─────────────────────────────────────
export async function loadChecklistProgress(dealId: string): Promise<DealChecklistProgress[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("deal_checklist_progress").select("*").eq("deal_id", dealId);
  if (error) throw new Error(error.message);
  return (data ?? []) as DealChecklistProgress[];
}

// Toggle a checklist item on/off. Completion = a row exists.
export async function setChecklistItem(dealId: string, itemKey: string, done: boolean, actor?: Actor): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (done) {
    const { error } = await supabase
      .from("deal_checklist_progress")
      .upsert({ deal_id: dealId, item_key: itemKey, completed_at: new Date().toISOString(), completed_by: actor?.id ?? null }, { onConflict: "deal_id,item_key" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("deal_checklist_progress").delete().eq("deal_id", dealId).eq("item_key", itemKey);
    if (error) throw new Error(error.message);
  }
}

// ─── Custom (staff-added) checklist items ─────────────────────────
export async function loadChecklistItems(dealId: string): Promise<DealChecklistItem[]> {
  const { data, error } = await getSupabaseAdmin().from("deal_checklist_items").select("*").eq("deal_id", dealId).order("sort_order").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as DealChecklistItem[];
}
export async function createChecklistItem(dealId: string, input: { label: string; required?: boolean }, actor?: Actor): Promise<DealChecklistItem> {
  const { data, error } = await getSupabaseAdmin().from("deal_checklist_items")
    .insert({ deal_id: dealId, label: input.label.trim(), required: !!input.required, created_by: actor?.id ?? null })
    .select().single();
  if (error) throw new Error(error.message);
  return data as DealChecklistItem;
}
export async function updateChecklistItem(id: string, patch: { label?: string; done?: boolean }, actor?: Actor): Promise<DealChecklistItem> {
  const row: Record<string, unknown> = {};
  if (typeof patch.label === "string") row.label = patch.label.trim();
  if (typeof patch.done === "boolean") { row.completed_at = patch.done ? new Date().toISOString() : null; row.completed_by = patch.done ? (actor?.id ?? null) : null; }
  const { data, error } = await getSupabaseAdmin().from("deal_checklist_items").update(row).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as DealChecklistItem;
}
export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("deal_checklist_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Activity editing ─────────────────────────────────────────────
// Timeline entries (notes especially) can be corrected after posting. The
// author or an admin may edit; edited_at drives the "(edited)" marker.
export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await getSupabaseAdmin().from("activities").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Activity) ?? null;
}

export async function updateActivity(
  id: string,
  patch: { summary?: string | null; body?: string | null; occurred_at?: string },
  actor: { id: string },
): Promise<Activity> {
  const next: Record<string, unknown> = { edited_at: new Date().toISOString(), edited_by: actor.id };
  if ("summary" in patch) next.summary = patch.summary?.toString().trim() || null;
  if ("body" in patch) next.body = patch.body?.toString().trim() || null;
  if (patch.occurred_at) next.occurred_at = patch.occurred_at;
  const { data, error } = await getSupabaseAdmin().from("activities").update(next).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Activity;
}

export async function deleteActivity(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
