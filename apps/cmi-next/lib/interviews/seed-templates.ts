// The interview templates CMI starts with.
//
// A template is a Section[] — the same shape lib/prequal/form.ts defines — so
// the interview workspace renders it with the form engine that already exists:
// same conditional logic, same progress maths, same `mapsTo` pointing an
// answer at a column on `companies`.
//
// Where a question overlaps with the public prequalification form it reuses
// that form's `key`. That is what lets an interview say "already on file" and
// ask about the gaps instead of re-asking everything the partner has already
// typed.
import {
  BUSINESS_STRUCTURES, PRICING_METHODS, SERVICE_AREAS,
  type Section,
} from "@/lib/prequal/form";

export type SeedTemplate = {
  seed_key: string;
  name: string;
  description: string;
  contact_type: string;
  trade: string | null;
  duration_minutes: number;
  default_tags: string[];
  sections: Section[];
};

const YES_NO_DETAIL = (key: string, label: string, detail: string): Section["fields"] => [
  { key, label, type: "yesno" },
  { key: `${key}_detail`, label: detail, type: "textarea", showIf: { key, truthy: true } },
];

const DEMOLITION_CAPABILITIES = [
  "Residential demolition", "Commercial demolition", "Interior demolition",
  "Selective demolition", "Structural demolition", "Concrete demolition",
  "Saw cutting", "Pool demolition", "Site clearing", "Excavation", "Trenching",
  "Fire damage", "Water damage", "Tenant improvement demolition",
  "Whole-building demolition", "Other",
] as const;

const DEMOLITION_EQUIPMENT = [
  "Excavators", "Mini excavators", "Skid steers", "Breakers / hammers",
  "Saw-cutting equipment", "Dump trucks", "Trailers", "Dust-control equipment",
  "Skip loaders", "Concrete crushers",
] as const;

