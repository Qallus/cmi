// CMI's insurance minimums, edited in Trade Partners → Setup → Insurance
// minimums: a default set plus overrides per partner type and per trade
// (resolution rules in ./coverage resolveMinimums). Read by the application
// form, the Become a Trade Partner page and Claude's certificate check.
// Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  COVERAGE_KEYS, DEFAULT_MINIMUMS_SETTINGS, resolveMinimums,
  type CoverageKey, type MinimumLine, type MinimumsOverride, type MinimumsSettings,
} from "./coverage";

export { resolveMinimums, type MinimumsSettings, type CoverageKey } from "./coverage";

const KEY = "insurance_minimums";

export async function loadMinimumsSettings(): Promise<MinimumsSettings> {
  try {
    const { data } = await getSupabaseAdmin().from("app_settings").select("value").eq("key", KEY).maybeSingle();
    return normalize(data?.value) ?? DEFAULT_MINIMUMS_SETTINGS;
  } catch {
    return DEFAULT_MINIMUMS_SETTINGS;
  }
}

export async function saveMinimumsSettings(input: unknown, staffId: string): Promise<MinimumsSettings> {
  const value = normalize(input);
  if (!value) throw new Error("Those minimums aren't valid.");
  const { error } = await getSupabaseAdmin().from("app_settings")
    .upsert({ key: KEY, value, updated_by: staffId, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return value;
}

/** The minimums that apply to one company (by its partner type and trades). */
export async function minimumsForCompany(companyId: string | null | undefined) {
  const settings = await loadMinimumsSettings();
  if (!companyId) return resolveMinimums(settings);
  const { data } = await getSupabaseAdmin().from("companies").select("partner_type, trades").eq("id", companyId).maybeSingle();
  return resolveMinimums(settings, { partnerType: data?.partner_type as string | null, trades: data?.trades as string[] | null });
}

// ─── Validation: only well-formed lines and whole-dollar amounts survive ────

const money = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(/[$,\s]/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n) : null;
};

function line(v: unknown): MinimumLine | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.required === false) return { required: false };
  return { required: true, perOccurrence: money(o.perOccurrence), aggregate: money(o.aggregate) };
}

function override(v: unknown): MinimumsOverride | null {
  if (!v || typeof v !== "object") return null;
  const out: MinimumsOverride = {};
  for (const k of COVERAGE_KEYS) {
    const l = line((v as Record<string, unknown>)[k]);
    if (l) out[k] = l;
  }
  return Object.keys(out).length ? out : null;
}

function normalize(v: unknown): MinimumsSettings | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const def = {} as Record<CoverageKey, MinimumLine>;
  for (const k of COVERAGE_KEYS) def[k] = line((o.default as Record<string, unknown> | undefined)?.[k]) ?? DEFAULT_MINIMUMS_SETTINGS.default[k];
  const map = (m: unknown) => {
    const out: Record<string, MinimumsOverride> = {};
    for (const [name, ov] of Object.entries((m as Record<string, unknown>) ?? {})) {
      const n = name.trim().slice(0, 80);
      const parsed = override(ov);
      if (n && parsed) out[n] = parsed;
    }
    return out;
  };
  return { default: def, byPartnerType: map(o.byPartnerType), byTrade: map(o.byTrade) };
}
