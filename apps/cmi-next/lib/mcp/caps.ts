// Per-person daily caps on high-risk AI actions (emails, texts, trash),
// set in Settings → Claude → Activity. Counted from mcp_audit_log. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { capProblem, DEFAULT_CAPS, phoenixDayStart, type CapGroup } from "./safety";

export async function loadCaps(): Promise<Record<CapGroup, number>> {
  const { data } = await getSupabaseAdmin().from("mcp_settings").select("caps").eq("id", true).maybeSingle();
  return { ...DEFAULT_CAPS, ...((data?.caps as Partial<Record<CapGroup, number>>) ?? {}) };
}

export async function saveCaps(caps: Partial<Record<CapGroup, number>>, staffId: string): Promise<Record<CapGroup, number>> {
  const next = { ...(await loadCaps()) };
  for (const k of Object.keys(DEFAULT_CAPS) as CapGroup[]) {
    const v = caps[k];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1000) next[k] = Math.round(v);
  }
  await getSupabaseAdmin().from("mcp_settings").upsert({ id: true, caps: next, updated_by: staffId, updated_at: new Date().toISOString() });
  return next;
}

export async function usedToday(staffId: string, group: CapGroup): Promise<number> {
  const { count } = await getSupabaseAdmin().from("mcp_audit_log").select("id", { count: "exact", head: true })
    .eq("staff_user_id", staffId).eq("cap_group", group).eq("success", true)
    .gte("created_at", phoenixDayStart().toISOString());
  return count ?? 0;
}

/** Throws the cap message when this person has used up today's allowance. */
export async function checkCap(staffId: string, group: CapGroup): Promise<void> {
  const [caps, used] = await Promise.all([loadCaps(), usedToday(staffId, group)]);
  const problem = capProblem(group, used, caps[group]);
  if (problem) throw new Error(problem);
}
