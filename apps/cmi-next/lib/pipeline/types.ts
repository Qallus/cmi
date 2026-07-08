// Sales pipeline / opportunity lifecycle types.
// See docs/features/cmi-sales-process-leads-opportunities.md.
//
// Terminology note: a "Lead" lives in the CRM (contacts / quotes) and does NOT
// have a job number. The pipeline below begins at the Opportunity stage — the
// point where a job number is created (by the DB insert trigger).

export type PipelineStage =
  | "opportunity"
  | "active_budget"
  | "pre_construction_design"
  | "active_project"
  | "warranty"
  | "closed"
  | "long_lead"
  | "not_moving_forward";

export type Opportunity = {
  id: string;
  job_number: string | null;
  stage: PipelineStage;
  status_reason: string | null;

  // Links
  contact_id: string | null;
  linked_quote_id: string | null;
  linked_lead_id: string | null;
  project_item_id: string | null;

  // Opportunity core
  opportunity_name: string;
  project_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  project_type: string | null;
  estimated_budget_range: string | null;
  estimated_project_value: number | null;
  probability_percent: number | null;
  source: string | null;
  referral_source: string | null;
  assigned_owner: string | null;
  assigned_owner_id: string | null;
  tags: string[] | null;
  notes: string | null;

  // Active Budget
  budget_status: string | null;
  budget_owner: string | null;
  budget_due_date: string | null;
  last_budget_sent_date: string | null;
  budget_revision_count: number | null;
  current_budget_total: number | null;
  internal_estimated_cost: number | null;
  projected_margin: number | null;

  // Pre-Construction / Design
  agreement_status: string | null;
  design_team: string[] | null;
  architect: string | null;
  designer: string | null;
  engineer: string | null;
  permit_status: string | null;
  procurement_status: string | null;
  projected_construction_start_date: string | null;
  projected_construction_value: number | null;
  forecast_probability_percent: number | null;

  // Active Project
  construction_agreement_status: string | null;
  start_date: string | null;
  projected_completion_date: string | null;
  actual_completion_date: string | null;
  project_manager: string | null;
  superintendent: string | null;
  project_status: string | null;
  contract_value: number | null;
  approved_change_orders_total: number | null;
  current_project_value: number | null;

  // Warranty
  warranty_start_date: string | null;
  warranty_expiration_date: string | null;
  warranty_period_months: number | null;
  warranty_status: string | null;

  // Closed
  closed_date: string | null;
  final_contract_value: number | null;
  final_project_value: number | null;
  final_margin: number | null;
  closeout_notes: string | null;

  // Long Lead
  long_lead_reason: string | null;
  follow_up_date: string | null;
  follow_up_owner: string | null;
  follow_up_frequency: string | null;

  // Not Moving Forward
  lost_reason: string | null;
  lost_to_builder: string | null;
  lost_date: string | null;

  created_at: string;
  updated_at: string;
};

// Fields the client may send when creating/updating. job_number is
// server-managed (assigned by the DB trigger) and never accepted from input.
export type OpportunityDraft = Partial<Omit<Opportunity, "id" | "job_number" | "created_at" | "updated_at">> & {
  opportunity_name: string;
};

export type StageHistoryRow = {
  id: string;
  opportunity_id: string;
  job_number: string | null;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  changed_by_id: string | null;
  note: string | null;
  changed_at: string;
};

export type WarrantyRequest = {
  id: string;
  opportunity_id: string | null;
  job_number: string | null;
  contact_id: string | null;
  submitted_by: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  request_title: string;
  request_description: string | null;
  location_in_home: string | null;
  priority: "low" | "normal" | "urgent";
  status: "submitted" | "under_review" | "scheduled" | "in_progress" | "resolved" | "closed";
  assigned_to: string | null;
  photos: string[] | null;
  documents: string[] | null;
  submitted_at: string;
  updated_at: string;
};

// ─── Option lists (shared by UI + agent registry) ──────────────

export const PROJECT_TYPES = [
  "remodel", "addition", "adu", "casita", "custom_home",
  "commercial", "interior_renovation", "exterior_renovation", "other",
] as const;

export const LONG_LEAD_REASONS = [
  "waiting_on_financing", "waiting_on_design", "future_purchase",
  "planning_for_next_year", "timing_not_right", "client_not_ready", "other",
] as const;

export const FOLLOW_UP_FREQUENCIES = ["weekly", "monthly", "quarterly", "custom"] as const;

// Not Moving Forward reasons — the required reason/tag list (doc §9).
export const LOST_REASONS = [
  "not_feasible", "outside_budget", "chose_another_builder", "cancelled",
  "on_hold_indefinitely", "client_unresponsive", "scope_not_aligned",
  "timeline_not_aligned", "not_ideal_project_type", "duplicate", "other",
] as const;

export const BUDGET_STATUSES = [
  "initial_review", "site_visit_scheduled", "existing_conditions", "matterport_complete",
  "estimating", "budget_sent", "budget_revision", "value_engineering",
  "awaiting_client_response", "ready_for_pre_construction",
] as const;