/** Sections A–O of the demolition questionnaire in the module spec. */
const DEMOLITION_SECTIONS: Section[] = [
  {
    key: "background",
    title: "Company background",
    description: "Confirm what we hold, and fill the gaps.",
    fields: [
      { key: "company_name", label: "Company name", type: "text", mapsTo: "name" },
      { key: "contact_role", label: "Contact title / role", type: "text" },
      { key: "company_phone", label: "Phone", type: "phone", mapsTo: "phone" },
      { key: "company_email", label: "Email", type: "email", mapsTo: "email" },
      { key: "website", label: "Website", type: "url", mapsTo: "website" },
      { key: "street_address", label: "Business address", type: "text", mapsTo: "street_address" },
      { key: "years_in_business", label: "How long has the company been in business?", type: "number", mapsTo: "years_in_business" },
      { key: "years_personal", label: "How long have you personally worked in demolition or construction?", type: "number" },
      { key: "business_structure", label: "How is the business structured?", type: "select", options: BUSINESS_STRUCTURES, mapsTo: "business_structure" },
      { key: "employee_count", label: "Approximate company size", type: "number", mapsTo: "employee_count" },
      { key: "demo_percentage", label: "What percentage of your work is demolition?", type: "number", help: "0–100" },
      { key: "other_services", label: "What other services does your company provide?", type: "textarea" },
    ],
  },
  {
    key: "licensing",
    title: "Licensing, insurance & compliance",
    fields: [
      { key: "licenses_held", label: "What contractor licenses do you currently hold?", type: "textarea" },
      { key: "license_number", label: "License number(s)", type: "text" },
      { key: "license_class", label: "License classification(s)", type: "text" },
      { key: "license_expires", label: "License expiration date", type: "date" },
      { key: "licensed_scope", label: "What demolition work are you licensed to perform?", type: "textarea" },
      { key: "has_gl", label: "General liability insurance?", type: "yesno" },
      { key: "gl_limit", label: "General liability coverage limits", type: "currency", showIf: { key: "has_gl", truthy: true } },
      { key: "has_wc", label: "Workers' compensation?", type: "yesno" },
      { key: "has_auto", label: "Commercial auto?", type: "yesno" },
      { key: "has_umbrella", label: "Umbrella coverage?", type: "yesno" },
      { key: "umbrella_limit", label: "Umbrella limit", type: "currency", showIf: { key: "has_umbrella", truthy: true } },
      { key: "can_provide_coi", label: "Can you provide a Certificate of Insurance?", type: "yesno" },
      { key: "can_name_additional_insured", label: "Can CMI be named as an additional insured?", type: "yesno" },
      { key: "knows_permitting", label: "Familiar with demolition permitting across the Valley?", type: "yesno" },
      { key: "license_restrictions", label: "Any licensing restrictions or limitations?", type: "textarea" },
    ],
  },
  {
    key: "workforce",
    title: "Employees & subcontractors",
    fields: [
      { key: "workforce_mix", label: "Do you primarily use W2 employees or subcontractors?", type: "select", options: ["Mostly W2", "Mostly subcontractors", "An even mix"] },
      { key: "w2_employee_count", label: "Number of W2 employees", type: "number", mapsTo: "w2_employee_count" },
      { key: "uses_subcontractors", label: "Do you use subcontractors?", type: "yesno", mapsTo: "uses_subcontractors" },
      { key: "subcontractor_count", label: "How many do you use regularly?", type: "number", mapsTo: "subcontractor_count", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "subcontracted_scope", label: "What portions of work are subcontracted?", type: "textarea", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "sub_qualification", label: "How are subcontractors qualified?", type: "textarea", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "sub_collects_coi", label: "Do you collect COIs from your subcontractors?", type: "yesno", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "sub_verifies_license", label: "Do you verify their licenses?", type: "yesno", showIf: { key: "uses_subcontractors", truthy: true } },
      { key: "in_house_positions", label: "Which positions do you keep in-house?", type: "textarea" },
      { key: "osha_trained", label: "Are crews OSHA trained?", type: "yesno", mapsTo: "osha_trained" },
      { key: "field_supervision", label: "Who supervises crews in the field?", type: "text" },
    ],
  },
  {
    key: "capabilities",
    title: "Demolition capabilities",
    fields: [
      { key: "demo_capabilities", label: "Select all that apply", type: "multiselect", options: DEMOLITION_CAPABILITIES, mapsTo: "capabilities" },
      { key: "specialty", label: "What work do you specialize in?", type: "textarea" },
      { key: "avoids", label: "What work do you prefer not to perform?", type: "textarea" },
      { key: "occupied_building", label: "Do you handle occupied-building demolition?", type: "yesno" },
      { key: "protects_remaining", label: "Can you protect areas that remain in place?", type: "yesno" },
      { key: "utility_shutoffs", label: "Do you coordinate utility shutoffs?", type: "yesno" },
      { key: "hazmat_coordination", label: "Do you handle hazardous-material coordination?", type: "yesno" },
      { key: "does_abatement", label: "Do you perform asbestos / lead / mold abatement?", type: "yesno" },
      { key: "abatement_partners", label: "If not, who do you typically partner with?", type: "textarea", showIf: { key: "does_abatement", equals: false } },
    ],
  },
  {
    key: "equipment",
    title: "Equipment",
    fields: [
      { key: "equipment_owned", label: "Equipment owned", type: "multiselect", options: DEMOLITION_EQUIPMENT, mapsTo: "equipment" },
      { key: "equipment_rented", label: "Equipment typically rented", type: "textarea" },
      { key: "equipment_other", label: "Anything else worth knowing about your fleet", type: "textarea" },
    ],
  },
  {
    key: "project_size",
    title: "Project size",
    fields: [
      { key: "typical_project_value", label: "Typical project value", type: "currency" },
      { key: "min_project_value", label: "Minimum project size", type: "currency", mapsTo: "min_project_value" },
      { key: "ideal_project_value", label: "Ideal project size", type: "currency", mapsTo: "ideal_project_value" },
      { key: "largest_completed", label: "Largest project completed", type: "currency" },
      { key: "max_project_value", label: "Largest you're comfortable with today", type: "currency", mapsTo: "max_project_value" },
      { key: "concurrent_capacity", label: "How many projects can you run at once?", type: "number", mapsTo: "concurrent_capacity" },
      { key: "ideal_project_type", label: "Ideal project type", type: "textarea" },
      { key: "ideal_duration", label: "Ideal project duration", type: "text" },
    ],
  },
  {
    key: "service_area",
    title: "Geographic service area",
    fields: [
      { key: "service_areas", label: "Where do you work?", type: "multiselect", options: SERVICE_AREAS, mapsTo: "service_areas" },
      { key: "preferred_areas", label: "Preferred cities / areas", type: "text" },
      { key: "avoided_areas", label: "Areas avoided", type: "text" },
      { key: "max_travel_miles", label: "Maximum travel distance (miles)", type: "number", mapsTo: "max_travel_miles" },
      ...YES_NO_DETAIL("travel_surcharge", "Travel surcharge?", "How is it calculated?"),
      ...YES_NO_DETAIL("mobilization_fee", "Mobilization fee?", "How much, and when does it apply?"),
      { key: "travels_outside_metro", label: "Willing to travel outside metro Phoenix for larger projects?", type: "yesno" },
    ],
  },
  {
    key: "pricing",
    title: "Estimating & pricing",
    fields: [
      { key: "pricing_methods", label: "Pricing methods", type: "multiselect", options: PRICING_METHODS, mapsTo: "pricing_methods" },
      { key: "estimates_from_plans", label: "Can you estimate directly from construction plans?", type: "yesno", mapsTo: "estimates_from_plans" },
      { key: "requires_site_walk", label: "Do you require a site walk?", type: "yesno", mapsTo: "requires_site_walk" },
      { key: "estimates_from_photos", label: "Can you estimate from photos or video?", type: "yesno" },
      { key: "bid_requirements", label: "What do you need from us for an accurate bid?", type: "textarea" },
      { key: "includes_dump_fees", label: "Are dump fees included?", type: "yesno" },
      { key: "includes_hauling", label: "Is hauling included?", type: "yesno" },
      { key: "includes_equipment", label: "Is equipment included?", type: "yesno" },
      { key: "includes_permits", label: "Are permits included?", type: "yesno" },
      { key: "includes_mobilization", label: "Is mobilization included?", type: "yesno" },
      { key: "unforeseen_conditions", label: "How are unforeseen conditions handled?", type: "textarea" },
      { key: "change_orders", label: "How are change orders handled?", type: "textarea" },
      { key: "bid_turnaround", label: "Typical bid turnaround time", type: "text" },
      { key: "payment_terms", label: "Typical payment terms", type: "text" },
      ...YES_NO_DETAIL("deposit_required", "Deposit required?", "How much?"),
      { key: "progress_billing", label: "Progress billing?", type: "yesno" },
      { key: "accepts_retainage", label: "Retainage accepted?", type: "yesno" },
    ],
  },
  {
    key: "scheduling",
    title: "Scheduling & capacity",
    fields: [
      { key: "current_workload", label: "Current workload", type: "textarea" },
      { key: "booked_out", label: "How far out are you currently booked?", type: "text" },
      { key: "mobilization_notice", label: "Typical mobilization notice", type: "text" },
      { key: "typical_duration", label: "Typical demolition duration", type: "text" },
      { key: "accelerated_schedules", label: "Can you support accelerated schedules?", type: "yesno" },
      { key: "weekend_work", label: "Weekend work?", type: "yesno" },
      { key: "night_work", label: "Night work?", type: "yesno" },
      { key: "emergency_work", label: "Emergency work?", type: "yesno" },
      { key: "schedule_comms", label: "How are schedule changes communicated?", type: "textarea" },
      { key: "scheduler", label: "Who handles scheduling?", type: "text" },
    ],
  },
  {
    key: "safety",
    title: "Jobsite operations & safety",
    fields: [
      { key: "jobsite_manager", label: "Who manages the jobsite?", type: "text" },
      { key: "has_safety_program", label: "Safety program in place?", type: "yesno", mapsTo: "has_safety_program" },
      { key: "toolbox_talks", label: "Toolbox talks?", type: "yesno" },
      { key: "dust_control", label: "Dust-control process", type: "textarea" },
      { key: "noise_control", label: "Noise-control process", type: "textarea" },
      { key: "protection_process", label: "Protecting finishes that remain", type: "textarea" },
      { key: "occupied_procedures", label: "Occupied-building procedures", type: "textarea" },
      { key: "utility_shutoff_process", label: "Utility shutoff process", type: "textarea" },
      { key: "daily_cleanup", label: "Daily cleanup process", type: "textarea" },
      { key: "incident_reporting", label: "Incident reporting procedure", type: "textarea" },
      ...YES_NO_DETAIL("safety_incidents", "Any significant safety incidents in the last three years?", "What happened, and what changed since?"),
    ],
  },
  {
    key: "cleanup",
    title: "Cleanup, hauling & recycling",
    fields: [
      { key: "handles_debris", label: "Do you handle debris removal?", type: "yesno" },
      { key: "owns_trucks", label: "Own trucks / dumpsters?", type: "yesno" },
      { key: "third_party_hauling", label: "Third-party hauling?", type: "yesno" },
      { key: "disposal_facilities", label: "Disposal facilities typically used", type: "textarea" },
      { key: "recycling", label: "Recycling practices", type: "textarea" },
      { key: "material_separation", label: "Material separation", type: "textarea" },
      { key: "salvage", label: "Salvage / reuse capabilities", type: "textarea" },
      { key: "site_condition", label: "Expected condition of site at completion", type: "textarea" },
    ],
  },
  {
    key: "communication",
    title: "Communication & project management",
    fields: [
      { key: "primary_contact", label: "Primary point of contact", type: "text" },
      { key: "estimator", label: "Estimator", type: "text" },
      { key: "project_manager", label: "Project manager", type: "text" },
      { key: "field_supervisor", label: "Field supervisor", type: "text" },
      { key: "preferred_channel", label: "Preferred communication method", type: "select", options: ["Phone", "Text", "Email", "Whatever's quickest"] },
      { key: "daily_updates", label: "Daily updates?", type: "yesno" },
      { key: "progress_photos", label: "Progress photos?", type: "yesno" },
      { key: "schedule_updates", label: "Schedule updates?", type: "yesno" },
      { key: "change_order_docs", label: "Change-order documentation process", type: "textarea" },
      { key: "invoicing_process", label: "Invoicing process", type: "textarea" },
      { key: "emergency_contact", label: "Emergency contact", type: "text" },
    ],
  },
  {
    key: "experience",
    title: "Experience & references",
    fields: [
      { key: "similar_projects", label: "Similar projects completed", type: "textarea" },
      { key: "gcs_worked_with", label: "General contractors and builders you work with", type: "textarea" },
      { key: "references", label: "References", type: "textarea", help: "Name, company, phone — one per line." },
      { key: "largest_comparable", label: "Largest comparable project", type: "textarea" },
      ...YES_NO_DETAIL("disputes", "Any significant disputes?", "Tell us what happened."),
      ...YES_NO_DETAIL("insurance_claims", "Any insurance claims?", "Tell us what happened."),
      ...YES_NO_DETAIL("litigation", "Any litigation related to projects?", "Tell us what happened."),
      ...YES_NO_DETAIL("terminations", "Any terminations for cause?", "Tell us what happened."),
    ],
  },
  {
    key: "fit",
    title: "Relationship fit",
    description: "The part that decides whether this is worth doing again.",
    fields: [
      { key: "wants_projects", label: "What projects would you most like us to send you?", type: "textarea" },
      { key: "avoid_projects", label: "What should we not send you?", type: "textarea" },
      { key: "runs_smoothly", label: "What makes a project run smoothly, from your side?", type: "textarea" },
      { key: "needs_from_cmi", label: "What do you need from us before starting?", type: "textarea" },
      { key: "precon_problems", label: "What problems could we prevent during preconstruction?", type: "textarea" },
      { key: "wants_preferred", label: "Interested in becoming a preferred trade partner?", type: "yesno" },
      { key: "most_profitable", label: "What work is most profitable and efficient for you?", type: "textarea" },
      { key: "differentiator", label: "What sets you apart from other demolition contractors?", type: "textarea" },
    ],
  },
];

