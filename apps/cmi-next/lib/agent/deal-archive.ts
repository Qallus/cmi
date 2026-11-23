// Bolt: find and restore archived Pipeline deals.
//
// Archiving takes a deal off the board but keeps everything (activities,
// tasks, stage history), so restoring is safe and runs without a
// confirmation card. Offered only to roles that can edit deals
// (canWriteDeals), and re-checked inside dispatch.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { canWriteDeals } from "@/lib/deals/roles";
import { unarchiveDeal } from "@/lib/deals/data";
import type { StaffContext } from "./types";

export const FIND_ARCHIVED_DEALS_DEF = {
  type: "function",
  function: {
    name: "find_archived_deals",
    description: "List archived Pipeline deals (newest archive first) with who archived them and when. Optional search matches the deal title or its number (e.g. \"26_048\" or \"Owen\"). Use when someone says a deal disappeared from the Pipeline or was archived by mistake.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Part of the deal title or number" },
        limit: { type: "number", description: "Max results (default 10, max 50)" },
      },
      required: [],
    },
  },
};

export const RESTORE_DEAL_DEF = {
  type: "function",
  function: {
    name: "restore_deal",
    description: "Bring an archived Pipeline deal back onto the board, at the stage it was in. Nothing was lost while it was archived. Get the id from find_archived_deals first; if several match, ask which one.",
    parameters: {
      type: "object",
      properties: { deal_id: { type: "string", description: "The archived deal's id" } },
      required: ["deal_id"],
    },
  },
};

export const dealArchiveAllowed = (ctx: StaffContext) => canWriteDeals(ctx.role);

export async function findArchivedDeals(args: { search?: unknown; limit?: unknown }) {
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
  const search = typeof args.search === "string" ? args.search.trim() : "";
  const sb = getSupabaseAdmin();
  let q = sb
    .from("deals")
    .select("id, title, job_number, stage, archived_at, archived_by")
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .limit(limit);
  if (search) {
    const term = search.replace(/[%,()]/g, " ");
    q = q.or(`title.ilike.%${term}%,job_number.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const staffIds = [...new Set(rows.map((r) => r.archived_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (staffIds.length) {
    const { data: staff } = await sb.from("staff_users").select("id, display_name").in("id", staffIds);
    for (const s of staff ?? []) names.set(s.id as string, (s.display_name as string) ?? "");
  }
  return {
    deals: rows.map((r) => ({
      id: r.id, title: r.title, number: r.job_number, stage: r.stage,
      archived_at: r.archived_at, archived_by: r.archived_by ? names.get(r.archived_by) ?? null : null,
    })),
    total: rows.length,
  };
}

export async function restoreDeal(dealId: string, ctx: StaffContext) {
  const sb = getSupabaseAdmin();
  const { data: deal } = await sb.from("deals").select("id, title, archived_at").eq("id", dealId).maybeSingle();
  if (!deal) return { error: "No deal with that id." };
  if (!deal.archived_at) return { restored: false, message: `"${deal.title}" isn't archived; it's already on the Pipeline.` };
  const d = await unarchiveDeal(dealId, { id: ctx.id });
  return { restored: true, deal: { id: d.id, title: d.title, stage: d.stage }, message: `"${d.title}" is back on the Pipeline.` };
}
