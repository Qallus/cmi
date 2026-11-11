// A job's inspection profile: scope (NEW / ADD / REN) and the site conditions
// that switch on the inspection library's "If …" rows. Pure (no I/O), shared by
// Job Info (Step 2) and loading inspections into a schedule (Step 3).

export type InspectionScope = "NEW" | "ADD" | "REN";

export const INSPECTION_SCOPES: { value: InspectionScope; label: string; hint: string }[] = [
  { value: "NEW", label: "New build", hint: "New single-family residence or guest house" },
  { value: "ADD", label: "Addition / large renovation", hint: "Structural, foundation or exterior work" },
  { value: "REN", label: "Interior remodel", hint: "No new foundation and no site work" },
];

export type ConditionKey =
  | "site_work" | "hillside" | "row_work" | "swppp" | "drainage" | "flood_zone" | "demo"
  | "new_footings" | "structural_slab" | "cmu" | "structural" | "roof_height"
  | "digging" | "trenching" | "under_slab" | "new_sewer" | "gas" | "new_service" | "service_change"
  | "walls_opened" | "windows" | "showers" | "stucco" | "sprinklered" | "pool";

export const CONDITION_GROUPS: { label: string; items: { key: ConditionKey; label: string }[] }[] = [
  { label: "Site", items: [
    { key: "site_work", label: "Site work / grading" },
    { key: "hillside", label: "Hillside lot" },
    { key: "drainage", label: "Engineered drainage" },
    { key: "swppp", label: "SWPPP marked on plans" },
    { key: "row_work", label: "Right-of-way work" },
    { key: "flood_zone", label: "Flood zone / substantial improvement" },
    { key: "demo", label: "Demolition permit" },
  ] },
  { label: "Structure", items: [
    { key: "new_footings", label: "New footings" },
    { key: "structural_slab", label: "Structural / post-tension slab" },
    { key: "cmu", label: "CMU (block) walls" },
    { key: "structural", label: "Structural framing or shear walls" },
    { key: "roof_height", label: "Roof height changes" },
  ] },
  { label: "Utilities", items: [
    { key: "digging", label: "Digging (Blue Stake)" },
    { key: "trenching", label: "Trenching" },
    { key: "under_slab", label: "Under-slab plumbing / duct" },
    { key: "new_sewer", label: "New or relocated sewer" },
    { key: "gas", label: "Gas" },
    { key: "new_service", label: "New utility service" },
    { key: "service_change", label: "Electrical service change" },
  ] },
  { label: "Building", items: [
    { key: "walls_opened", label: "Walls / ceilings opened" },
    { key: "windows", label: "Windows replaced" },
    { key: "showers", label: "Showers (pan test)" },
    { key: "stucco", label: "Stucco" },
    { key: "sprinklered", label: "Fire sprinklers" },
    { key: "pool", label: "Pool" },
  ] },
];

export const CONDITION_KEYS: ConditionKey[] = CONDITION_GROUPS.flatMap((g) => g.items.map((i) => i.key));

// The library's "If …" scope cells and the condition each one waits on.
const IF_TEXT: Record<string, ConditionKey> = {
  "if site work": "site_work",
  "if hillside": "hillside",
  "if drainage condition": "drainage",
  "if marked": "swppp",
  "if row work": "row_work",
  "if flood zone": "flood_zone",
  "if flood zone / substantial improvement": "flood_zone",
  "if substantial improvement": "flood_zone",
  "if demo permit": "demo",
  "if new footings": "new_footings",
  "if structural slab": "structural_slab",
  "if cmu": "cmu",
  "if structural": "structural",
  "if roof height changes": "roof_height",
  "if digging": "digging",
  "if trenching": "trenching",
  "if under-slab work": "under_slab",
  "if any": "under_slab",          // SCOT under-slab duct
  "if new": "new_sewer",           // "New or relocated sewer"
  "if gas": "gas",
  "if new service": "new_service",
  "if service change": "service_change",
  "if walls/ceilings opened": "walls_opened",
  "if windows replaced": "windows",
  "if showers": "showers",
  "if stucco": "stucco",
  "if sprinklered": "sprinklered",
  "if pool": "pool",
};

/**
 * How a library scope cell applies to a job:
 *  - include: always ("Y")
 *  - exclude: never for this scope ("—" or empty)
 *  - condition: only when the job has that condition ("If pool")
 *  - confirm: the PM decides when loading ("If required", "As needed", "If listed on permit", …)
 */
export type ScopeRule =
  | { kind: "include" }
  | { kind: "exclude" }
  | { kind: "condition"; key: ConditionKey }
  | { kind: "confirm"; text: string };

export function scopeRule(cell: string | null | undefined): ScopeRule {
  const text = (cell ?? "").trim();
  if (!text || text === "—" || text === "-") return { kind: "exclude" };
  if (text.toUpperCase() === "Y") return { kind: "include" };
  const key = IF_TEXT[text.toLowerCase()];
  return key ? { kind: "condition", key } : { kind: "confirm", text };
}

/** The library scope cell for the job's scope. */
export function scopeCell(row: { scope_new: string | null; scope_add: string | null; scope_ren: string | null }, scope: InspectionScope): string | null {
  return scope === "NEW" ? row.scope_new : scope === "ADD" ? row.scope_add : row.scope_ren;
}

/** Keep only known condition keys, de-duplicated, in list order. */
export function cleanConditions(input: unknown): ConditionKey[] {
  const set = new Set(Array.isArray(input) ? input.map(String) : []);
  return CONDITION_KEYS.filter((k) => set.has(k));
}

// City name on the job → the jurisdiction it most likely is. Only a suggestion:
// jurisdiction goes by parcel (Phoenix and Scottsdale addresses can sit in County
// islands; Paradise Valley can carry a Phoenix or Scottsdale ZIP).
const CITY_TO_JURISDICTION: Record<string, string> = {
  scottsdale: "SCOT", phoenix: "PHX", "paradise valley": "PV", mesa: "MESA", tempe: "TMP",
  chandler: "CHD", "cave creek": "CC", carefree: "CF",
};
export function suggestJurisdiction(city: string | null | undefined): string | null {
  return CITY_TO_JURISDICTION[(city ?? "").trim().toLowerCase()] ?? null;
}
