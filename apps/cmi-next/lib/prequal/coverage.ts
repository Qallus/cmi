// Coverage checks and the reminder schedule (trade partner brief §7.2, §8).
// Pure (no I/O, no imports) so lib/prequal/coverage.test.mjs runs it directly.
// Callers pass the minimums that apply to one partner (resolveMinimums below).
type Minimum = { perOccurrence?: number | null; aggregate?: number | null; required?: boolean };
export type Minimums = Record<"gl" | "auto" | "wc" | "umbrella", Minimum>;
export type CoverageKey = keyof Minimums;
export const COVERAGE_KEYS: CoverageKey[] = ["gl", "auto", "wc", "umbrella"];
export const COVERAGE_LABEL: Record<CoverageKey, string> = {
  gl: "General liability", auto: "Commercial auto", wc: "Workers' compensation", umbrella: "Umbrella / excess liability",
};

// ─── Minimums by category (Trade Partners → Setup → Insurance minimums) ─────
// A default set, plus overrides for a partner type ("Consultant") or a trade
// ("Roofing"). An override replaces the default for the lines it sets — it may
// raise, lower or switch a line off. When several overrides apply to one
// partner (their type and each of their trades), the strictest wins: a line is
// required if any of them requires it, at the highest amount among them.

/** One coverage line's rule. `required: false` = not required for this category. */
export type MinimumLine = { required: boolean; perOccurrence?: number | null; aggregate?: number | null };
export type MinimumsOverride = Partial<Record<CoverageKey, MinimumLine>>;
export type MinimumsSettings = {
  default: Record<CoverageKey, MinimumLine>;
  byPartnerType: Record<string, MinimumsOverride>;
  byTrade: Record<string, MinimumsOverride>;
};
export type ResolvedLine = MinimumLine & { label: string; text: string; source: string };

/** What CMI uses until Setup is saved: $2,000,000 general liability; the rest off. */
export const DEFAULT_MINIMUMS_SETTINGS: MinimumsSettings = {
  default: {
    gl: { required: true, perOccurrence: 2_000_000, aggregate: 2_000_000 },
    auto: { required: false },
    wc: { required: false },
    umbrella: { required: false },
  },
  byPartnerType: {},
  byTrade: {},
};

const usd0 = (n: number) => `$${n.toLocaleString("en-US")}`;

/** "$2,000,000 per occurrence / $2,000,000 aggregate", in the words of each line. */
export function minimumText(key: CoverageKey, line: MinimumLine): string {
  if (!line.required) return "Not required";
  const occ = line.perOccurrence ?? null, agg = line.aggregate ?? null;
  if (key === "wc") return occ ? `Arizona statutory limits, with ${usd0(occ)} employer's liability` : "Arizona statutory limits";
  if (key === "auto") return occ ? `${usd0(occ)} combined single limit` : "Required";
  if (occ && agg && occ !== agg) return `${usd0(occ)} per occurrence / ${usd0(agg)} aggregate`;
  if (occ && agg) return `${usd0(occ)} per occurrence and aggregate`;
  return occ ? `${usd0(occ)} per occurrence` : agg ? `${usd0(agg)} aggregate` : "Required";
}

