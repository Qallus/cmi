// Keep anticipated projections attached as work moves down the funnel:
// Deal → (Closed Won) → Pre-Con opportunity → (Promote to Job) → Job.
// Called from the deal / job data layers. These only ever write the
// projections row, and they never throw — a relink must not block the
// source workflow.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { logActivity } from "./data";

type Actor = { id?: string | null; name?: string | null } | undefined;
const asActor = (a: Actor) => (a?.id ? { id: a.id, name: a.name ?? null } : undefined);

export async function linkDealToOpportunity(dealId: string, opportunityId: string, actor?: Actor): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("projections").update({ opportunity_id: opportunityId, updated_at: new Date().toISOString() })
      .eq("deal_id", dealId).is("opportunity_id", null).is("archived_at", null).select("id");
    for (const p of data ?? []) {
      await logActivity({ projectionId: p.id as string, action: "linked", detail: { to: "opportunity", opportunity_id: opportunityId }, actor: asActor(actor) });
    }
  } catch { /* never block Closed Won */ }
}

// On Promote to Job, the anticipated projection becomes the job's projection.
// Revenue and status then come from the job (their anticipated overrides are
// cleared); forecast dates and months are kept so history carries over.
export async function linkOpportunityToJob(opportunityId: string, jobId: string, jobContractPrice: number | null, actor?: Actor): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    const { data: already } = await sb.from("projections").select("id").eq("job_id", jobId).limit(1);
    if (already?.length) return; // the job was added directly; leave both alone
    const { data: deals } = await sb.from("deals").select("id").eq("opportunity_id", opportunityId);
    const dealIds = (deals ?? []).map((d) => d.id as string);
    let query = sb.from("projections").select("id,revenue_override,status").is("job_id", null).is("archived_at", null);
    query = dealIds.length ? query.or(`opportunity_id.eq.${opportunityId},deal_id.in.(${dealIds.join(",")})`) : query.eq("opportunity_id", opportunityId);
    const { data: candidates } = await query.order("created_at").limit(1);
    const p = candidates?.[0];
    if (!p) return;
    const update: Record<string, unknown> = { job_id: jobId, opportunity_id: opportunityId, status: null, updated_at: new Date().toISOString() };
    if (jobContractPrice !== null && jobContractPrice !== undefined) update.revenue_override = null;
    const { error } = await sb.from("projections").update(update).eq("id", p.id);
    if (error) return;
    await logActivity({
      projectionId: p.id as string, action: "linked", actor: asActor(actor),
      detail: { to: "job", job_id: jobId, before: { status: p.status, revenue_override: p.revenue_override } },
    });
  } catch { /* never block Promote to Job */ }
}