/** Section O — the interviewer's own read. Never shown to the partner. */
export const CLOSING_SECTION: Section = {
  key: "closing",
  title: "Final notes",
  description: "Internal only. This never leaves CMI.",
  fields: [
    { key: "strengths", label: "Strengths", type: "textarea" },
    { key: "concerns", label: "Concerns", type: "textarea" },
    { key: "follow_up_needed", label: "Required follow-up", type: "textarea" },
    { key: "documents_needed", label: "Documents needed", type: "textarea" },
    { key: "recommended_next_step", label: "Recommended next step", type: "select", options: [
      "Approve as a trade partner", "Request documents, then approve", "Second interview",
      "Keep on file, no current fit", "Not moving forward",
    ] },
    { key: "internal_comments", label: "Internal-only comments", type: "textarea" },
  ],
};

/** A short template for trades with no specific questionnaire yet. */
const GENERAL_SECTIONS: Section[] = [
  {
    key: "background",
    title: "Company background",
    fields: [
      { key: "company_name", label: "Company name", type: "text", mapsTo: "name" },
      { key: "contact_role", label: "Contact title / role", type: "text" },
      { key: "company_phone", label: "Phone", type: "phone", mapsTo: "phone" },
      { key: "company_email", label: "Email", type: "email", mapsTo: "email" },
      { key: "years_in_business", label: "Years in business", type: "number", mapsTo: "years_in_business" },
      { key: "business_structure", label: "Business structure", type: "select", options: BUSINESS_STRUCTURES, mapsTo: "business_structure" },
      { key: "employee_count", label: "Approximate company size", type: "number", mapsTo: "employee_count" },
    ],
  },
  {
    key: "licensing",
    title: "Licensing & insurance",
    fields: [
      { key: "license_number", label: "License number", type: "text" },
      { key: "license_expires", label: "License expiration", type: "date" },
      { key: "has_gl", label: "General liability insurance?", type: "yesno" },
      { key: "gl_limit", label: "General liability limit", type: "currency", showIf: { key: "has_gl", truthy: true } },
      { key: "has_wc", label: "Workers' compensation?", type: "yesno" },
      { key: "can_name_additional_insured", label: "Can CMI be named as an additional insured?", type: "yesno" },
    ],
  },
  {
    key: "work",
    title: "What you do, and where",
    fields: [
      { key: "service_areas", label: "Service areas", type: "multiselect", options: SERVICE_AREAS, mapsTo: "service_areas" },
      { key: "max_travel_miles", label: "Maximum travel (miles)", type: "number", mapsTo: "max_travel_miles" },
      { key: "specialty", label: "What do you specialize in?", type: "textarea" },
      { key: "avoids", label: "What do you prefer not to take on?", type: "textarea" },
      { key: "min_project_value", label: "Minimum project", type: "currency", mapsTo: "min_project_value" },
      { key: "ideal_project_value", label: "Ideal project size", type: "currency", mapsTo: "ideal_project_value" },
      { key: "max_project_value", label: "Largest you're comfortable with", type: "currency", mapsTo: "max_project_value" },
      { key: "concurrent_capacity", label: "Projects at once", type: "number", mapsTo: "concurrent_capacity" },
    ],
  },
  {
    key: "pricing",
    title: "Pricing & scheduling",
    fields: [
      { key: "pricing_methods", label: "Pricing methods", type: "multiselect", options: PRICING_METHODS, mapsTo: "pricing_methods" },
      { key: "estimates_from_plans", label: "Can you estimate from plans?", type: "yesno", mapsTo: "estimates_from_plans" },
      { key: "requires_site_walk", label: "Do you require a site walk?", type: "yesno", mapsTo: "requires_site_walk" },
      { key: "bid_turnaround", label: "Typical bid turnaround", type: "text" },
      { key: "payment_terms", label: "Typical payment terms", type: "text" },
      { key: "booked_out", label: "How far out are you booked?", type: "text" },
      { key: "mobilization_notice", label: "Notice you need to mobilise", type: "text" },
    ],
  },
  {
    key: "fit",
    title: "Relationship fit",
    fields: [
      { key: "wants_projects", label: "What work would you most like from us?", type: "textarea" },
      { key: "needs_from_cmi", label: "What do you need from us before starting?", type: "textarea" },
      { key: "differentiator", label: "What sets you apart?", type: "textarea" },
      { key: "references", label: "References", type: "textarea" },
    ],
  },
];

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    seed_key: "demolition_contractor",
    name: "Demolition Contractor",
    description: "The full demolition questionnaire — capabilities, equipment, disposal, safety and fit.",
    contact_type: "Subcontractor",
    trade: "Demolition",
    duration_minutes: 45,
    default_tags: ["Demolition"],
    sections: [...DEMOLITION_SECTIONS, CLOSING_SECTION],
  },
  {
    seed_key: "general_partner_qualification",
    name: "General Partner Qualification",
    description: "A shorter interview for any trade without its own template yet.",
    contact_type: "Subcontractor",
    trade: null,
    duration_minutes: 30,
    default_tags: [],
    sections: [...GENERAL_SECTIONS, CLOSING_SECTION],
  },
];
