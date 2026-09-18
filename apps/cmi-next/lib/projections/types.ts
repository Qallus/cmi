// Projections types. Financial data — never send to the client portal, PMs or Bolt.
import type { MonthTotal } from "./calc";

export type ProjectionStatus = "contracted" | "preconstruction" | "likely" | "proposal" | "on_hold";
export type AllocationState = "balanced" | "under" | "over";
export type ActualsSource = "cmi_invoices" | "external";

// Job statuses included by "Add all active jobs".
export const ACTIVE_JOB_STATUSES = ["active_project", "pre_construction_design"];

export const PROJECTION_STATUS_META: Record<ProjectionStatus, { label: string; tone: "success" | "accent" | "info" | "warning" | "default" }> = {
  contracted:      { label: "Contracted",      tone: "success" },
  preconstruction: { label: "Preconstruction", tone: "accent" },
  likely:          { label: "Likely",          tone: "info" },
  proposal:        { label: "Proposal",        tone: "default" },
  on_hold:         { label: "On Hold",         tone: "warning" },
};

// DB row (public.projections).
export type Projection = {
  id: string;
  job_id: string | null;
  opportunity_id: string | null;
  deal_id: string | null;
  contact_id: string | null;
  name: string | null;
  client_name: string | null;
  revenue_override: number | null;
  status: ProjectionStatus | null;
  forecast_start: string | null;
  forecast_finish: string | null;
  pm_staff_id: string | null;
  super_staff_id: string | null;
  include: boolean;
  actuals_source: ActualsSource;
  actuals_reviewed_through: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

// One resolved grid row: projection overrides merged with live source data.
export type ProjectionRow = {
  id: string;
  job_id: string | null;
  job_number: string | null;
  job_status: string | null;
  name: string;
  client_name: string | null;
  status: ProjectionStatus;
  status_overridden: boolean;
  include: boolean;
  pms: string[];
  supers: string[];
  forecast_start: string | null;
  forecast_finish: string | null;
  // Revenue (official = source value; total = override ?? official).
  official_revenue: number | null;
  total_revenue: number;
  billed_to_date: number;
  remaining: number;
  future_projected: number;
  unallocated: number;
  allocation: AllocationState;
  actuals_source: ActualsSource;
  has_actuals: boolean;
  months: Record<string, { projected: number; actual: number }>;
  window_projected: number;
  beyond: Record<string, number>;
  warnings: string[];
};

export type ProjectionSummary = {
  projected12: number;
  actual12: number;
  varianceToDate: number | null;
  remainingBacklog: number;
  contractedBacklog: number;
  potentialBacklog: number;
  beyondBacklog: number;
  activeProjects: number;
  startingSoon: number;
  endingSoon: number;
};

export type ProjectionBoard = {
  window: string[];
  currentMonth: string;
  rows: ProjectionRow[];
  totals: MonthTotal[];
  beyondTotals: Record<string, number>;
  summary: ProjectionSummary;
  anyActuals: boolean;
};

export type AddableJob = {
  id: string;
  job_name: string;
  job_number: string | null;
  status: string;
  contract_price: number | null;
  projected_start_date: string | null;
  projected_completion_date: string | null;
};
