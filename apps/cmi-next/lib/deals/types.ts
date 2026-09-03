// Pipeline / CRM Phase 1 — deal (early sales funnel) types.
//
// A Deal is the early funnel record (Contact/Lead/Form submission → Add to
// Pipeline). At the closed_won stage it hands off to a pipeline_opportunities
// row (the Pre-Con record) — see lib/deals/data.ts closeWonToPreCon().

export type DealStage =
  | "new_working"
  | "contacted"
  | "qualified"
  | "opportunity"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "lost_on_hold";

// Where a deal was created from (used to avoid double-converting a source).
export type DealSourceType =
  | "contact"
  | "quote"
  | "contact_submission"
  | "business_card"
  | "manual";

export type Deal = {
  id: string;
  stage: DealStage;
  title: string;

  contact_id: string | null;
  company_id: string | null;

  // Location (for the pipeline Map view; geocoded best-effort)
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;

  source_type: DealSourceType | null;
  source_id: string | null;
  source: string | null;

  estimated_value: number | null;
  target_start_date: string | null;
  expected_close_date: string | null;
  job_type: string | null;
  probability: number | null;

  owner_id: string | null;

  // Pre-Con handoff (set on closed_won)
  opportunity_id: string | null;
  job_number: string | null;

  // Next action / activity summary
  last_activity_at: string | null;
  next_action: string | null;
  next_action_due: string | null;
  next_action_owner_id: string | null;

  lost_reason: string | null;

  notes: string | null;
  tags: string[] | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Fields a client may send on create/update. Server-managed fields
// (id, opportunity_id, job_number, created_at, updated_at) are never accepted.
export type DealDraft = Partial<
  Omit<Deal, "id" | "opportunity_id" | "job_number" | "created_at" | "updated_at">
> & { title: string };

export type DealStageHistoryRow = {
  id: string;
  deal_id: string;
  job_number: string | null;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_by_id: string | null;
  note: string | null;
  changed_at: string;
};

// ─── Activities (polymorphic touch log) ───────────────────────────
export type ActivityType =
  | "call"
  | "sms"
  | "email"
  | "note"
  | "voice_note"
  | "ai_agent"
  | "selection"
  | "appointment"
  | "meeting"
  | "site_visit"
  | "scan_3d";

export type Activity = {
  id: string;
  deal_id: string | null;
  job_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  message_id: string | null;
  type: ActivityType;
  summary: string | null;
  body: string | null;
  created_by: string | null;
  created_by_name: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ActivityDraft = Partial<Omit<Activity, "id" | "created_at">> & { type: ActivityType };

// ─── Deal tasks (lightweight next-action) ─────────────────────────
export type DealTask = {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_from_activity_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DealTaskDraft = Partial<Omit<DealTask, "id" | "created_at" | "updated_at">> & { title: string };

// Per-deal completion of a code-defined stage checklist item.
export type DealChecklistProgress = {
  id: string;
  deal_id: string;
  item_key: string;
  completed_at: string;
  completed_by: string | null;
};

// Actor passed from API routes into the data layer for provenance.
export type Actor = { name?: string | null; id?: string | null };
