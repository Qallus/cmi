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

// Words many unrelated companies share. "HPA Consulting Engineers" and "QA
// Consulting Engineers" are different firms; the match has to come from the
// distinctive part of the name ("hpa" vs "qa").
const GENERIC = new Set([
  "engineering", "engineers", "engineer", "consulting", "consultants", "consultant", "design", "designs", "designer",
  "construction", "constructors", "builders", "builder", "building", "homes", "home", "services", "service",
  "solutions", "group", "contracting", "contractors", "contractor", "enterprises", "studio", "interiors", "interior",
  "electric", "electrical", "plumbing", "hvac", "roofing", "landscape", "landscaping", "pools", "pool", "painting",
  "concrete", "masonry", "framing", "flooring", "floors", "cabinets", "cabinetry", "supply", "supplies", "development",
  "properties", "realty", "architecture", "architects", "automation", "systems", "technologies", "tech", "partners",
  "associates", "and", "of", "az", "arizona", "phoenix", "scottsdale", "custom", "remodeling", "remodel", "restoration",
]);

/** The part of a normalized name that identifies the company. */
export function distinctivePart(normalized: string): string {
  return normalized.split(" ").filter((w) => !GENERIC.has(w)).join(" ");
}

export type CompanyLite = { id: string; name: string; created_at?: string | null };
export type DuplicatePair = { a: CompanyLite; b: CompanyLite; score: number; exact: boolean };

/**
 * Candidate pairs, best match first. Each company appears in at most
 * `perCompany` pairs. A pair must match on its distinctive words AND be
 * reasonably close overall, so a shared trade word can't carry a match and a
 * shared prefix ("ABC Plumbing" vs "ABC Electric") isn't enough on its own.
 */
export function findDuplicatePairs(companies: CompanyLite[], threshold = 0.6, perCompany = 3): DuplicatePair[] {
  const norm = companies
    .map((c) => { const n = normalizeCompanyName(c.name); return { c, n, d: distinctivePart(n) || n }; })
    .filter((x) => x.n.length >= 2);
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < norm.length; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      const exact = norm[i].n === norm[j].n;
      if (exact) { pairs.push({ a: norm[i].c, b: norm[j].c, score: 1, exact }); continue; }
      const core = similarity(norm[i].d, norm[j].d);
      if (core < threshold) continue;
      const full = similarity(norm[i].n, norm[j].n);
      if (full < 0.45) continue;
      const score = 0.7 * core + 0.3 * full;
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