/** The minimums for one partner, from their partner type and trades. */
export function resolveMinimums(
  settings: MinimumsSettings | null | undefined,
  who: { partnerType?: string | null; trades?: readonly string[] | null } = {},
): Record<CoverageKey, ResolvedLine> {
  const st = settings ?? DEFAULT_MINIMUMS_SETTINGS;
  const applicable: { source: string; o: MinimumsOverride }[] = [];
  if (who.partnerType && st.byPartnerType?.[who.partnerType]) applicable.push({ source: who.partnerType, o: st.byPartnerType[who.partnerType] });
  for (const t of who.trades ?? []) if (st.byTrade?.[t]) applicable.push({ source: t, o: st.byTrade[t] });

  const out = {} as Record<CoverageKey, ResolvedLine>;
  for (const key of COVERAGE_KEYS) {
    const base = st.default?.[key] ?? DEFAULT_MINIMUMS_SETTINGS.default[key];
    const rules = applicable.filter((a) => a.o[key]).map((a) => ({ source: a.source, line: a.o[key]! }));
    let line: MinimumLine, source = "Default";
    if (!rules.length) line = base;
    else {
      const req = rules.filter((r) => r.line.required);
      if (!req.length) { line = { required: false }; source = rules.map((r) => r.source).join(", "); }
      else {
        const max = (k: "perOccurrence" | "aggregate") => {
          const v = req.map((r) => r.line[k] ?? null).filter((n): n is number => typeof n === "number");
          return v.length ? Math.max(...v) : null;
        };
        line = { required: true, perOccurrence: max("perOccurrence"), aggregate: max("aggregate") };
        source = req.map((r) => r.source).join(", ");
      }
    }
    out[key] = { ...line, label: COVERAGE_LABEL[key], text: minimumText(key, line), source };
  }
  return out;
}

export type CoverageLine = "general_liability" | "auto" | "workers_comp" | "umbrella" | "professional" | "other";

/** One coverage line as read off a certificate. Money in whole dollars. */
export type Coverage = {
  line: CoverageLine;
  carrier: string | null;
  policy_number: string | null;
  effective_date: string | null;   // YYYY-MM-DD
  expiration_date: string | null;  // YYYY-MM-DD
  each_occurrence: number | null;
  aggregate: number | null;
  combined_single_limit: number | null;
  employers_liability_each_accident: number | null;
  meets_minimum?: boolean | null;
};

export const LINE_LABEL: Record<CoverageLine, string> = {
  general_liability: "General liability", auto: "Commercial auto", workers_comp: "Workers' compensation",
  umbrella: "Umbrella / excess", professional: "Professional liability", other: "Other coverage",
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * Compare each line with CMI's minimums. Returns the lines annotated with
 * meets_minimum, plus human-readable flags for anything short or missing.
 * Workers' comp is checked on employer's liability (the statutory part has no
 * dollar figure). A missing line is a flag; an unreadable limit is a flag too,
 * because "we couldn't tell" needs a person to look.
 */
export function checkMinimums(coverages: Coverage[], INSURANCE_MINIMUMS: Minimums): { coverages: Coverage[]; flags: string[] } {
  const flags: string[] = [];
  // A line that isn't required for this partner is never flagged.
  const req = (k: CoverageKey) => INSURANCE_MINIMUMS[k]?.required !== false;
  const out = coverages.map((c) => {
    let meets: boolean | null = null;
    if (c.line === "general_liability" && req("gl")) {
      const occ = c.each_occurrence, agg = c.aggregate;
      const minOcc = INSURANCE_MINIMUMS.gl.perOccurrence ?? 0, minAgg = INSURANCE_MINIMUMS.gl.aggregate ?? 0;
      if (occ == null || agg == null) flags.push("General liability limits couldn't be read. Check the certificate.");
      else {
        meets = occ >= minOcc && agg >= minAgg;
        if (occ < minOcc) flags.push(`General liability ${money(occ)} per occurrence is below the ${money(minOcc)} minimum.`);
        if (agg < minAgg) flags.push(`General liability ${money(agg)} aggregate is below the ${money(minAgg)} minimum.`);
      }
    } else if (c.line === "auto" && req("auto")) {
      const csl = c.combined_single_limit ?? c.each_occurrence;
      const min = INSURANCE_MINIMUMS.auto.perOccurrence ?? 0;
      if (csl == null) flags.push("Commercial auto limit couldn't be read. Check the certificate.");
      else { meets = csl >= min; if (!meets) flags.push(`Commercial auto ${money(csl)} is below the ${money(min)} minimum.`); }
    } else if (c.line === "workers_comp" && req("wc")) {
      const el = c.employers_liability_each_accident;
      const min = INSURANCE_MINIMUMS.wc.perOccurrence ?? 0;
      if (el == null) flags.push("Workers' comp employer's liability couldn't be read. Check the certificate.");
      else { meets = el >= min; if (!meets) flags.push(`Employer's liability ${money(el)} is below the ${money(min)} minimum.`); }
    } else if (c.line === "umbrella" && req("umbrella")) {
      const lim = c.each_occurrence ?? c.aggregate;
      const min = INSURANCE_MINIMUMS.umbrella.perOccurrence ?? 0;
      if (lim != null) { meets = lim >= min; if (!meets) flags.push(`Umbrella ${money(lim)} is below the ${money(min)} minimum.`); }
    }
    return { ...c, meets_minimum: meets };
  });

  const has = (l: CoverageLine) => out.some((c) => c.line === l);
  if (req("gl") && !has("general_liability")) flags.push("No general liability coverage on the certificate.");
  if (req("wc") && !has("workers_comp")) flags.push("No workers' compensation on the certificate. Ask for it, or a sole-proprietor waiver.");
  if (req("auto") && !has("auto")) flags.push("No commercial auto coverage on the certificate.");
  if (INSURANCE_MINIMUMS.umbrella?.required === true && !has("umbrella")) flags.push("No umbrella / excess coverage on the certificate.");
  return { coverages: out, flags };
}

/** The date the document stops being good: the earliest expiration among its lines. */
export function earliestExpiration(coverages: Coverage[]): string | null {
  const dates = coverages.map((c) => c.expiration_date).filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d));
  return dates.length ? dates.sort()[0] : null;
}

