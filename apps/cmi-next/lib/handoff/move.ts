// Moving a project back one phase (one home per project, lib/handoff/home.ts).
//   Jobs → Pre-Con:      the Job is archived (everything kept) and its Pre-Con
//                        record comes back at Pre-Construction / Design.
//   Pre-Con → Pipeline:  its deal goes back to a Pipeline stage and the Pre-Con
//                        record is archived (kept, with its number).
// Moving forward again restores the same records (convertOpportunityToJob,
// deals changeStage), so nothing is made twice.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { archiveJob } from "@/lib/jobs/data";
import { createOpportunity, getOpportunity, setOpportunityArchived, transitionStage, notePreconMove, liveJobOppIds } from "@/lib/pipeline/data";
import { changeStage, createDeal } from "@/lib/deals/data";
import { DEAL_STAGE_META } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/deals/types";

type Actor = { name?: string | null; id?: string | null };

export class MoveError extends Error {
  status: number;
  constructor(message: string, status = 422) { super(message); this.status = status; }
}

/** "26_012_26_027_Lindquist Residence" → "26_027_Lindquist Residence" (the Job's own YY_### dropped). */
function preconNameFromJob(jobName: string | null, leadNumber: string | null): string {
  const n = (jobName ?? "").trim();
  if (leadNumber && n.includes(leadNumber)) return n.slice(n.indexOf(leadNumber));
  return n.replace(/^\d{2}_\d{3}_/, "") || "Project";
}

/** Jobs → Pre-Con. Returns the Pre-Con record's id. */
export async function moveJobBackToPrecon(jobId: string, actor?: Actor, opts: { canReopen?: boolean } = {}): Promise<{ opportunityId: string }> {
  const sb = getSupabaseAdmin();
  const { data: job } = await sb.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) throw new MoveError("Job not found.", 404);
  if (job.archived_at) throw new MoveError("This job is already archived.", 409);

  let oppId = (job.related_opportunity_id as string | null) ?? null;
  const opp = oppId ? await getOpportunity(oppId) : null;
  if (!opp) {
    // A Job made by hand has no Pre-Con record: make one from it and link them.
    const { data: primary } = await sb.from("job_contacts").select("contact_id").eq("job_id", jobId).eq("is_primary", true).limit(1).maybeSingle();
    const lead = (job.lead_number as string | null) ?? null;
    const made = await createOpportunity({
      opportunity_name: preconNameFromJob(job.job_name as string | null, lead),
      contact_id: (primary?.contact_id as string | undefined) ?? (job.related_lead_id as string | null) ?? null,
      project_address: (job.street_address as string | null) ?? null, city: (job.city as string | null) ?? null,
      state: (job.state as string | null) ?? null, zip_code: (job.zip_code as string | null) ?? null,
      estimated_project_value: (job.contract_price as number | null) ?? null,
      project_manager: (job.project_manager as string | null) ?? null,
      stage: "pre_construction_design",
    } as never, actor, lead && /^\d{2}_\d{3}$/.test(lead) ? lead : null);
    oppId = made.id;
    await sb.from("jobs").update({ related_opportunity_id: oppId }).eq("id", jobId);
  }

  // The Job leaves Jobs first, so the Pre-Con record isn't hidden behind it.
  await archiveJob(jobId, actor);
  await sb.from("job_activity_logs").insert({ job_id: jobId, action: "moved_back_to_precon", detail: "Moved back to Pre-Con (archived; restored if it moves forward again)", actor: actor?.name ?? null, actor_id: actor?.id ?? null });

  if (opp) {
    if (opp.archived_at) await setOpportunityArchived(opp.id, false);
    if (opp.stage !== "pre_construction_design") {
      await transitionStage(opp.id, "pre_construction_design", {}, actor, "Moved back from Jobs", { manual: true, canReopen: opts.canReopen ?? true });
    } else {
      await notePreconMove(opp.id, opp.job_number, opp.stage, opp.stage, actor, "Moved back from Jobs");
    }
  }
  return { opportunityId: oppId! };
}

/** Pre-Con → Pipeline, to `stage`. Returns the deal's id. */
export async function movePreconBackToPipeline(opportunityId: string, stage: DealStage, actor?: Actor): Promise<{ dealId: string }> {
  if (stage === "closed_won") throw new MoveError("Pick a Pipeline stage before Closed Won.", 400);
  if (!DEAL_STAGE_META[stage]) throw new MoveError("Unknown Pipeline stage.", 400);
  const opp = await getOpportunity(opportunityId);
  if (!opp) throw new MoveError("Pre-Con record not found.", 404);
  if ((await liveJobOppIds()).has(opp.id)) throw new MoveError("This project is in Jobs. Move it back to Pre-Con first.", 409);

  const sb = getSupabaseAdmin();
  const { data: deals } = await sb.from("deals").select("id, stage").eq("opportunity_id", opp.id).order("updated_at", { ascending: false }).limit(1);
  const deal = deals?.[0];
  if (deal) {
    // changeStage archives the Pre-Con record when a won deal leaves Closed Won.
    if (deal.stage === stage) {
      await setOpportunityArchived(opp.id, true);
      await notePreconMove(opp.id, opp.job_number, opp.stage, opp.stage, actor, `Moved back to the Pipeline (${DEAL_STAGE_META[stage].label})`);
    } else {
      await changeStage(deal.id as string, stage, {}, actor, "Moved back from Pre-Con");
      if (deal.stage !== "closed_won") {
        await setOpportunityArchived(opp.id, true);
        await notePreconMove(opp.id, opp.job_number, opp.stage, opp.stage, actor, `Moved back to the Pipeline (${DEAL_STAGE_META[stage].label})`);
      }
    }
    await sb.from("deals").update({ archived_at: null }).eq("id", deal.id);
    return { dealId: deal.id as string };
  }

  // A Pre-Con record made without a deal: make its deal, keeping the same number.
  const made = await createDeal({
    title: opp.opportunity_name, contact_id: opp.contact_id ?? null, estimated_value: opp.estimated_project_value ?? null,
    owner_id: opp.assigned_owner_id ?? null, notes: opp.notes ?? null, source: opp.source ?? null, stage,
  } as never, actor);
  await sb.from("deals").update({ opportunity_id: opp.id, ...(opp.job_number ? { job_number: opp.job_number } : {}) }).eq("id", made.id);
  await setOpportunityArchived(opp.id, true);
  await notePreconMove(opp.id, opp.job_number, opp.stage, opp.stage, actor, `Moved back to the Pipeline (${DEAL_STAGE_META[stage].label})`);
  return { dealId: made.id };
}
