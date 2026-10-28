// Trade → CMI cost code. The sub never sees the code; it rides along on
// reports, exports and bid packages. Rows live in trade_cost_codes; every
// trade on the form shows up here even before it has a code.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { TRADES } from "./form";

export type TradeCostCode = { trade: string; cost_code: string | null; label: string | null; active: boolean };

export async function loadCostCodes(): Promise<TradeCostCode[]> {
  const { data } = await getSupabaseAdmin().from("trade_cost_codes").select("trade, cost_code, label, active");
  const byTrade = new Map((data ?? []).map((r) => [r.trade as string, r as TradeCostCode]));
  const rows: TradeCostCode[] = TRADES.map((t) => byTrade.get(t) ?? { trade: t, cost_code: null, label: null, active: true });
  // Codes for trades no longer on the form stay visible so nothing is lost.
  for (const r of byTrade.values()) if (!(TRADES as readonly string[]).includes(r.trade)) rows.push(r);
  return rows;
}

export async function saveCostCodes(rows: { trade: string; cost_code: string | null; label?: string | null }[]): Promise<void> {
  const clean = rows
    .filter((r) => typeof r.trade === "string" && r.trade.trim())
    .map((r, i) => ({ trade: r.trade.trim(), cost_code: r.cost_code?.trim() || null, label: r.label?.trim() || null, sort_order: i, updated_at: new Date().toISOString() }));
  if (!clean.length) return;
  const { error } = await getSupabaseAdmin().from("trade_cost_codes").upsert(clean, { onConflict: "trade" });
  if (error) throw new Error(error.message);
}

/** "Framing → 06-100" lookups for exports. */
export async function costCodeMap(): Promise<Map<string, string>> {
  return new Map((await loadCostCodes()).filter((r) => r.cost_code).map((r) => [r.trade, r.cost_code as string]));
}
