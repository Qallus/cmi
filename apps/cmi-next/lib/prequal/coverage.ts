// Coverage checks and the reminder schedule (trade partner brief §7.2, §8).
// Pure (no I/O, no imports) so lib/prequal/coverage.test.mjs runs it directly.
// Callers pass CMI's minimums (INSURANCE_MINIMUMS in ./form).
type Minimum = { perOccurrence?: number; aggregate?: number };
export type Minimums = Record<"gl" | "auto" | "wc" | "umbrella", Minimum>;

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
  const out = coverages.map((c) => {
    let meets: boolean | null = null;
    if (c.line === "general_liability") {
      const occ = c.each_occurrence, agg = c.aggregate;
      const minOcc = INSURANCE_MINIMUMS.gl.perOccurrence ?? 0, minAgg = INSURANCE_MINIMUMS.gl.aggregate ?? 0;
      if (occ == null || agg == null) flags.push("General liability limits couldn't be read. Check the certificate.");
      else {
        meets = occ >= minOcc && agg >= minAgg;
        if (occ < minOcc) flags.push(`General liability ${money(occ)} per occurrence is below the ${money(minOcc)} minimum.`);
        if (agg < minAgg) flags.push(`General liability ${money(agg)} aggregate is below the ${money(minAgg)} minimum.`);
      }
    } else if (c.line === "auto") {
      const csl = c.combined_single_limit ?? c.each_occurrence;
      const min = INSURANCE_MINIMUMS.auto.perOccurrence ?? 0;
      if (csl == null) flags.push("Commercial auto limit couldn't be read. Check the certificate.");
      else { meets = csl >= min; if (!meets) flags.push(`Commercial auto ${money(csl)} is below the ${money(min)} minimum.`); }
    } else if (c.line === "workers_comp") {
      const el = c.employers_liability_each_accident;
      const min = INSURANCE_MINIMUMS.wc.perOccurrence ?? 0;
      if (el == null) flags.push("Workers' comp employer's liability couldn't be read. Check the certificate.");
      else { meets = el >= min; if (!meets) flags.push(`Employer's liability ${money(el)} is below the ${money(min)} minimum.`); }
    } else if (c.line === "umbrella") {
      const lim = c.each_occurrence ?? c.aggregate;
      const min = INSURANCE_MINIMUMS.umbrella.perOccurrence ?? 0;
      if (lim != null) { meets = lim >= min; if (!meets) flags.push(`Umbrella ${money(lim)} is below the ${money(min)} minimum.`); }
    }
    return { ...c, meets_minimum: meets };
  });

  const has = (l: CoverageLine) => out.some((c) => c.line === l);
  if (!has("general_liability")) flags.push("No general liability coverage on the certificate.");
  if (!has("workers_comp")) flags.push("No workers' compensation on the certificate. Ask for it, or a sole-proprietor waiver.");
  if (!has("auto")) flags.push("No commercial auto coverage on the certificate.");
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
