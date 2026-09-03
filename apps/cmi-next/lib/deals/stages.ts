// Deal stage metadata for the early sales funnel (Phase 1).
// Labels + sublabels mirror the approved workflow diagram.

import type { DealStage } from "./types";

type Tone = "info" | "accent" | "warning" | "success" | "danger" | "muted";

export type DealStageMeta = {
  stage: DealStage;
  label: string;
  sublabel: string;
  tone: Tone;
  order: number;
  // open = counts as active pipeline; terminal stages are excluded.
  open: boolean;
};

export const DEAL_STAGE_META: Record<DealStage, DealStageMeta> = {
  new_working:  { stage: "new_working",  label: "New / Working", sublabel: "Intake",        tone: "info",    order: 1, open: true },
  contacted:    { stage: "contacted",    label: "Contacted",     sublabel: "First touch",   tone: "info",    order: 2, open: true },
  qualified:    { stage: "qualified",    label: "Qualified",     sublabel: "Fit confirmed", tone: "accent",  order: 3, open: true },
  opportunity:  { stage: "opportunity",  label: "Opportunity",   sublabel: "Serious lead",  tone: "accent",  order: 4, open: true },
  proposal:     { stage: "proposal",     label: "Proposal",      sublabel: "Sent to client",tone: "accent",  order: 5, open: true },
  negotiation:  { stage: "negotiation",  label: "Negotiation",   sublabel: "Terms",         tone: "warning", order: 6, open: true },
  closed_won:   { stage: "closed_won",   label: "Closed Won",    sublabel: "To Pre-Con",    tone: "success", order: 7, open: false },
  lost_on_hold: { stage: "lost_on_hold", label: "Lost / On Hold",sublabel: "From any stage",tone: "danger",  order: 99, open: false },
};

// Ordered stages for the List view / progression reasoning. The terminal
// lost_on_hold sorts last.
export const DEAL_STAGES: DealStage[] = Object.values(DEAL_STAGE_META)
  .sort((a, b) => a.order - b.order)
  .map((m) => m.stage);

// The active-funnel stages (excludes the terminal state).
export const ACTIVE_DEAL_STAGES: DealStage[] = DEAL_STAGES.filter((s) => DEAL_STAGE_META[s].open || s === "closed_won");

export function isDealStage(value: unknown): value is DealStage {
  return typeof value === "string" && value in DEAL_STAGE_META;
}

// The early funnel is intentionally flexible: a rep may move a deal to any
// other stage (reclassification is common). We only require a lost_reason when
// moving into lost_on_hold, so loss reporting stays meaningful.
export function requiredFieldsForStage(to: DealStage): (keyof import("./types").Deal)[] {
  return to === "lost_on_hold" ? ["lost_reason"] : [];
}

export const LOST_REASONS = [
  "not_feasible",
  "outside_budget",
  "chose_another_builder",
  "cancelled",
  "on_hold_indefinitely",
  "client_unresponsive",
  "scope_not_aligned",
  "timeline_not_aligned",
  "not_ideal_project_type",
  "duplicate",
  "other",
] as const;

// Per-stage checklist items shown on the deal-detail page. Completion is tracked
// per deal in deal_checklist_progress (by `key`). `required` items are what the
// "Mark stage complete" action expects before advancing.
export type ChecklistItem = { key: string; label: string; required?: boolean };

export const DEAL_STAGE_CHECKLIST: Record<DealStage, ChecklistItem[]> = {
  new_working: [
    { key: "new_reviewed", label: "Inquiry reviewed", required: true },
    { key: "new_owner", label: "Owner assigned", required: true },
    { key: "new_contact_linked", label: "Contact record linked" },
  ],
  contacted: [
    { key: "contacted_reached", label: "Made first contact", required: true },
    { key: "contacted_channel", label: "Preferred channel noted" },
    { key: "contacted_followup", label: "Follow-up scheduled" },
  ],
  qualified: [
    { key: "qual_fit", label: "Business fit confirmed", required: true },
    { key: "qual_decision_maker", label: "Decision-maker identified", required: true },
    { key: "qual_type", label: "Job type selected", required: true },
    { key: "qual_value", label: "Estimated value entered", required: true },
    { key: "qual_close", label: "Expected close date entered", required: true },
    { key: "qual_next", label: "Next action scheduled" },
  ],
  opportunity: [
    { key: "opp_scope", label: "Scope documented", required: true },
    { key: "opp_budget", label: "Budget reviewed", required: true },
    { key: "opp_site", label: "Site visit / scan completed" },
  ],
  proposal: [
    { key: "prop_drafted", label: "Proposal drafted", required: true },
    { key: "prop_sent", label: "Proposal sent to client", required: true },
    { key: "prop_reviewed", label: "Reviewed with client" },
  ],
  negotiation: [
    { key: "nego_terms", label: "Terms discussed", required: true },
    { key: "nego_pricing", label: "Pricing agreed" },
    { key: "nego_verbal", label: "Verbal commitment" },
  ],
  closed_won: [
    { key: "won_agreement", label: "Agreement signed", required: true },
    { key: "won_precon", label: "Pre-Con record created" },
  ],
  lost_on_hold: [
    { key: "lost_reason_logged", label: "Reason recorded", required: true },
  ],
};

export const DEAL_SOURCES = [
  "website",
  "referral",
  "repeat_client",
  "google",
  "social",
  "trade_show",
  "cold_inbound",
  "business_card",
  "other",
] as const;
