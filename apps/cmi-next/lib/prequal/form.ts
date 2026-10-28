// The CMI trade partner prequalification form.
//
// Defined as data, not JSX, for three reasons: the public form and the
// internal review screen render the same questions from one source; the
// interview workspace can ask follow-ups about specific keys; and `mapsTo`
// records which company column an answer belongs in, which is what turns a
// submitted form into operational data rather than an archived PDF.
//
// 2026-10-28 revision follows Brandon's Trade Partner Portal brief §5
// (docs/trade-partners/). Questions it removed live on in RETIRED_SECTION so
// answers from earlier drafts still show in review and still map to columns.

// ─── CMI insurance minimums (per the MSA) ───────────────────────────────────
// The application asks a yes/no against each ("Do you carry at least …?") and
// Phase 3's COI reader checks certificates against the numbers.
// PLACEHOLDERS until Brandon confirms them from the 2026 MSA. Change them here;
// lib/prequal/minimums.ts re-exports them. (Kept in this file so form.ts has
// no local imports and the node test runner can load it directly.)
export type CoverageKey = "gl" | "auto" | "wc" | "umbrella";
export const INSURANCE_MINIMUMS: Record<CoverageKey, { label: string; text: string; perOccurrence?: number; aggregate?: number }> = {
  gl: { label: "General liability", text: "$1,000,000 per occurrence / $2,000,000 aggregate", perOccurrence: 1_000_000, aggregate: 2_000_000 },
  auto: { label: "Commercial auto", text: "$1,000,000 combined single limit", perOccurrence: 1_000_000 },
  wc: { label: "Workers' compensation", text: "Arizona statutory limits, with $1,000,000 employer's liability", perOccurrence: 1_000_000 },
  umbrella: { label: "Umbrella / excess liability", text: "$1,000,000", perOccurrence: 1_000_000 },
};

export type FieldType =
  | "text" | "textarea" | "email" | "phone" | "url"
  | "number" | "currency" | "date"
  | "select" | "multiselect" | "yesno"
  | "document" | "content" | "heading" | "msa";

/** Show this field only when another answer says so. */
export type ShowIf = { key: string; equals?: string | number | boolean; truthy?: boolean; falsy?: boolean; includes?: string };

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  required?: boolean;
  options?: readonly string[];
  showIf?: ShowIf;
  /** Column on `companies` this answer belongs in. */
  mapsTo?: string;
  /** For type: "document" — the compliance document it satisfies. */
  docType?: string;
  /**
   * A document CMI won't send work without. Required documents get a tracked
   * "requested" row whether or not they're uploaded, so they show up as
   * missing; the rest only get a row once a file actually arrives.
   */
  docRequired?: boolean;
  /** Free text shown instead of an input, for type: "content". */
  body?: string;
};

export type Section = {
  key: string;
  title: string;
  description?: string;
  fields: readonly Field[];
};

export const FORM_VERSION = "2026-10-28";

export const PARTNER_TYPES = [
  "Subcontractor", "Supplier / Vendor", "Consultant", "Designer", "Architect",
  "Engineer", "General Contractor", "Vendor", "Supplier", "Other",
] as const;

// Original names are kept verbatim (existing companies.trades hold them);
// new trades are added. Each maps to a CMI cost code in trade_cost_codes.
export const TRADES = [
  "Demolition", "Excavation / Grading", "Site Utilities", "Concrete", "Concrete Flatwork",
  "Rebar / Post-Tension", "Masonry", "Structural Steel", "Framing", "Trusses / Lumber Supply",
  "Roofing", "Sheet Metal / Gutters", "Windows & Doors", "Garage Doors", "Stucco / Siding",
  "Waterproofing", "Insulation", "Drywall", "Plumbing", "HVAC", "Electrical",
  "Low Voltage / AV", "Security / Smart Home", "Solar", "Fire Protection", "Painting", "Tile",
  "Flooring", "Carpet", "Cabinetry / Millwork", "Finish Carpentry / Trim", "Countertops",
  "Glass & Mirror", "Appliances", "Fireplaces", "Ironwork / Railings", "Specialty Metals",
  "Landscape", "Hardscape / Pavers", "Irrigation", "Pools & Spas", "Fencing / Gates",
  "Elevators", "Abatement", "Surveying", "Engineering", "Testing / Inspections",
  "Cleaning", "Dumpsters / Hauling", "Portable Toilets", "Equipment Rental", "Other",
] as const;

