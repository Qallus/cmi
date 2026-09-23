// The CMI trade partner prequalification form.
//
// Defined as data, not JSX, for three reasons: the public form and the
// internal review screen render the same questions from one source; the
// interview workspace can ask follow-ups about specific keys; and `mapsTo`
// records which company column an answer belongs in, which is what turns a
// submitted form into operational data rather than an archived PDF.

export type FieldType =
  | "text" | "textarea" | "email" | "phone" | "url"
  | "number" | "currency" | "date"
  | "select" | "multiselect" | "yesno"
  | "document" | "content";

/** Show this field only when another answer says so. */
export type ShowIf = { key: string; equals?: string | number | boolean; truthy?: boolean; includes?: string };

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
  /** Free text shown instead of an input, for type: "content". */
  body?: string;
};

export type Section = {
  key: string;
  title: string;
  description?: string;
  fields: readonly Field[];
};

export const FORM_VERSION = "2026-09-23";

export const PARTNER_TYPES = [
  "Subcontractor", "General Contractor", "Vendor", "Supplier", "Designer",
  "Architect", "Engineer", "Consultant", "Other",
] as const;

export const TRADES = [
  "Demolition", "Excavation / Grading", "Concrete", "Masonry", "Framing",
  "Roofing", "Windows & Doors", "Stucco / Siding", "Plumbing", "HVAC",
  "Electrical", "Low Voltage / AV", "Insulation", "Drywall", "Painting",
  "Tile", "Flooring", "Cabinetry / Millwork", "Countertops", "Glass & Mirror",
  "Landscape", "Pools & Spas", "Solar", "Fire Protection", "Elevators",
  "Specialty Metals", "Waterproofing", "Abatement", "Other",
] as const;

export const SERVICE_AREAS = [
  "Phoenix", "Scottsdale", "Paradise Valley", "Chandler", "Gilbert", "Mesa",
  "Tempe", "Queen Creek", "Peoria", "Glendale", "Goodyear", "Cave Creek",
  "Carefree", "Fountain Hills", "Arcadia", "Sedona", "Flagstaff",
  "Outside metro Phoenix", "Statewide",
] as const;

export const PRICING_METHODS = ["Lump sum", "Unit pricing", "Time and materials", "Cost plus", "Other"] as const;
export const BUSINESS_STRUCTURES = ["Sole proprietor", "LLC", "S Corporation", "C Corporation", "Partnership", "Other"] as const;

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
] as const;

