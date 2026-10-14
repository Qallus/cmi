// Import/export field definitions for Pre-Con (pipeline_opportunities) and
// Jobs. One list per record type drives the CSV export columns, CSV header
// matching on import, the downloadable template, and the schema Bolt is given
// when it reads free-text (.txt) job files. Client-safe: no server imports.
import { ALL_STAGES, STAGE_META } from "@/lib/pipeline/stages";
import { PROJECT_TYPES } from "@/lib/pipeline/types";
import { ALL_JOB_STATUSES, JOB_STATUS_META } from "@/lib/jobs/status";

export type RecordTarget = "precon" | "jobs";
export type FieldKind = "text" | "longtext" | "number" | "date" | "enum";

export type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  options?: readonly string[];
  /** Extra header spellings accepted on import (matched case/punctuation-insensitively). */
  aliases?: string[];
  /** Short guidance for Bolt when reading free text. */
  hint?: string;
};

export const TARGET_LABEL: Record<RecordTarget, string> = { precon: "Pre-Con", jobs: "Job" };

// Client fields are shared: on import they find-or-create a contact and link it.
const CLIENT_FIELDS: FieldSpec[] = [
  { key: "client_name", label: "Client Name", kind: "text", aliases: ["client", "customer", "homeowner", "owner name"], hint: "Primary client's full name" },
  { key: "client_email", label: "Client Email", kind: "text", aliases: ["email", "customer email"] },
  { key: "client_phone", label: "Client Phone", kind: "text", aliases: ["phone", "customer phone"] },
];

export const PRECON_FIELDS: FieldSpec[] = [
  { key: "opportunity_name", label: "Opportunity Name", kind: "text", required: true, aliases: ["name", "project", "project name", "job name", "opportunity"] },
  { key: "job_number", label: "Job #", kind: "text", aliases: ["job number", "number", "lead number"], hint: "Existing CMI number like 26_030, if stated" },
  { key: "stage", label: "Stage", kind: "enum", options: ALL_STAGES, aliases: ["status", "pipeline stage"] },
  { key: "project_type", label: "Project Type", kind: "enum", options: PROJECT_TYPES, aliases: ["type", "job type"] },
  { key: "project_address", label: "Project Address", kind: "text", aliases: ["address", "street", "street address"], hint: "Street line only" },
  { key: "city", label: "City", kind: "text" },
  { key: "state", label: "State", kind: "text", hint: "Two-letter code" },
  { key: "zip_code", label: "Zip", kind: "text", aliases: ["zip code", "postal code"] },
  ...CLIENT_FIELDS,
  { key: "estimated_budget_range", label: "Budget Range", kind: "text", aliases: ["budget range"] },
  { key: "estimated_project_value", label: "Estimated Value", kind: "number", aliases: ["estimated project value", "value", "budget", "estimate"] },
  { key: "probability_percent", label: "Probability %", kind: "number", aliases: ["probability"] },
  { key: "contract_value", label: "Contract Value", kind: "number" },
  { key: "source", label: "Source", kind: "text", aliases: ["lead source"] },
  { key: "referral_source", label: "Referral Source", kind: "text", aliases: ["referral", "referred by"] },
  { key: "assigned_owner", label: "Assigned Owner", kind: "text", aliases: ["owner", "salesperson"], hint: "CMI staff member who owns it" },
  { key: "architect", label: "Architect", kind: "text" },
  { key: "designer", label: "Designer", kind: "text" },
  { key: "engineer", label: "Engineer", kind: "text" },
  { key: "projected_construction_start_date", label: "Projected Construction Start", kind: "date", aliases: ["start date", "projected start", "construction start"] },
  { key: "projected_completion_date", label: "Projected Completion", kind: "date", aliases: ["completion date", "projected completion date", "end date"] },
  { key: "notes", label: "Scope / Notes", kind: "longtext", aliases: ["scope", "description", "notes", "status notes"], hint: "Scope, status and follow-up notes, kept close to the original wording" },
];

export const JOB_FIELDS: FieldSpec[] = [
  { key: "job_name", label: "Job Name", kind: "text", required: true, aliases: ["name", "job", "project", "project name"] },
  { key: "job_number", label: "Job #", kind: "text", aliases: ["job number", "number"], hint: "Existing CMI number like 25_062, if stated" },
  { key: "status", label: "Status", kind: "enum", options: ALL_JOB_STATUSES, aliases: ["stage", "job status"] },
  { key: "job_type", label: "Job Type", kind: "text", aliases: ["type"], hint: "e.g. Residential, Commercial" },
  { key: "contract_type", label: "Contract Type", kind: "enum", options: ["fixed_price", "open_book"] },
  { key: "contract_price", label: "Contract Price", kind: "number", aliases: ["contract value", "price", "value", "contract amount"] },
  { key: "street_address", label: "Street Address", kind: "text", aliases: ["address", "street", "project address"], hint: "Street line only" },
  { key: "city", label: "City", kind: "text" },
  { key: "state", label: "State", kind: "text", hint: "Two-letter code" },
  { key: "zip_code", label: "Zip", kind: "text", aliases: ["zip code", "postal code"] },
  ...CLIENT_FIELDS,
  { key: "project_manager", label: "Project Manager", kind: "text", aliases: ["pm"] },
  { key: "superintendent", label: "Superintendent", kind: "text", aliases: ["super"] },
  { key: "projected_start_date", label: "Projected Start", kind: "date", aliases: ["start date", "start"] },
  { key: "projected_completion_date", label: "Projected Completion", kind: "date", aliases: ["completion date", "end date", "completion"] },
  { key: "actual_start_date", label: "Actual Start", kind: "date" },
  { key: "actual_completion_date", label: "Actual Completion", kind: "date" },
  { key: "square_feet", label: "Square Feet", kind: "number", aliases: ["sqft", "sq ft", "square footage"] },
  { key: "permit_number", label: "Permit #", kind: "text", aliases: ["permit", "permit number"] },
  { key: "lot_info", label: "Lot Info", kind: "text", aliases: ["lot"] },
  { key: "internal_notes", label: "Internal Notes", kind: "longtext", aliases: ["notes", "scope", "description"], hint: "Scope, status and follow-up notes, kept close to the original wording" },
  { key: "vendor_notes", label: "Vendor Notes", kind: "longtext" },
];