export const SERVICE_AREAS = [
  "Phoenix", "Scottsdale", "Paradise Valley", "Chandler", "Gilbert", "Mesa",
  "Tempe", "Queen Creek", "Peoria", "Glendale", "Goodyear", "Cave Creek",
  "Carefree", "Fountain Hills", "Arcadia", "Sedona", "Flagstaff",
  "Outside metro Phoenix", "Statewide",
] as const;

/** Still used by interview templates; no longer asked on the public form. */
export const PRICING_METHODS = ["Lump sum", "Unit pricing", "Time and materials", "Cost plus", "Other"] as const;
export const BUSINESS_STRUCTURES = ["Sole proprietor", "LLC", "S Corporation", "C Corporation", "Partnership", "Other"] as const;
export const YEARS_IN_BUSINESS = ["Less than 1 year", "1–2 years", "3–5 years", "6–10 years", "11–20 years", "More than 20 years"] as const;
export const CREW_SIZES = ["Just me", "2–5", "6–10", "11–25", "26–50", "51–100", "More than 100"] as const;
export const WORKFORCE_MIX = ["All W-2 employees", "Mostly W-2 employees", "Mostly 1099 / subcontracted", "All 1099 / subcontracted"] as const;
export const CONCURRENT_PROJECTS = ["1", "2–3", "4–6", "7–10", "More than 10"] as const;

/** Compliance documents, and whether every applicant needs one. */
export const DOCUMENT_TYPES = [
  { key: "w9", label: "W-9", always: true },
  { key: "license", label: "Contractor license", always: false },
  { key: "coi", label: "Certificate of Insurance", always: true },
  { key: "gl", label: "General liability certificate", always: false },
  { key: "wc", label: "Workers' compensation certificate", always: false },
  { key: "auto", label: "Commercial auto certificate", always: false },
  { key: "safety_program", label: "Safety program", always: false },
  { key: "references", label: "References", always: false },
  { key: "portfolio", label: "Portfolio / project photos", always: false },
  { key: "msa", label: "Master Subcontractor Agreement (signed)", always: false },
] as const;

const notPrimary = (key: string): ShowIf => ({ key, falsy: true });
const M = INSURANCE_MINIMUMS;

