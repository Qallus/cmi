// The pipeline stage machine: labels, allowed transitions, and the
// required-field rules that guard each transition.
// Source of truth: docs/features/cmi-sales-process-leads-opportunities.md §11–12.

import type { Opportunity, PipelineStage } from "./types";

type Tone = "info" | "accent" | "warning" | "success" | "danger" | "muted";

export type StageMeta = {
  stage: PipelineStage;
  label: string;
  description: string;
  tone: Tone;
  // Lifecycle order for the "happy path" (used for kanban column order and
  // forward/backward reasoning). Alternate paths get a high order so they sort last.
  order: number;
  // Whether records in this stage count toward forecasted future work.
  forecast: boolean;
  // Whether records in this stage are considered active (open) pipeline.
  open: boolean;
};

// Ordered so the happy-path stages read left-to-right; alternate/terminal
// stages come after. Every stage here carries a job number (created at the
// Opportunity stage) — leads live in the CRM and are intentionally not here.
export const STAGE_META: Record<PipelineStage, StageMeta> = {
  opportunity:             { stage: "opportunity",             label: "Opportunity",              description: "Realistic potential project. Job number created here.",            tone: "info",    order: 1, forecast: false, open: true },
  active_budget:           { stage: "active_budget",           label: "Active Budget",            description: "Actively estimating / pre-construction evaluation.",                 tone: "accent",  order: 2, forecast: false, open: true },
  pre_construction_design: { stage: "pre_construction_design", label: "Pre-Construction / Design", description: "Client is moving forward. Forecast as future work.",                tone: "accent",  order: 3, forecast: true,  open: true },
  active_project:          { stage: "active_project",          label: "Active Project",           description: "Agreement executed / committed. Construction underway.",             tone: "success", order: 4, forecast: false, open: true },
  warranty:                { stage: "warranty",                label: "Warranty",                 description: "Construction complete; in the warranty tracking period.",            tone: "warning", order: 5, forecast: false, open: true },
  closed:                  { stage: "closed",                  label: "Closed",                   description: "Warranty expired; archived but fully searchable.",                   tone: "muted",   order: 6, forecast: false, open: false },
  long_lead:               { stage: "long_lead",               label: "Long Lead",                description: "Real project, not ready. Stays in follow-up pipeline.",              tone: "warning", order: 90, forecast: false, open: true },
  not_moving_forward:      { stage: "not_moving_forward",      label: "Not Moving Forward",       description: "No longer active. Reason recorded for loss reporting.",              tone: "danger",  order: 99, forecast: false, open: false },
};

export const ALL_STAGES: PipelineStage[] = Object.values(STAGE_META)
  .sort((a, b) => a.order - b.order)
  .map((m) => m.stage);

// Allowed forward/alternate transitions (doc §12). closed → warranty is only
// permitted for an authorized admin re-opening a record; the API layer enforces
// the role check on top of this map.
export const ALLOWED_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  opportunity:             ["active_budget", "long_lead", "not_moving_forward"],
  active_budget:           ["pre_construction_design", "long_lead", "not_moving_forward"],
  pre_construction_design: ["active_project", "long_lead", "not_moving_forward"],
  active_project:          ["warranty"],
  warranty:                ["closed"],
  long_lead:               ["active_budget", "not_moving_forward"],
  not_moving_forward:      ["long_lead", "active_budget"],
  closed:                  ["warranty"], // admin reopen only (checked in the API)
};

// Transitions that require an admin/super_admin (guardrail): reopening a closed
// project back into warranty.
export function transitionRequiresAdmin(from: PipelineStage, to: PipelineStage): boolean {
  return from === "closed" && to === "warranty";
}

export function canTransition(from: PipelineStage, to: PipelineStage): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

// Required fields that must be present (on the merged record) before a record
// may ENTER the given stage. Mirrors doc §12 "transition_requirements" plus the
// alternate-path reason requirements.
const REQUIRED_FOR_STAGE: Partial<Record<PipelineStage, (keyof Opportunity)[]>> = {
  active_project: ["construction_agreement_status", "start_date", "project_manager"],
  warranty:       ["actual_completion_date", "warranty_start_date", "warranty_expiration_date"],
  closed:         ["warranty_expiration_date", "closed_date"],
  long_lead:      ["long_lead_reason", "follow_up_date"],
  not_moving_forward: ["lost_reason"],
};

// Friendly labels for the required-field error messages.
const FIELD_LABELS: Record<string, string> = {
  construction_agreement_status: "Construction agreement status",
  start_date: "Start date (or defined start window)",
  project_manager: "Project manager",
  actual_completion_date: "Actual completion date",
  warranty_start_date: "Warranty start date",
  warranty_expiration_date: "Warranty expiration date",
  closed_date: "Closed date",
  long_lead_reason: "Long-lead reason",
  follow_up_date: "Follow-up date",
  lost_reason: "Lost reason (Not Moving Forward)",
};

// The required fields the UI should prompt for when moving INTO `to`.
export function requiredFieldsForStage(to: PipelineStage): (keyof Opportunity)[] {
  return REQUIRED_FOR_STAGE[to] ?? [];
}

export type TransitionCheck = { ok: true } | { ok: false; error: string; missing: string[] };

// Validate a proposed transition against the record as it WILL be after `patch`
// is applied. Returns the list of still-missing required fields so the UI can
// prompt for exactly those.
export function validateTransition(
  current: Opportunity,
  to: PipelineStage,
  patch: Partial<Opportunity> = {},
): TransitionCheck {
  if (!canTransition(current.stage, to)) {
    return { ok: false, error: `Cannot move from "${STAGE_META[current.stage].label}" to "${STAGE_META[to].label}".`, missing: [] };
  }
  const merged = { ...current, ...patch } as Opportunity;
  const required = REQUIRED_FOR_STAGE[to] ?? [];
  const missing = required.filter((f) => {
    const v = merged[f];
    return v === null || v === undefined || v === "";
  }) as string[];
  if (missing.length) {
    return {
      ok: false,
      missing,
      error: `Moving to "${STAGE_META[to].label}" requires: ${missing.map((m) => FIELD_LABELS[m] ?? m).join(", ")}.`,
    };
  }
  return { ok: true };
}

// When a transition happens, derive side-effect field defaults so the record
// stays internally consistent (e.g. auto-fill warranty expiration from the
// start date + period, stamp lost/closed dates). Returns a patch to merge.
export function derivedTransitionPatch(
  to: PipelineStage,
  patch: Partial<Opportunity>,
  today: string,
): Partial<Opportunity> {
  const out: Partial<Opportunity> = {};
  if (to === "warranty") {
    const start = patch.warranty_start_date ?? patch.actual_completion_date ?? today;
    const months = patch.warranty_period_months ?? 24;
    if (!patch.warranty_start_date) out.warranty_start_date = start;
    if (!patch.warranty_expiration_date && start) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + months);
      out.warranty_expiration_date = d.toISOString().slice(0, 10);
    }
    out.warranty_status = patch.warranty_status ?? "active";
  }
  if (to === "closed" && !patch.closed_date) out.closed_date = today;
  if (to === "not_moving_forward" && !patch.lost_date) out.lost_date = today;
  return out;
}