export const FIELDS: Record<RecordTarget, FieldSpec[]> = { precon: PRECON_FIELDS, jobs: JOB_FIELDS };
export const NAME_KEY: Record<RecordTarget, string> = { precon: "opportunity_name", jobs: "job_name" };

// ─── Header matching ──────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map CSV headers to field keys. Unmatched headers come back in `unmatched`. */
export function matchHeaders(headers: string[], target: RecordTarget): { keys: (string | null)[]; unmatched: string[] } {
  const lookup = new Map<string, string>();
  for (const f of FIELDS[target]) {
    for (const s of [f.key, f.label, ...(f.aliases ?? [])]) if (!lookup.has(norm(s))) lookup.set(norm(s), f.key);
  }
  const used = new Set<string>();
  const unmatched: string[] = [];
  const keys = headers.map((h) => {
    const k = lookup.get(norm(h));
    if (!k || used.has(k)) { if (h.trim()) unmatched.push(h); return null; }
    used.add(k);
    return k;
  });
  return { keys, unmatched };
}

// ─── Value coercion (used client-side for preview, server-side as the authority) ──
const ENUM_ALIASES: Record<string, string> = {
  precon: "pre_construction_design", pre_con: "pre_construction_design", pre_construction: "pre_construction_design",
  design: "pre_construction_design", budget: "active_budget", active: "active_project", in_progress: "active_project",
  lead: "opportunity", complete: "closed", completed: "closed", lost: "not_moving_forward",
  fixed: "fixed_price", cost_plus: "open_book", open: "open_book",
};
const LABELS: Record<string, string> = {
  ...Object.fromEntries(ALL_STAGES.map((s) => [norm(STAGE_META[s].label), s])),
  ...Object.fromEntries(ALL_JOB_STATUSES.map((s) => [norm(JOB_STATUS_META[s].label), s])),
};

function toEnum(raw: string, options: readonly string[]): string | null {
  const slug = raw.trim().toLowerCase().replace(/[\s/-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  const candidates = [slug, ENUM_ALIASES[slug], LABELS[norm(raw)]];
  return candidates.find((c) => c && options.includes(c)) ?? null;
}

function toNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/[$,\s%]/g, "");
  const m = s.match(/^(-?\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
}

function toDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    const y = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${y}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/** Clean one raw record into typed fields. Blank values are dropped. */
export function coerceRecord(raw: Record<string, unknown>, target: RecordTarget): { fields: Record<string, unknown>; warnings: string[] } {
  const fields: Record<string, unknown> = {};
  const warnings: string[] = [];
  for (const f of FIELDS[target]) {
    const v = raw[f.key];
    if (v === null || v === undefined) continue;
    const s = typeof v === "string" ? v.trim() : String(v);
    if (!s) continue;
    if (f.kind === "number") {
      const n = typeof v === "number" ? v : toNumber(s);
      if (n === null) warnings.push(`${f.label}: "${s}" isn't a number — skipped`); else fields[f.key] = n;
    } else if (f.kind === "date") {
      const d = toDate(s);
      if (!d) warnings.push(`${f.label}: "${s}" isn't a date — skipped`); else fields[f.key] = d;
    } else if (f.kind === "enum") {
      const e = toEnum(s, f.options ?? []);
      if (!e) warnings.push(`${f.label}: "${s}" not recognized — skipped`); else fields[f.key] = e;
    } else {
      fields[f.key] = s;
    }
  }
  if (!fields[NAME_KEY[target]]) warnings.push(`${FIELDS[target][0].label} is required`);
  return { fields, warnings };
}

// ─── Moving a record between Pre-Con and Jobs ─────────────────
const PRECON_TO_JOB: Record<string, string> = {
  opportunity_name: "job_name", project_address: "street_address", notes: "internal_notes",
  stage: "status", projected_construction_start_date: "projected_start_date",
};

/** Re-key a record's fields when the user switches its destination. */
export function translateFields(fields: Record<string, unknown>, from: RecordTarget, to: RecordTarget): Record<string, unknown> {
  if (from === to) return fields;
  const map = from === "precon" ? PRECON_TO_JOB : Object.fromEntries(Object.entries(PRECON_TO_JOB).map(([a, b]) => [b, a]));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[map[k] ?? k] = v;
  // Money lives in different columns on each side.
  if (to === "jobs" && out.contract_price == null) out.contract_price = fields.contract_value ?? fields.estimated_project_value;
  if (to === "precon" && out.estimated_project_value == null) out.estimated_project_value = fields.contract_price;
  const known = new Set(FIELDS[to].map((f) => f.key));
  for (const k of Object.keys(out)) if (!known.has(k) || out[k] == null) delete out[k];
  return out;
}

// CMI numbers look like 26_030. A name that starts with one ("26_030_Lillie
// Residence") carries its number; split it off so it isn't doubled.
export const CMI_NUMBER = /^(\d{2}_\d{3})(?:[_\s-]+|$)/;
