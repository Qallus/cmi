// Prequalification applications.
//
// An applicant has no account, so a draft is addressed by an unguessable
// token they can come back to. On submit the answers stop being a document:
// the company and contact records are created or matched, the structured
// fields land on the company, and the documents they owe become tracked
// compliance rows.
import { randomBytes } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { findOrCreateCompany, type Company } from "@/lib/companies/data";
import { findDuplicateContacts } from "@/lib/contacts/duplicates";
import {
  FORM_VERSION, answersToCompany, missingRequired, progressOf, requiredDocuments,
  type Answers,
} from "./form";

export type ApplicationStatus =
  | "draft" | "submitted" | "in_review" | "info_requested"
  | "interview" | "approved" | "declined" | "withdrawn" | "expired";

export type Application = {
  id: string;
  token: string;
  company_id: string | null;
  contact_id: string | null;
  status: ApplicationStatus;
  partner_type: string | null;
  company_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_title: string | null;
  answers: Answers;
  form_version: string;
  progress: number;
  current_step: string | null;
  submitted_at: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  decision: string | null;
  decision_reason: string | null;
  attestation_name: string | null;
  attestation_title: string | null;
  attestation_at: string | null;
  ip: string | null;
  created_at: string;
  updated_at: string;
};

export class PrequalError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export type Audit = { sourceUrl?: string | null; ip?: string | null; userAgent?: string | null };

/** 32 hex characters — long enough that the link is the credential. */
function newToken(): string {
  return randomBytes(16).toString("hex");
}