export const SECTIONS: readonly Section[] = [
  {
    key: "company",
    title: "Your company",
    description: "The basics, as they appear on your license and insurance.",
    fields: [
      { key: "company_name", label: "Company name", type: "text", mapsTo: "name" },
      { key: "legal_name", label: "Legal name, if different", type: "text", mapsTo: "legal_name" },
      { key: "partner_type", label: "Type of partner", type: "select", options: ["Subcontractor", "Supplier / Vendor", "Consultant", "Designer", "Architect", "Engineer", "Other"], mapsTo: "partner_type" },
      { key: "partner_type_other", label: "Tell us what kind of partner", type: "text", mapsTo: "partner_type_other", showIf: { key: "partner_type", equals: "Other" } },
      { key: "business_structure", label: "Business structure", type: "select", options: BUSINESS_STRUCTURES, mapsTo: "business_structure", help: "Tells us whether we issue you a 1099." },
      { key: "business_structure_other", label: "Describe your business structure", type: "text", mapsTo: "business_structure_other", showIf: { key: "business_structure", equals: "Other" } },
      { key: "years_in_business_range", label: "Years in business", type: "select", options: YEARS_IN_BUSINESS, mapsTo: "years_in_business_range" },
      { key: "website", label: "Website or social media", type: "url", mapsTo: "website" },
      { key: "company_phone", label: "Office phone", type: "phone", mapsTo: "phone" },
      { key: "company_email", label: "Company email", type: "email", mapsTo: "email" },
      { key: "street_address", label: "Business address", type: "text", mapsTo: "street_address" },
      { key: "city", label: "City", type: "text", mapsTo: "city" },
      { key: "state", label: "State", type: "text", mapsTo: "state" },
      { key: "zip", label: "ZIP", type: "text", mapsTo: "zip" },
    ],
  },
  {
    key: "contact",
    title: "Contacts",
    description: "Who we should reach for what. Tick \"Same as primary contact\" for any role your primary contact covers.",
    fields: [
      { key: "h_primary", label: "Primary contact", type: "heading" },
      { key: "contact_first_name", label: "First name", type: "text", required: true },
      { key: "contact_last_name", label: "Last name", type: "text", required: true },
      { key: "contact_title", label: "Title / role", type: "text" },
      { key: "contact_email", label: "Email", type: "email", required: true },
      { key: "contact_phone", label: "Mobile phone", type: "phone", required: true },

      { key: "h_accounting", label: "Accounting contact", type: "heading" },
      { key: "accounting_same", label: "Same as primary contact", type: "yesno" },
      { key: "accounting_name", label: "Name", type: "text", showIf: notPrimary("accounting_same") },
      { key: "accounting_email", label: "Email", type: "email", showIf: notPrimary("accounting_same") },
      { key: "accounting_phone", label: "Phone", type: "phone", showIf: notPrimary("accounting_same") },

      { key: "h_estimating", label: "Estimating / bid contact", type: "heading" },
      { key: "estimating_same", label: "Same as primary contact", type: "yesno" },
      { key: "estimating_name", label: "Name", type: "text", showIf: notPrimary("estimating_same") },
      { key: "estimating_email", label: "Email", type: "email", showIf: notPrimary("estimating_same") },
      { key: "estimating_phone", label: "Phone", type: "phone", showIf: notPrimary("estimating_same") },

      { key: "h_field", label: "Field contact", type: "heading" },
      { key: "field_same", label: "Same as primary contact", type: "yesno" },
      { key: "field_name", label: "Name", type: "text", showIf: notPrimary("field_same") },
      { key: "field_email", label: "Email", type: "email", showIf: notPrimary("field_same") },
      { key: "field_phone", label: "Phone", type: "phone", showIf: notPrimary("field_same") },

      { key: "h_emergency", label: "After-hours emergency contact", type: "heading" },
      { key: "emergency_same", label: "Same as primary contact", type: "yesno" },
      { key: "emergency_name", label: "Name", type: "text", showIf: notPrimary("emergency_same") },
      { key: "emergency_phone", label: "Phone", type: "phone", showIf: notPrimary("emergency_same") },
    ],
  },
  {
    key: "trades",
    title: "Trades and specialties",
    fields: [
      { key: "trades", label: "Trades and specialties", type: "multiselect", options: TRADES, mapsTo: "trades" },
      { key: "trades_other", label: "Describe your other trade or specialty", type: "text", mapsTo: "trades_other", showIf: { key: "trades", includes: "Other" } },
      { key: "specialty_notes", label: "What are you specialized in?", type: "textarea", placeholder: "The work you'd most like us to send you." },
      { key: "avoid_notes", label: "What would you rather not take on?", type: "textarea", help: "Just as useful to us. It saves everyone a wasted bid." },
      { key: "does_residential", label: "Do you do residential work?", type: "yesno", mapsTo: "does_residential" },
      { key: "does_commercial", label: "Do you do commercial work?", type: "yesno", mapsTo: "does_commercial" },
      { key: "self_perform", label: "What do you self-perform?", type: "textarea" },
    ],
  },
  {
    key: "area",
    title: "Where you work",
    fields: [
      { key: "service_areas", label: "Service areas", type: "multiselect", options: SERVICE_AREAS, mapsTo: "service_areas" },
      { key: "max_travel_miles", label: "Maximum travel from your yard (miles)", type: "number", mapsTo: "max_travel_miles" },
      { key: "travel_surcharge", label: "Do you charge for travel or mobilization?", type: "yesno" },
      { key: "travel_surcharge_detail", label: "How is that charged?", type: "textarea", showIf: { key: "travel_surcharge", truthy: true } },
    ],
  },
  {
    key: "workforce",
    title: "Your team and capacity",
    fields: [
      { key: "employee_count_range", label: "Crew size (total people)", type: "select", options: CREW_SIZES, mapsTo: "employee_count_range" },
      { key: "workforce_mix", label: "Your crew is", type: "select", options: WORKFORCE_MIX },
      { key: "uses_subcontractors", label: "Do you use subcontractors?", type: "yesno", mapsTo: "uses_subcontractors" },
      { key: "subcontracted_scopes", label: "Which scopes do you subcontract?", type: "textarea", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "osha_trained", label: "Are your crews OSHA trained?", type: "yesno", mapsTo: "osha_trained" },
      { key: "has_safety_program", label: "Do you have a written safety program?", type: "yesno", mapsTo: "has_safety_program" },
      { key: "had_safety_incidents", label: "Any recordable safety incidents in the last three years?", type: "yesno" },
      { key: "safety_incidents", label: "Tell us briefly what happened", type: "textarea", showIf: { key: "had_safety_incidents", truthy: true } },
      { key: "concurrent_capacity_range", label: "How many projects can you run at once?", type: "select", options: CONCURRENT_PROJECTS, mapsTo: "concurrent_capacity_range" },
      { key: "min_project_value", label: "Minimum project you'll take", type: "currency", mapsTo: "min_project_value" },
      { key: "max_project_value", label: "Largest project you're comfortable with today", type: "currency", mapsTo: "max_project_value" },
      { key: "currently_available", label: "Are you currently available to take on new work?", type: "yesno", mapsTo: "currently_available" },
      { key: "available_from", label: "Available from", type: "date", mapsTo: "available_from", showIf: { key: "currently_available", truthy: true } },
      { key: "capacity_notes", label: "What capacity do you have, and what projects would you take?", type: "textarea", mapsTo: "capacity_notes", showIf: { key: "currently_available", truthy: true } },
      { key: "mobilisation_notice", label: "Notice you need to mobilize", type: "text", placeholder: "e.g. 10 working days" },
    ],
  },
  {
    key: "pricing",
    title: "Estimating and pricing",
    fields: [
      { key: "estimates_from_plans", label: "Can you estimate from plans?", type: "yesno", mapsTo: "estimates_from_plans" },
      { key: "estimates_without_plans", label: "Can you estimate without plans?", type: "yesno", mapsTo: "estimates_without_plans" },
      { key: "requires_site_walk", label: "Do you need a site walk before bidding?", type: "yesno", mapsTo: "requires_site_walk" },
      { key: "bid_turnaround", label: "Typical bid turnaround", type: "text", placeholder: "e.g. 5 business days" },
      { key: "payment_terms", label: "Payment terms you typically work on (optional)", type: "text", mapsTo: "payment_terms" },
    ],
  },
  {
    key: "licensing",
    title: "Licensing and insurance",
    description: "We verify these before sending work.",
    fields: [
      {
        key: "insurance_notice", label: "", type: "content",
        body: "Before working with Constructed Matter you must provide a current W-9 and Certificate(s) of Insurance. You can submit this application without a certificate, but we can't issue work until it's on file.",
      },
      { key: "is_licensed", label: "Do you hold a contractor license (ROC)?", type: "yesno" },
      { key: "license_number", label: "License number", type: "text", showIf: { key: "is_licensed", truthy: true } },
      { key: "license_class", label: "License classification", type: "text", showIf: { key: "is_licensed", truthy: true } },
      { key: "license_state", label: "Issuing state", type: "text", showIf: { key: "is_licensed", truthy: true } },
      { key: "license_expires", label: "License expires", type: "date", showIf: { key: "is_licensed", truthy: true } },
      { key: "certifications", label: "Certifications and manufacturer approvals", type: "textarea", help: "One per line.", mapsTo: "certifications" },
      { key: "bonding_capacity", label: "Bonding capacity, if bonded", type: "currency", mapsTo: "bonding_capacity" },
      { key: "meets_gl_minimum", label: `Do you carry ${M.gl.label.toLowerCase()} of at least ${M.gl.text}?`, type: "yesno", mapsTo: "meets_gl_minimum" },
      { key: "meets_auto_minimum", label: `Do you carry ${M.auto.label.toLowerCase()} of at least ${M.auto.text}?`, type: "yesno", mapsTo: "meets_auto_minimum" },
      { key: "meets_wc_minimum", label: `Do you carry ${M.wc.label.toLowerCase()} (${M.wc.text})?`, type: "yesno", mapsTo: "meets_wc_minimum" },
      { key: "meets_umbrella_minimum", label: `Do you carry ${M.umbrella.label.toLowerCase()} of at least ${M.umbrella.text}?`, type: "yesno", mapsTo: "meets_umbrella_minimum" },
      { key: "can_name_additional_insured", label: "Can Constructed Matter be named as additional insured?", type: "yesno", mapsTo: "can_name_additional_insured" },
    ],
  },
  {
    key: "documents",
    title: "Documents",
    description: "PDF, JPG or PNG. You can come back and add these later. Your progress is saved.",
    fields: [
      { key: "doc_w9", label: "W-9", type: "document", docType: "w9", docRequired: true },
      { key: "doc_coi", label: "Certificate of Insurance", type: "document", docType: "coi", docRequired: true, help: "General liability, auto and workers' comp are often on one certificate." },
      { key: "doc_license", label: "Contractor license (ROC)", type: "document", docType: "license", docRequired: true, showIf: { key: "is_licensed", truthy: true } },
      { key: "doc_wc", label: "Workers' compensation certificate, if separate", type: "document", docType: "wc" },
      { key: "doc_auto", label: "Commercial auto certificate, if separate", type: "document", docType: "auto" },
      { key: "doc_safety", label: "Safety program", type: "document", docType: "safety_program", showIf: { key: "has_safety_program", truthy: true } },
      { key: "portfolio_url", label: "Portfolio link (optional)", type: "url", mapsTo: "portfolio_url", placeholder: "Website, Instagram, Houzz, Google Drive…" },
      { key: "doc_portfolio", label: "Or upload project photos (optional)", type: "document", docType: "portfolio" },
    ],
  },
  {
    key: "attestation",
    title: "Confirm and sign",
    fields: [
      {
        key: "attestation_body", label: "", type: "content",
        body: "By submitting, you confirm the information is accurate and complete to the best of your knowledge, that you're authorized to submit it for your company, and that Constructed Matter may verify your license and insurance. Prequalification is not an offer of work.",
      },
      { key: "msa_signature", label: "Master Subcontractor Agreement", type: "msa" },
    ],
  },
] as const;

