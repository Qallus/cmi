// One home per project: a project lives in exactly one of the three areas.
//   Pipeline (deals)  →  Pre-Con (pipeline_opportunities)  →  Jobs (jobs)
// Moving forward takes it out of the earlier area; it can be moved back one
// phase. The links: deals.opportunity_id → the Pre-Con record;
// jobs.related_opportunity_id → the Pre-Con record. Pure, so it's tested.

export type Area = "pipeline" | "precon" | "jobs";
export const AREA_LABEL: Record<Area, string> = { pipeline: "Pipeline", precon: "Pre-Con", jobs: "Jobs" };

/** Pre-Con stages that are really Job phases: moving a Pre-Con record into one hands it to Jobs. */
export const JOB_PHASE_STAGES = ["active_project", "warranty", "closed"] as const;
export const isJobPhaseStage = (stage: string | null | undefined) => (JOB_PHASE_STAGES as readonly string[]).includes(stage ?? "");

/** A deal has left the Pipeline once it's Closed Won (it's in Pre-Con or Jobs). */
export function dealMovedOn(deal: { stage: string }): boolean {
  return deal.stage === "closed_won";
}

/** A Pre-Con record has left Pre-Con once a live (not archived) Job links to it. */
export function preconMovedOn(opportunityId: string, liveJobOppIds: ReadonlySet<string>): boolean {
  return liveJobOppIds.has(opportunityId);
}

/** Where a project lives now, from whichever of its records exist and are live. */
export function homeOf(p: {
  deal?: { stage: string; archived_at?: string | null } | null;
  precon?: { archived_at?: string | null } | null;
  job?: { archived_at?: string | null } | null;
}): Area | null {
  if (p.job && !p.job.archived_at) return "jobs";
  if (p.precon && !p.precon.archived_at) return "precon";
  if (p.deal && !p.deal.archived_at) return "pipeline";
  return null;
}

/** The ids of Pre-Con records a live Job links to. */
export function liveJobOppIdSet(jobs: { related_opportunity_id: string | null; archived_at?: string | null }[]): Set<string> {
  return new Set(jobs.filter((j) => j.related_opportunity_id && !j.archived_at).map((j) => j.related_opportunity_id as string));
}