export const SECTIONS: readonly Section[] = [
  {
    key: "company",
    title: "Your company",
    description: "The basics, as they appear on your licence and insurance.",
    fields: [
      { key: "company_name", label: "Company name", type: "text", required: true, mapsTo: "name" },
      { key: "legal_name", label: "Legal name, if different", type: "text", mapsTo: "legal_name" },
      { key: "partner_type", label: "What kind of partner are you?", type: "select", required: true, options: PARTNER_TYPES, mapsTo: "partner_type" },
      { key: "business_structure", label: "Business structure", type: "select", options: BUSINESS_STRUCTURES, mapsTo: "business_structure" },
      { key: "years_in_business", label: "Years in business", type: "number", mapsTo: "years_in_business" },
      { key: "website", label: "Website", type: "url", mapsTo: "website" },
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
    title: "Primary contact",
    description: "Who should we talk to about work and scheduling?",
    fields: [
      { key: "contact_first_name", label: "First name", type: "text", required: true },
      { key: "contact_last_name", label: "Last name", type: "text", required: true },
      { key: "contact_title", label: "Title / role", type: "text" },
      { key: "contact_email", label: "Email", type: "email", required: true },
      { key: "contact_phone", label: "Mobile phone", type: "phone", required: true },
      { key: "estimator_name", label: "Estimator, if different", type: "text" },
      { key: "field_supervisor", label: "Field supervisor / foreman", type: "text" },
      { key: "emergency_contact", label: "After-hours or emergency contact", type: "text" },
    ],
  },
  {
    key: "trades",
    title: "What you do",
    fields: [
      { key: "trades", label: "Trades and specialties", type: "multiselect", required: true, options: TRADES, mapsTo: "trades" },
      { key: "specialty_notes", label: "What do you specialise in?", type: "textarea", placeholder: "The work you'd most like us to send you." },
      { key: "avoid_notes", label: "What would you rather not take on?", type: "textarea", help: "Just as useful to us — it saves everyone a wasted bid." },
      { key: "does_residential", label: "Do you do residential work?", type: "yesno", mapsTo: "does_residential" },
      { key: "does_commercial", label: "Do you do commercial work?", type: "yesno", mapsTo: "does_commercial" },
      { key: "self_perform", label: "What do you self-perform?", type: "textarea" },
    ],
  },
  {
    key: "area",
    title: "Where you work",
    fields: [
      { key: "service_areas", label: "Service areas", type: "multiselect", required: true, options: SERVICE_AREAS, mapsTo: "service_areas" },
      { key: "max_travel_miles", label: "Maximum travel from your yard (miles)", type: "number", mapsTo: "max_travel_miles" },
      { key: "travel_surcharge", label: "Do you charge for travel or mobilisation?", type: "yesno" },
      { key: "travel_surcharge_detail", label: "How is that charged?", type: "textarea", showIf: { key: "travel_surcharge", truthy: true } },
    ],
  },
  {
    key: "workforce",
    title: "Your team",
    fields: [
      { key: "employee_count", label: "Total people", type: "number", mapsTo: "employee_count" },
      { key: "w2_employee_count", label: "W2 employees", type: "number", mapsTo: "w2_employee_count" },
      { key: "uses_subcontractors", label: "Do you use subcontractors?", type: "yesno", mapsTo: "uses_subcontractors" },
      { key: "subcontractor_count", label: "How many do you use regularly?", type: "number", mapsTo: "subcontractor_count", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "subcontracted_scopes", label: "Which scopes do you subcontract?", type: "textarea", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "sub_qualification", label: "How do you qualify your subcontractors?", type: "textarea", help: "Licences, insurance certificates, safety checks.", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "osha_trained", label: "Are your crews OSHA trained?", type: "yesno", mapsTo: "osha_trained" },
      { key: "has_safety_program", label: "Do you have a written safety program?", type: "yesno", mapsTo: "has_safety_program" },
      { key: "safety_incidents", label: "Any recordable safety incidents in the last three years?", type: "textarea", help: "If none, say none." },
    ],
  },
  {
    key: "capacity",
    title: "Capacity and project size",
    fields: [
      { key: "min_project_value", label: "Minimum project you'll take", type: "currency", mapsTo: "min_project_value" },
      { key: "ideal_project_value", label: "Ideal project size", type: "currency", mapsTo: "ideal_project_value" },
      { key: "max_project_value", label: "Largest you're comfortable with today", type: "currency", mapsTo: "max_project_value" },
      { key: "concurrent_capacity", label: "How many projects can you run at once?", type: "number", mapsTo: "concurrent_capacity" },
      { key: "current_backlog", label: "How far out are you booked?", type: "text", placeholder: "e.g. 6 weeks" },
      { key: "mobilisation_notice", label: "Notice you need to mobilise", type: "text", placeholder: "e.g. 10 working days" },
      { key: "accelerated_schedules", label: "Can you support accelerated schedules?", type: "yesno" },
    ],
  },
  {
    key: "pricing",
    title: "Estimating and pricing",
    fields: [
      { key: "pricing_methods", label: "How do you price work?", type: "multiselect", options: PRICING_METHODS, mapsTo: "pricing_methods" },
      { key: "estimates_from_plans", label: "Can you estimate from plans?", type: "yesno", mapsTo: "estimates_from_plans" },
      { key: "requires_site_walk", label: "Do you need a site walk before bidding?", type: "yesno", mapsTo: "requires_site_walk" },
      { key: "bid_turnaround", label: "Typical bid turnaround", type: "text", placeholder: "e.g. 5 business days" },
      { key: "payment_terms", label: "Payment terms you work on", type: "text" },
      { key: "accepts_retainage", label: "Do you accept retainage?", type: "yesno" },
      { key: "bid_requirements", label: "What do you need from us for an accurate bid?", type: "textarea" },
    ],
  },
  {
    key: "equipment",
    title: "Equipment and certifications",
    fields: [
      { key: "equipment", label: "Equipment you own", type: "textarea", help: "One per line.", mapsTo: "equipment" },
      { key: "equipment_rented", label: "Equipment you typically rent", type: "textarea" },
      { key: "certifications", label: "Certifications and manufacturer approvals", type: "textarea", help: "One per line.", mapsTo: "certifications" },
      { key: "bonding_capacity", label: "Bonding capacity, if bonded", type: "currency", mapsTo: "bonding_capacity" },
    ],
  },
  {
    key: "licensing",
    title: "Licensing and insurance",
    description: "We verify these before sending work. Upload the certificates on the next step.",
    fields: [
      { key: "is_licensed", label: "Do you hold a contractor licence?", type: "yesno" },
      { key: "license_number", label: "Licence number", type: "text", showIf: { key: "is_licensed", truthy: true } },
      { key: "license_class", label: "Licence classification", type: "text", showIf: { key: "is_licensed", truthy: true } },
      { key: "license_state", label: "Issuing state", type: "text", showIf: { key: "is_licensed", truthy: true } },
      { key: "license_expires", label: "Licence expires", type: "date", showIf: { key: "is_licensed", truthy: true } },
      { key: "gl_carrier", label: "General liability carrier", type: "text" },
      { key: "gl_limit", label: "General liability limit", type: "currency" },
      { key: "gl_expires", label: "General liability expires", type: "date" },
      { key: "wc_carrier", label: "Workers' compensation carrier", type: "text" },
      { key: "wc_expires", label: "Workers' compensation expires", type: "date" },
      { key: "auto_carrier", label: "Commercial auto carrier", type: "text" },
      { key: "auto_expires", label: "Commercial auto expires", type: "date" },
      { key: "umbrella_limit", label: "Umbrella coverage limit", type: "currency" },
      { key: "can_name_additional_insured", label: "Can CMI be named as additional insured?", type: "yesno" },
    ],
  },
  {
    key: "documents",
    title: "Documents",
    description: "PDF, JPG or PNG. You can come back and add these later — your progress is saved.",
    fields: [
      { key: "doc_w9", label: "W-9", type: "document", docType: "w9", required: true },
      { key: "doc_coi", label: "Certificate of Insurance", type: "document", docType: "coi", required: true },
      { key: "doc_license", label: "Contractor licence", type: "document", docType: "license", showIf: { key: "is_licensed", truthy: true } },
      { key: "doc_wc", label: "Workers' compensation certificate", type: "document", docType: "wc" },
      { key: "doc_auto", label: "Commercial auto certificate", type: "document", docType: "auto" },
      { key: "doc_safety", label: "Safety program", type: "document", docType: "safety_program", showIf: { key: "has_safety_program", truthy: true } },
      { key: "doc_references", label: "References", type: "document", docType: "references" },
      { key: "doc_portfolio", label: "Portfolio or project photos", type: "document", docType: "portfolio" },
    ],
  },
  {
    key: "experience",
    title: "Experience and references",
    fields: [
      { key: "similar_projects", label: "Recent projects like ours", type: "textarea" },
      { key: "gc_references", label: "General contractors or builders you work with", type: "textarea" },
      { key: "reference_contacts", label: "Reference contacts", type: "textarea", help: "Name, company, phone or email — one per line." },
      { key: "largest_project", label: "Largest comparable project completed", type: "text" },
      { key: "disputes", label: "Any disputes, claims, or terminations in the last five years?", type: "textarea", help: "If none, say none. We'd rather hear it here." },
      { key: "why_cmi", label: "What makes a project run well from your side?", type: "textarea" },
    ],
  },
  {
    key: "attestation",
    title: "Confirm and submit",
    fields: [
      {
        key: "attestation_body", label: "", type: "content",
        body: "By submitting, you confirm the information is accurate and complete to the best of your knowledge, that you're authorised to submit it for your company, and that CMI may verify your licence, insurance and references. Prequalification is not an offer of work or a contract.",
      },
      { key: "attestation_name", label: "Your full name", type: "text", required: true },
      { key: "attestation_title", label: "Your title", type: "text", required: true },
    ],
  },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

export type Answers = Record<string, unknown>;

const truthy = (v: unknown) => v === true || v === "yes" || v === "Yes";

/** Whether a conditional field should be on screen given the answers so far. */
export function isVisible(field: Field, answers: Answers): boolean {
  const cond = field.showIf;
  if (!cond) return true;
  const value = answers[cond.key];
  if (cond.truthy) return truthy(value);
  if (cond.equals !== undefined) return value === cond.equals;
  if (cond.includes !== undefined) return Array.isArray(value) && value.includes(cond.includes);
  return true;
}

export function visibleFields(section: Section, answers: Answers): Field[] {
  return section.fields.filter((f) => isVisible(f, answers));
}

const answered = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Percentage of the questions currently on screen that have an answer. */
export function progressOf(answers: Answers): number {
  let total = 0;
  let done = 0;
  for (const section of SECTIONS) {
    for (const field of visibleFields(section, answers)) {
      if (field.type === "content") continue;
      total += 1;
      if (answered(answers[field.key])) done += 1;
    }
  }
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

/** Required questions still unanswered, by section — drives "what's missing". */
export function missingRequired(answers: Answers): { section: string; field: Field }[] {
  const out: { section: string; field: Field }[] = [];
  for (const section of SECTIONS) {
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
]);

/**
 * Turn answers into a patch for the `companies` row — the step that makes a
 * submitted form searchable rather than a stored document.
 */
export function answersToCompany(answers: Answers): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const section of SECTIONS) {
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

/** Which documents this applicant actually needs, given their answers. */
export function requiredDocuments(answers: Answers): { docType: string; label: string }[] {
  const docs: { docType: string; label: string }[] = [];
  for (const section of SECTIONS) {
    for (const field of visibleFields(section, answers)) {
      if (field.type === "document" && field.docType) docs.push({ docType: field.docType, label: field.label });
    }
  }
  return docs;
}