/**
 * Questions the 2026-10-28 revision removed. Never rendered on the public
 * form, never required; kept so earlier drafts' answers still show in review
 * and still land on the company columns they always mapped to.
 */
export const RETIRED_SECTION: Section = {
  key: "retired",
  title: "Earlier questions (previous form)",
  fields: [
    { key: "years_in_business", label: "Years in business", type: "number", mapsTo: "years_in_business" },
    { key: "estimator_name", label: "Estimator", type: "text" },
    { key: "field_supervisor", label: "Field supervisor / foreman", type: "text" },
    { key: "emergency_contact", label: "After-hours or emergency contact", type: "text" },
    { key: "employee_count", label: "Total people", type: "number", mapsTo: "employee_count" },
    { key: "w2_employee_count", label: "W-2 employees", type: "number", mapsTo: "w2_employee_count" },
    { key: "subcontractor_count", label: "Subcontractors used regularly", type: "number", mapsTo: "subcontractor_count" },
    { key: "sub_qualification", label: "How they qualify subcontractors", type: "textarea" },
    { key: "ideal_project_value", label: "Ideal project size", type: "currency", mapsTo: "ideal_project_value" },
    { key: "concurrent_capacity", label: "Projects at once", type: "number", mapsTo: "concurrent_capacity" },
    { key: "current_backlog", label: "How far out they're booked", type: "text" },
    { key: "accelerated_schedules", label: "Supports accelerated schedules", type: "yesno" },
    { key: "pricing_methods", label: "How they price work", type: "multiselect", options: PRICING_METHODS, mapsTo: "pricing_methods" },
    { key: "accepts_retainage", label: "Accepts retainage", type: "yesno" },
    { key: "bid_requirements", label: "What they need for an accurate bid", type: "textarea" },
    { key: "equipment", label: "Equipment owned", type: "textarea", mapsTo: "equipment" },
    { key: "equipment_rented", label: "Equipment rented", type: "textarea" },
    { key: "gl_carrier", label: "General liability carrier", type: "text" },
    { key: "gl_limit", label: "General liability limit", type: "currency" },
    { key: "gl_expires", label: "General liability expires", type: "date" },
    { key: "wc_carrier", label: "Workers' compensation carrier", type: "text" },
    { key: "wc_expires", label: "Workers' compensation expires", type: "date" },
    { key: "auto_carrier", label: "Commercial auto carrier", type: "text" },
    { key: "auto_expires", label: "Commercial auto expires", type: "date" },
    { key: "umbrella_limit", label: "Umbrella limit", type: "currency" },
    { key: "doc_references", label: "References", type: "document", docType: "references" },
    { key: "similar_projects", label: "Recent projects like ours", type: "textarea" },
    { key: "gc_references", label: "General contractors they work with", type: "textarea" },
    { key: "reference_contacts", label: "Reference contacts", type: "textarea" },
    { key: "largest_project", label: "Largest comparable project", type: "text" },
    { key: "disputes", label: "Disputes, claims or terminations (5 years)", type: "textarea" },
    { key: "why_cmi", label: "What makes a project run well", type: "textarea" },
    { key: "attestation_name", label: "Attested by", type: "text" },
    { key: "attestation_title", label: "Attester's title", type: "text" },
  ],
};