export type ReminderStage =
  | { kind: "notice"; bucket: string; urgent: boolean }   // email the sub (urgent = CC the office)
  | { kind: "expired" }                                  // stop emailing; tell the office once
  | null;                                                // nothing due

/**
 * Brief §8: first notice 45 days out, weekly after that, escalated (CC Yovana)
 * in the last 7 days, and nothing automatic once it has expired. The runner
 * goes daily; each bucket sends once, so a week's worth of days shares one.
 */
export function reminderStage(daysLeft: number): ReminderStage {
  if (daysLeft > 45) return null;
  if (daysLeft < 0) return { kind: "expired" };
  if (daysLeft <= 7) return { kind: "notice", bucket: "final", urgent: true };
  // Days 45–8 fall into weekly buckets (w7 … w1); each bucket sends once.
  return { kind: "notice", bucket: `w${Math.ceil((daysLeft - 1) / 7)}`, urgent: false };
}

/** Statuses where a partner can be given work, so a gap is a red flag (brief §7.2). */
const WORKING_STATUSES = new Set(["qualified", "approved", "preferred"]);

export type FlagDoc = { doc_type: string; status: string; expires_on: string | null; has_file: boolean; ai_flags?: string[] | null };

/**
 * Red flags for a company record: after approval the W-9 and COI are
 * mandatory, nothing may be expired, and a certificate below CMI's minimums
 * is flagged. Applicants and prospects get none — they're still in review.
 */
export function redFlags(qualificationStatus: string | null, docs: FlagDoc[], today = new Date().toISOString().slice(0, 10)): string[] {
  if (!WORKING_STATUSES.has(qualificationStatus ?? "")) return [];
  const flags: string[] = [];
  const onFile = (types: string[]) => docs.some((d) => types.includes(d.doc_type) && d.has_file && d.status !== "rejected");
  const expired = (types: string[]) => docs.some((d) => types.includes(d.doc_type) && (d.status === "expired" || (!!d.expires_on && d.expires_on < today)));
  if (!onFile(["w9"])) flags.push("No W-9");
  if (!onFile(["coi", "gl"])) flags.push("No COI");
  else if (expired(["coi", "gl", "wc", "auto"])) flags.push("Insurance expired");
  if (expired(["license"])) flags.push("License expired");
  if (docs.some((d) => (d.ai_flags ?? []).some((f) => / below the /.test(f)))) flags.push("Coverage below minimum");
  return flags;
}
