// Likely-duplicate companies, for the Trade Partners → Duplicates review.
// Pure (no I/O, no aliases) so lib/companies/dedupe.test.mjs runs it directly.
//
// Similarity mirrors Postgres pg_trgm: each word is padded ("  word ") and cut
// into three-letter grams; score = shared / union. Names are compared after
// dropping punctuation and legal suffixes, so "Acme Framing, LLC" and
// "ACME Framing" are the same company.

const SUFFIXES = new Set(["llc", "inc", "incorporated", "corp", "corporation", "co", "company", "ltd", "limited", "lp", "llp", "pllc", "pc", "the"]);

export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SUFFIXES.has(w))
    .join(" ");
}

export function trigrams(text: string): Set<string> {
  const grams = new Set<string>();
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

export function similarity(a: string, b: string): number {
  const ga = trigrams(a), gb = trigrams(b);
  if (!ga.size || !gb.size) return 0;
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  return shared / (ga.size + gb.size - shared);
}

export type CompanyLite = { id: string; name: string; created_at?: string | null };
export type DuplicatePair = { a: CompanyLite; b: CompanyLite; score: number; exact: boolean };

/** Candidate pairs, best match first. Each company appears in at most `perCompany` pairs. */
export function findDuplicatePairs(companies: CompanyLite[], threshold = 0.6, perCompany = 3): DuplicatePair[] {
  const norm = companies.map((c) => ({ c, n: normalizeCompanyName(c.name) })).filter((x) => x.n.length >= 2);
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const exact = norm[i].n === norm[j].n;
      const score = exact ? 1 : similarity(norm[i].n, norm[j].n);
      if (score >= threshold) pairs.push({ a: norm[i].c, b: norm[j].c, score: Math.round(score * 100) / 100, exact });
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const seen = new Map<string, number>();
  return pairs.filter((p) => {
    const ca = seen.get(p.a.id) ?? 0, cb = seen.get(p.b.id) ?? 0;
    if (ca >= perCompany || cb >= perCompany) return false;
    seen.set(p.a.id, ca + 1); seen.set(p.b.id, cb + 1);
    return true;
  });
}

const ARRAY_FIELDS = ["trades", "service_areas", "capabilities", "pricing_methods", "equipment", "certifications", "tags"];
const NEVER_COPY = new Set(["id", "slug", "name", "created_at", "updated_at", "created_by", "updated_by", "archived_at", "qualification_status", "approved_at", "approved_by"]);

/**
 * The patch that fills the survivor from the duplicate: empty fields take the
 * duplicate's value, list fields are unioned, notes are appended. The
 * survivor's own values always win.
 */
export function mergePatch(survivor: Record<string, unknown>, duplicate: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  for (const [key, dv] of Object.entries(duplicate)) {
    if (NEVER_COPY.has(key) || empty(dv)) continue;
    const sv = survivor[key];
    if (ARRAY_FIELDS.includes(key) && Array.isArray(dv)) {
      const union = [...new Set([...(Array.isArray(sv) ? sv : []), ...dv])];
      if (union.length !== (Array.isArray(sv) ? sv.length : 0)) patch[key] = union;
    } else if ((key === "notes" || key === "internal_notes") && !empty(sv) && sv !== dv) {
      patch[key] = `${sv}\n\n[Merged from ${String(duplicate.name ?? "duplicate")}] ${dv}`;
    } else if (empty(sv)) {
      patch[key] = dv;
    }
  }
  return patch;
}