/** Contact roles collected on the form, in order (feeds bid packages). */
export const CONTACT_ROLES = [
  { role: "accounting", label: "Accounting", same: "accounting_same", name: "accounting_name", email: "accounting_email", phone: "accounting_phone" },
  { role: "estimating", label: "Estimating / bid", same: "estimating_same", name: "estimating_name", email: "estimating_email", phone: "estimating_phone" },
  { role: "field", label: "Field", same: "field_same", name: "field_name", email: "field_email", phone: "field_phone" },
  { role: "emergency", label: "After-hours emergency", same: "emergency_same", name: "emergency_name", email: null, phone: "emergency_phone" },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

export type Answers = Record<string, unknown>;

const truthy = (v: unknown) => v === true || v === "yes" || v === "Yes";

/** Headings, notices and the MSA step: shown, but not questions to count. */
export function isDisplayOnly(field: Field): boolean {
  return field.type === "content" || field.type === "heading" || field.type === "msa";
}

/** Whether a conditional field should be on screen given the answers so far. */
export function isVisible(field: Field, answers: Answers): boolean {
  const cond = field.showIf;
  if (!cond) return true;
  const value = answers[cond.key];
  if (cond.truthy) return truthy(value);
  if (cond.falsy) return !truthy(value);
  if (cond.equals !== undefined) return value === cond.equals;
  if (cond.includes !== undefined) return Array.isArray(value) && value.includes(cond.includes);
  return true;
}

export function visibleFields(section: Section, answers: Answers): Field[] {
  return section.fields.filter((f) => isVisible(f, answers));
}

const answered = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

/**
 * Percentage of the questions currently on screen that have an answer.
 *
 * `sections` defaults to the prequalification form but is a parameter so an
 * interview template — which is the same Section[] shape, loaded from the
 * database — gets the same progress maths rather than its own copy.
 */
export function progressOf(answers: Answers, sections: readonly Section[] = SECTIONS): number {
  let total = 0;
  let done = 0;
  for (const section of sections) {
    for (const field of visibleFields(section, answers)) {
      if (isDisplayOnly(field)) continue;
      total += 1;
      if (answered(answers[field.key])) done += 1;
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/**
 * Required questions still unanswered. Only the four contact fields are
 * required: anything else missing is a gap for a reviewer to chase, not a
 * reason to turn an applicant away at the door.
 */
export function missingRequired(
  answers: Answers, sections: readonly Section[] = SECTIONS,
): { section: string; field: Field }[] {
  const out: { section: string; field: Field }[] = [];
  for (const section of sections) {
    for (const field of visibleFields(section, answers)) {
      if (field.required && !answered(answers[field.key])) out.push({ section: section.title, field });
    }
  }
  return out;
}

const ARRAY_COLUMNS = new Set(["trades", "service_areas", "pricing_methods", "equipment", "certifications", "capabilities"]);
const NUMBER_COLUMNS = new Set([
  "years_in_business", "employee_count", "w2_employee_count", "subcontractor_count",
  "max_travel_miles", "min_project_value", "ideal_project_value", "max_project_value",
  "concurrent_capacity", "bonding_capacity",
]);
const BOOLEAN_COLUMNS = new Set([
  "uses_subcontractors", "does_residential", "does_commercial", "osha_trained",
  "has_safety_program", "estimates_from_plans", "requires_site_walk",
  "estimates_without_plans", "currently_available", "can_name_additional_insured",
  "meets_gl_minimum", "meets_auto_minimum", "meets_wc_minimum", "meets_umbrella_minimum",
]);

/**
 * Turn answers into a patch for the `companies` row — the step that makes a
 * submitted form searchable rather than a stored document.
 */
export function answersToCompany(
  answers: Answers, sections: readonly Section[] = [...SECTIONS, RETIRED_SECTION],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const section of sections) {
    for (const field of section.fields) {
      if (!field.mapsTo) continue;
      const raw = answers[field.key];
      if (!answered(raw)) continue;

      if (ARRAY_COLUMNS.has(field.mapsTo)) {
        patch[field.mapsTo] = Array.isArray(raw)
          ? raw.map(String)
          // Free-text lists (equipment, certifications) are one per line.
          : String(raw).split("\n").map((s) => s.trim()).filter(Boolean);
      } else if (NUMBER_COLUMNS.has(field.mapsTo)) {
        const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
        if (Number.isFinite(n)) patch[field.mapsTo] = n;
      } else if (BOOLEAN_COLUMNS.has(field.mapsTo)) {
        patch[field.mapsTo] = truthy(raw);
      } else {
        patch[field.mapsTo] = String(raw);
      }
    }
  }
  return patch;
}

/**
 * Contacts by role from the answers. "Same as primary" copies the primary
 * contact; an empty secondary contact is left out.
 */
export function contactsByRole(answers: Answers): { role: string; name: string; email: string | null; phone: string | null; samePrimary: boolean }[] {
  const s = (k: string | null) => (k && typeof answers[k] === "string" ? String(answers[k]).trim() : "");
  const primaryName = [s("contact_first_name"), s("contact_last_name")].filter(Boolean).join(" ");
  const out: { role: string; name: string; email: string | null; phone: string | null; samePrimary: boolean }[] = [];
  for (const r of CONTACT_ROLES) {
    if (truthy(answers[r.same])) {
      out.push({ role: r.role, name: primaryName, email: s("contact_email") || null, phone: s("contact_phone") || null, samePrimary: true });
    } else if (s(r.name) || s(r.email) || s(r.phone)) {
      out.push({ role: r.role, name: s(r.name), email: s(r.email) || null, phone: s(r.phone) || null, samePrimary: false });
    }
  }
  return out;
}

/**
 * The documents relevant to this applicant, given their answers. `required`
 * marks the ones CMI won't send work without — those are tracked even when
 * nothing has been uploaded, which is what makes "missing" mean something.
 */
export function relevantDocuments(
  answers: Answers, sections: readonly Section[] = SECTIONS,
): { docType: string; label: string; required: boolean }[] {
  const docs: { docType: string; label: string; required: boolean }[] = [];
  for (const section of sections) {
    for (const field of visibleFields(section, answers)) {
      if (field.type === "document" && field.docType) {
        docs.push({ docType: field.docType, label: field.label, required: !!field.docRequired });
      }
    }
  }
  return docs;
}
