// Jobs feature types. See docs/features/job-features.md.
// A Job is the central project record, created when an Opportunity becomes a
// real project. It links back to the sales pipeline via related_opportunity_id
// (pipeline_opportunities) and related_lead_id (source contact/quote).

export type JobStatus =
  | "draft"
  | "opportunity"
  | "active_budget"
  | "pre_construction_design"
  | "active_project"
  | "warranty"
  | "closed"
  | "long_lead"
  | "not_moving_forward"
  | "on_hold"
  | "cancelled";

export type ContractType = "fixed_price" | "open_book";

export type Job = {
  id: string;
  related_lead_id: string | null;
  related_opportunity_id: string | null;
  job_number: string | null;
  lead_number: string | null;
  job_name: string;
  prefix: string | null;
  job_type_id: string | null;
  job_group_id: string | null;
  status: JobStatus;
  job_color: string | null;
  contract_type: ContractType | null;
  contract_price: number | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  projected_start_date: string | null;
  actual_start_date: string | null;
  projected_completion_date: string | null;
  actual_completion_date: string | null;
  project_manager: string | null;
  superintendent: string | null;
  update_actual_dates_from_schedule: boolean | null;
  schedule_color: string | null;
  work_days: string[] | null;
  funded_by_construction_loan: boolean | null;
  square_feet: number | null;
  permit_number: string | null;
  lot_info: string | null;
  internal_notes: string | null;
  vendor_notes: string | null;
  is_template: boolean;
  source_template_id: string | null;
  accounting_customer_id: string | null;

  // Client portal (see docs/features/client-portal-jobs-feature.md)
  client_portal_enabled: boolean | null;
  progress_percentage: number | null;
  current_phase: string | null;
  next_milestone: string | null;
  client_description: string | null;
  cover_image_url: string | null;
  last_client_update_at: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type JobDraft = Partial<Omit<Job, "id" | "job_number" | "created_at" | "updated_at" | "archived_at">> & {
  job_name: string;
};

export type JobType = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number | null;
  is_active: boolean;
};

export type JobGroup = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
};

// Permission maps stored as jsonb on job_contacts / job_vendors.
export type ClientPermissions = {
  // Project-management visibility
  pm_phone?: boolean;
  locked_selections?: boolean;
  schedule_phases?: boolean;
  schedule_items?: boolean;
  // Submission
  change_order_requests?: boolean;
  warranty_claims?: boolean;
  messages?: boolean;
  files?: boolean;
  photos?: boolean;
  // Financial visibility
  price_summary?: boolean;
  remaining_invoice_balance?: boolean;
  purchase_orders?: boolean;
  invoices?: boolean;
  job_costing_budget?: boolean;
};

export type VendorPermissions = {
  schedule?: boolean;
  assigned_tasks?: boolean;
  files?: boolean;
  messages?: boolean;
  purchase_orders?: boolean;
  change_orders?: boolean;
  selections?: boolean;
  daily_logs?: boolean;
};

export type JobContact = {
  id: string;
  job_id: string;
  contact_id: string | null;
  role: string | null;
  is_primary: boolean;
  portal_access_enabled: boolean;
  permissions: ClientPermissions;
  created_at: string;
  // joined
  contact?: { id: string; first_name: string; last_name: string; email: string; phone: string | null; company: string | null } | null;
};

export type JobInternalUser = {
  id: string;
  job_id: string;
  staff_user_id: string | null;
  role: string | null;
  access_statuses: string[] | null;
  notifications_enabled: boolean;
  created_at: string;
  // joined
  user?: { id: string; display_name: string | null; email: string; role_slug: string } | null;
};

export type JobVendor = {
  id: string;
  job_id: string;
  vendor_contact_id: string | null;
  role: string | null;
  access_permissions: VendorPermissions;
  notifications_enabled: boolean;
  created_at: string;
  // joined
  vendor?: { id: string; first_name: string; last_name: string; company: string | null; email: string; phone: string | null } | null;
};

export type JobSettings = {
  id: string;
  job_id: string;
  geofencing_enabled: boolean;
  allow_allowances: boolean;
  schedule_online: boolean;
  client_updates_enabled: boolean;
  daily_logs_enabled: boolean;
  warranty_claims_enabled: boolean;
  markup_type: string | null;
  markup_percentage: number | null;
  default_tax_rate: number | null;
  projection_reference_default: string | null;
  include_time_clock_labor_in_budget: boolean;
  individual_po_limit: number | null;
  total_po_limit: number | null;
  updated_at: string;
};

export type JobInsurance = {
  id: string;
  job_id: string;
  status: string | null;
  provider: string | null;
  policy_number: string | null;
  policy_start_date: string | null;
  policy_end_date: string | null;
  coverage_amount: number | null;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// A fully-loaded job with its related collections (for detail pages).
export type JobWithRelations = Job & {
  job_type: JobType | null;
  job_group: JobGroup | null;
  contacts: JobContact[];
  internal_users: JobInternalUser[];
  vendors: JobVendor[];
  settings: JobSettings | null;
  insurance: JobInsurance | null;
};

// Price-summary payload (change orders / invoices are placeholders until those
// tables exist — see docs/features/cmi-jobs-implementation.md).
export type PriceSummary = {
  job: Job;
  contract_price: number;
  change_orders: { title: string; date: string; price: number; status: string }[];
  invoices: { number: string; date: string; due_date: string; amount: number; paid: number; balance: number; status: string }[];
  approved_change_orders_total: number;
  invoice_total: number;
  invoice_paid_total: number;
  invoice_balance_total: number;
  grand_total: number;
};

export const INSURANCE_STATUSES = ["not_started", "requested", "active", "expired", "not_required"] as const;
export const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "fixed_price", label: "Fixed Price" },
  { value: "open_book", label: "Open Book" },
];
