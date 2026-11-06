// Change-order schedule extensions (Phase 2 Step 4, Spec R2 §7.3). A change
// order can carry schedule days (working days). When it's approved, the job's
// open contract milestones dated on or after the approval move by that many
// working days on their schedule's calendar, and one schedule_extensions row
// records it (once per change order, so re-saving an approved CO does nothing).
// The PM is then offered a new baseline. Server only; behind schedule_progress.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isFeatureEnabled } from "@/lib/flags";
import { addW, dayNum, isoOf } from "./calendar.ts";
import { calendarFor } from "./engine-core.ts";
import { PROGRESS_FLAG, loadNetwork } from "./engine";
import { logActivity } from "./data";

type Actor = { id?: string | null; name?: string | null };
export type ExtensionResult = { days: number; moved: { item_id: string; title: string; from: string; to: string }[]; scheduleIds: string[] };

/** Apply an approved change order's schedule days, once. Null when there's nothing to do. */
export async function applyChangeOrderExtension(co: { id: string; job_id: string; co_number: string | null; title: string; schedule_days?: number | null; approved_date?: string | null }, actor?: Actor): Promise<ExtensionResult | null> {
  const days = Math.round(Number(co.schedule_days) || 0);
  if (!days || !(await isFeatureEnabled(PROGRESS_FLAG))) return null;
  const sb = getSupabaseAdmin();
  // Claim the change order first: the unique index makes a second approval a no-op.
  const { data: claim, error: claimErr } = await sb.from("schedule_extensions").insert({
    job_id: co.job_id, change_order_id: co.id, days, reason: `${co.co_number ? `${co.co_number}: ` : ""}${co.title}`.slice(0, 300), applied_by: actor?.id ?? null,
  }).select("id").single();
  if (claimErr?.code === "23505") return null;
  if (claimErr || !claim) throw new Error(claimErr?.message ?? "Couldn't record the extension.");

  const { data: scheds } = await sb.from("job_schedules").select("id").eq("job_id", co.job_id).neq("status", "archived");
  const from = co.approved_date ?? new Date().toISOString().slice(0, 10);
  const moved: ExtensionResult["moved"] = [];
  const touched = new Set<string>();
  if (scheds?.length) {
    // One network covers every schedule on the job (each keeps its own calendar).
    const net = await loadNetwork(scheds[0].id);
    const byId = new Map(net.schedules.map((s) => [s.id, s]));
    const { data: items } = await sb.from("schedule_items").select("id, schedule_id, title, status, contract_date")
      .eq("job_id", co.job_id).eq("milestone_type", "contract").not("contract_date", "is", null).gte("contract_date", from);
    for (const i of items ?? []) {
      if (i.status === "complete" || i.status === "cancelled") continue;
      const s = byId.get(i.schedule_id);
      if (!s) continue;
      const to = isoOf(addW(calendarFor(net, s), dayNum(i.contract_date), days));
      const { error } = await sb.from("schedule_items").update({ contract_date: to, updated_at: new Date().toISOString() }).eq("id", i.id);
      if (error) continue;
      moved.push({ item_id: i.id, title: i.title, from: i.contract_date, to });
      touched.add(i.schedule_id);
      await logActivity({ jobId: co.job_id, scheduleId: i.schedule_id, itemId: i.id, action: "contract_extended", detail: { title: i.title, from: i.contract_date, to, days, change_order: co.co_number ?? co.title }, actor: actor as never });
    }
  }
  await sb.from("schedule_extensions").update({ moved }).eq("id", claim.id);
  return { days, moved, scheduleIds: [...touched] };
}

/** The job's extensions, newest first (for time-extension requests). */
export async function listExtensions(jobId: string) {
  const { data } = await getSupabaseAdmin().from("schedule_extensions").select("*").eq("job_id", jobId).order("created_at", { ascending: false });
  return data ?? [];
}
