// Pipeline reporting calculations (pure functions over loaded records).
// Powers the dashboard reporting strip and the /api/pipeline/reporting endpoint.
import { STAGE_META, type StageMeta } from "./stages";
import type { Opportunity, PipelineStage, StageHistoryRow } from "./types";

export type PipelineReport = {
  pipeline_summary: {
    total_opportunities: number;
    by_stage: Record<PipelineStage, number>;
    active_budget_count: number;
    pre_construction_count: number;
    active_project_count: number;
    warranty_count: number;
    closed_project_count: number;
    long_lead_count: number;
    not_moving_forward_count: number;
    estimated_pipeline_value: number;   // open opportunities' estimated value
    forecasted_project_value: number;   // pre-construction/design forecast value
    active_contract_value: number;      // active projects' contract value
  };
  conversion_rates: {
    // Each is a percent (0–100) of records that reached the "from" stage and
    // went on to reach the "to" stage (based on stage history).
    lead_to_opportunity_percent: number | null; // null when lead count unknown
    opportunity_to_active_budget_percent: number;
    active_budget_to_pre_construction_percent: number;
    pre_construction_to_active_project_percent: number;
  };
  loss_analysis: Record<string, number>; // lost_reason -> count
  long_lead_followups: {
    id: string; job_number: string | null; opportunity_name: string;
    follow_up_date: string | null; overdue: boolean; owner: string | null;
  }[];
};

const num = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

// Reconstruct the set of stages each opportunity has ever ENTERED from history.
// Records always have a baseline history row from createOpportunity, but we also
// union the current stage defensively.
function stagesReachedByOpp(opps: Opportunity[], history: StageHistoryRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const opp of opps) map.set(opp.id, new Set([opp.stage]));
  for (const h of history) {
    if (!map.has(h.opportunity_id)) map.set(h.opportunity_id, new Set());
    map.get(h.opportunity_id)!.add(h.to_stage);
  }
  return map;
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10; // one decimal place
}

export function computeReport(
  opps: Opportunity[],
  history: StageHistoryRow[],
  leadCount?: number,
): PipelineReport {
  const byStage = Object.fromEntries(
    (Object.keys(STAGE_META) as PipelineStage[]).map((s) => [s, 0]),
  ) as Record<PipelineStage, number>;
  for (const o of opps) byStage[o.stage] = (byStage[o.stage] ?? 0) + 1;

  const reached = stagesReachedByOpp(opps, history);
  const countReached = (stage: PipelineStage) =>
    [...reached.values()].filter((set) => set.has(stage)).length;

  const reachedOpportunity = countReached("opportunity");
  const reachedActiveBudget = countReached("active_budget");
  const reachedPreCon = countReached("pre_construction_design");
  const reachedActiveProject = countReached("active_project");

  const today = new Date().toISOString().slice(0, 10);

  const loss_analysis: Record<string, number> = {};
  for (const o of opps) {
    if (o.stage === "not_moving_forward") {
      const key = o.lost_reason ?? "unspecified";
      loss_analysis[key] = (loss_analysis[key] ?? 0) + 1;
    }
  }

  const long_lead_followups = opps
    .filter((o) => o.stage === "long_lead")
    .map((o) => ({
      id: o.id,
      job_number: o.job_number,
      opportunity_name: o.opportunity_name,
      follow_up_date: o.follow_up_date,
      overdue: !!o.follow_up_date && o.follow_up_date < today,
      owner: o.follow_up_owner ?? o.assigned_owner ?? null,
    }))
    .sort((a, b) => (a.follow_up_date ?? "9999").localeCompare(b.follow_up_date ?? "9999"));

  const isOpen = (o: Opportunity) => (STAGE_META[o.stage] as StageMeta).open;

  return {
    pipeline_summary: {
      total_opportunities: opps.length,
      by_stage: byStage,
      active_budget_count: byStage.active_budget,
      pre_construction_count: byStage.pre_construction_design,
      active_project_count: byStage.active_project,
      warranty_count: byStage.warranty,
      closed_project_count: byStage.closed,
      long_lead_count: byStage.long_lead,
      not_moving_forward_count: byStage.not_moving_forward,
      estimated_pipeline_value: opps.filter(isOpen).reduce((s, o) => s + num(o.estimated_project_value), 0),
      forecasted_project_value: opps
        .filter((o) => o.stage === "pre_construction_design")
        .reduce((s, o) => s + num(o.projected_construction_value ?? o.estimated_project_value), 0),
      active_contract_value: opps
        .filter((o) => o.stage === "active_project")
        .reduce((s, o) => s + num(o.contract_value ?? o.current_project_value), 0),
    },
    conversion_rates: {
      lead_to_opportunity_percent:
        typeof leadCount === "number" && leadCount > 0
          ? pct(reachedOpportunity, leadCount + reachedOpportunity)
          : null,
      opportunity_to_active_budget_percent: pct(reachedActiveBudget, reachedOpportunity),
      active_budget_to_pre_construction_percent: pct(reachedPreCon, reachedActiveBudget),
      pre_construction_to_active_project_percent: pct(reachedActiveProject, reachedPreCon),
    },
    loss_analysis,
    long_lead_followups,
  };
}
