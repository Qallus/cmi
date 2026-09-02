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