export async function startApplication(audit: Audit = {}): Promise<Application> {
  const { data, error } = await getSupabaseAdmin()
    .from("prequal_applications")
    .insert({
      token: newToken(),
      form_version: FORM_VERSION,
      source: "public_page",
      source_url: audit.sourceUrl ?? null,
      ip: audit.ip ?? null,
      user_agent: audit.userAgent?.slice(0, 500) ?? null,
      last_seen_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new PrequalError(error.message, 500);
  return data as Application;
}

export async function getByToken(token: string): Promise<Application | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("prequal_applications").select("*").eq("token", token).maybeSingle();
  if (error) throw new PrequalError(error.message, 500);
  return (data as Application) ?? null;
}

/** Autosave. Refuses to touch an application that's already been submitted. */
export async function saveAnswers(
  token: string,
  answers: Answers,
  step?: string | null,
): Promise<{ progress: number }> {
  const current = await getByToken(token);
  if (!current) throw new PrequalError("That application link is no longer valid.", 404);
  if (current.status !== "draft") throw new PrequalError("This application has already been submitted.", 409);

  const merged = { ...current.answers, ...answers };
  const progress = progressOf(merged);

  const { error } = await getSupabaseAdmin()
    .from("prequal_applications")
    .update({
      answers: merged,
      progress,
      current_step: step ?? current.current_step,
      // Denormalised so staff can see who's applying before they submit.
      company_name: (merged.company_name as string) ?? current.company_name,
      contact_first_name: (merged.contact_first_name as string) ?? current.contact_first_name,
      contact_last_name: (merged.contact_last_name as string) ?? current.contact_last_name,
      contact_email: (merged.contact_email as string) ?? current.contact_email,
      contact_phone: (merged.contact_phone as string) ?? current.contact_phone,
      contact_title: (merged.contact_title as string) ?? current.contact_title,
      partner_type: (merged.partner_type as string) ?? current.partner_type,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.id);
  if (error) throw new PrequalError(error.message, 500);

  return { progress };
}

/**
 * Submit: match or create the company and contact, promote the structured
 * fields onto the company, and open a compliance row for every document this
 * applicant owes.
 */
export async function submitApplication(token: string, audit: Audit = {}): Promise<Application> {
  const supabase = getSupabaseAdmin();
  const app = await getByToken(token);
  if (!app) throw new PrequalError("That application link is no longer valid.", 404);
  if (app.status !== "draft") throw new PrequalError("This application has already been submitted.", 409);

  const answers = app.answers ?? {};
  const missing = missingRequired(answers);
  if (missing.length > 0) {
    throw new PrequalError(
      `Still needed: ${missing.slice(0, 4).map((m) => m.field.label).join(", ")}${missing.length > 4 ? ` and ${missing.length - 4} more` : ""}.`,
    );
  }

  const companyName = String(answers.company_name ?? "").trim();
  if (!companyName) throw new PrequalError("A company name is required.");

  // The company gets everything the form maps to a column, so the profile is
  // searchable the moment it lands.
  const company = await findOrCreateCompany(companyName, {
    ...(answersToCompany(answers) as Partial<Company>),
    qualification_status: "applicant",
  });

  const contactId = await linkContact(app, answers, company.id);
  await openDocumentRows(company.id, app.id, answers);

  const { data, error } = await supabase
    .from("prequal_applications")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      company_id: company.id,
      contact_id: contactId,
      progress: progressOf(answers),
      attestation_name: (answers.attestation_name as string) ?? null,
      attestation_title: (answers.attestation_title as string) ?? null,
      attestation_at: new Date().toISOString(),
      ip: audit.ip ?? app.ip,
      user_agent: audit.userAgent?.slice(0, 500) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", app.id)
    .select()
    .single();
  if (error) throw new PrequalError(error.message, 500);

  return data as Application;
}

/**
 * Attach the applicant to a contact record, reusing an existing one rather
 * than adding another duplicate — the email index would reject an exact
 * repeat anyway, and a second record for a known person helps nobody.
 */
async function linkContact(app: Application, answers: Answers, companyId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const email = String(answers.contact_email ?? "").trim().toLowerCase();
  const first = String(answers.contact_first_name ?? "").trim();
  const last = String(answers.contact_last_name ?? "").trim();
  if (!email || !first) return null;

  const matches = await findDuplicateContacts({ first, last, email, phone: String(answers.contact_phone ?? "") });
  const exact = matches.find((m) => m.score >= 100) ?? matches.find((m) => m.score >= 90);

  if (exact) {
    await supabase
      .from("contacts")
      .update({
        company_id: companyId,
        company: String(answers.company_name ?? ""),
        phone: (answers.contact_phone as string) || null,
        last_activity: new Date().toISOString(),
      })
      .eq("id", exact.id);
    return exact.id;
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      first_name: first,
      last_name: last || first,
      email,
      phone: (answers.contact_phone as string) || null,
      company: String(answers.company_name ?? ""),
      company_id: companyId,
      type: partnerTypeToContactType(String(answers.partner_type ?? "")),
      status: "active",
      source: "Prequalification",
      tags: ["prequalification"],
      last_activity: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return null;      // never lose a submission over the CRM link
  return (data as { id: string }).id;
}

/** The form's partner types onto the contacts_type_check values. */
function partnerTypeToContactType(partnerType: string): string {
  switch (partnerType) {
    case "Subcontractor": return "Sub Contractor";
    case "Vendor":
    case "Supplier": return "Vendor";
    case "Designer":
    case "Architect": return "Designer";
    default: return "Other";
  }
}

/**
 * One compliance row per document this applicant owes, whether or not they
 * uploaded it — that's what makes "missing documentation" reportable.
 */
async function openDocumentRows(companyId: string, applicationId: string, answers: Answers): Promise<void> {
  const supabase = getSupabaseAdmin();
  const wanted = requiredDocuments(answers);
  if (wanted.length === 0) return;

  const { data: existing } = await supabase
    .from("company_documents")
    .select("doc_type")
    .eq("company_id", companyId)
    .in("doc_type", wanted.map((d) => d.docType));
  const have = new Set((existing ?? []).map((r) => (r as { doc_type: string }).doc_type));

  const rows = wanted
    .filter((d) => !have.has(d.docType))
    .map((d) => {
      // The public upload route answers with a storage `path`; the Cloud file
      // manager would give a `file_id`. Either counts as uploaded.
      const uploaded = answers[`doc_${d.docType}`] as
        { file_id?: string; name?: string; url?: string; path?: string } | undefined;
      const hasFile = !!(uploaded?.file_id || uploaded?.url || uploaded?.path);
      return {
        company_id: companyId,
        application_id: applicationId,
        doc_type: d.docType,
        label: d.label,
        file_id: uploaded?.file_id ?? null,
        file_name: uploaded?.name ?? null,
        // The storage key, not a public URL — reads go through a signed link.
        file_url: uploaded?.url ?? uploaded?.path ?? null,
        status: hasFile ? "uploaded" : "requested",
        requested_at: new Date().toISOString(),
        uploaded_at: hasFile ? new Date().toISOString() : null,
        // Dates the applicant typed alongside the upload.
        expires_on: expiryFor(d.docType, answers),
        license_number: d.docType === "license" ? (answers.license_number as string) ?? null : null,
        license_class: d.docType === "license" ? (answers.license_class as string) ?? null : null,
        license_state: d.docType === "license" ? (answers.license_state as string) ?? null : null,
        carrier: carrierFor(d.docType, answers),
      };
    });

  if (rows.length > 0) await supabase.from("company_documents").insert(rows);
}

function expiryFor(docType: string, a: Answers): string | null {
  const key = { license: "license_expires", gl: "gl_expires", coi: "gl_expires", wc: "wc_expires", auto: "auto_expires" }[docType];
  const value = key ? a[key] : null;
  return typeof value === "string" && value ? value : null;
}

function carrierFor(docType: string, a: Answers): string | null {
  const key = { gl: "gl_carrier", coi: "gl_carrier", wc: "wc_carrier", auto: "auto_carrier" }[docType];
  const value = key ? a[key] : null;
  return typeof value === "string" && value ? value : null;
}
