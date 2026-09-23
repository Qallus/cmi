// The internal side: the application queue, what a reviewer sees, document
// verification, and the decision that turns an applicant into a trade partner.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { updateCompany, type Company } from "@/lib/companies/data";
import { SECTIONS, visibleFields, type Answers, type Field } from "./form";
import { PrequalError, type Application, type ApplicationStatus } from "./data";

export type CompanyDocument = {
  id: string;
  company_id: string;
  application_id: string | null;
  doc_type: string;
  label: string | null;
  file_id: string | null;
  file_name: string | null;
  file_url: string | null;
  status: "requested" | "uploaded" | "in_review" | "verified" | "rejected" | "expired";
  issued_on: string | null;
  expires_on: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  carrier: string | null;
  policy_number: string | null;
  coverage_amount: number | null;
  license_number: string | null;
  license_class: string | null;
  license_state: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = Application & {
  company_name_resolved: string | null;
  reviewer_name: string | null;
  docs_total: number;
  docs_outstanding: number;
};

const OPEN_STATUSES: ApplicationStatus[] = ["submitted", "in_review", "info_requested", "interview"];

/** The queue. Open applications first, oldest submission at the top. */
export async function listApplications(opts: { status?: string; includeClosed?: boolean } = {}): Promise<ApplicationRow[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("prequal_applications")
    .select("*, companies(name), staff_users!prequal_applications_reviewer_id_fkey(display_name, email)")
    .order("submitted_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  else if (!opts.includeClosed) query = query.in("status", [...OPEN_STATUSES, "draft"]);

  const { data, error } = await query;
  if (error) throw new PrequalError(error.message, 500);

  const rows = (data ?? []) as unknown as (Application & {
    companies: { name: string } | null;
    staff_users: { display_name: string | null; email: string | null } | null;
  })[];

  const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))] as string[];
  const docCounts = await outstandingByCompany(companyIds);

  return rows.map((r) => ({
    ...r,
    companies: undefined as never,
    staff_users: undefined as never,
    company_name_resolved: r.companies?.name ?? r.company_name,
    reviewer_name: r.staff_users?.display_name || r.staff_users?.email || null,
    docs_total: docCounts.get(r.company_id ?? "")?.total ?? 0,
    docs_outstanding: docCounts.get(r.company_id ?? "")?.outstanding ?? 0,
  })) as ApplicationRow[];
}

async function outstandingByCompany(ids: string[]): Promise<Map<string, { total: number; outstanding: number }>> {
  const out = new Map<string, { total: number; outstanding: number }>();
  if (ids.length === 0) return out;
  const { data } = await getSupabaseAdmin()
    .from("company_documents").select("company_id, status").in("company_id", ids);
  for (const row of (data ?? []) as { company_id: string; status: string }[]) {
    const entry = out.get(row.company_id) ?? { total: 0, outstanding: 0 };
    entry.total += 1;
    if (row.status !== "verified") entry.outstanding += 1;
    out.set(row.company_id, entry);
  }
  return out;
}

export type AnswerGroup = { title: string; rows: { label: string; value: string; key: string }[] };

export type ApplicationDetail = {
  application: Application;
  company: Company | null;
  documents: CompanyDocument[];
  /** The submitted answers, laid out the way the form asked them. */
  groups: AnswerGroup[];
  /** What a reviewer should chase: unanswered, missing or expiring. */
  gaps: { kind: "missing_answer" | "missing_document" | "expiring" | "expired" | "rejected"; label: string; detail?: string }[];
};

export async function getApplicationDetail(id: string): Promise<ApplicationDetail | null> {
  const supabase = getSupabaseAdmin();
  const { data: app } = await supabase.from("prequal_applications").select("*").eq("id", id).maybeSingle();
  if (!app) return null;
  const application = app as Application;

  const [companyRes, docsRes] = await Promise.all([
    application.company_id
      ? supabase.from("companies").select("*").eq("id", application.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    application.company_id
      ? supabase.from("company_documents").select("*").eq("company_id", application.company_id).order("doc_type")
      : Promise.resolve({ data: [] }),
  ]);

  const company = (companyRes.data as Company) ?? null;
  const documents = (docsRes.data ?? []) as CompanyDocument[];
  const answers = (application.answers ?? {}) as Answers;

  return {
    application,
    company,
    documents,
    groups: groupAnswers(answers),
    gaps: findGaps(answers, documents),
  };
}

function display(field: Field, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const doc = value as { name?: string };
    return doc.name ?? "Uploaded";
  }
  if (field.type === "currency") {
    const n = Number(value);
    return Number.isFinite(n) ? `$${n.toLocaleString("en-US")}` : String(value);
  }
  return String(value);
}

/** Answers, in the order the form asked them, skipping anything unanswered. */
function groupAnswers(answers: Answers): AnswerGroup[] {
  const groups: AnswerGroup[] = [];
  for (const section of SECTIONS) {
    const rows = visibleFields(section, answers)
      .filter((f) => f.type !== "content" && f.type !== "document")
      .map((f) => ({ key: f.key, label: f.label, value: display(f, answers[f.key]) }))
      .filter((r) => r.value !== "");
    if (rows.length > 0) groups.push({ title: section.title, rows });
  }
  return groups;
}

const SOON_DAYS = 60;

/**
 * What to chase. This is the list the interview should be built from — ask
 * about what's missing or stale, not about what's already on file.
 */
function findGaps(answers: Answers, documents: CompanyDocument[]): ApplicationDetail["gaps"] {
  const gaps: ApplicationDetail["gaps"] = [];

  for (const section of SECTIONS) {
    for (const field of visibleFields(section, answers)) {
      if (field.type === "content" || field.type === "document") continue;
      const v = answers[field.key];
      const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) gaps.push({ kind: "missing_answer", label: field.label, detail: section.title });
    }
  }

  const today = new Date();
  const soon = new Date(today.getTime() + SOON_DAYS * 86_400_000).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);

  for (const doc of documents) {
    const name = doc.label ?? doc.doc_type;
    if (doc.status === "requested") gaps.push({ kind: "missing_document", label: name });
    else if (doc.status === "rejected") gaps.push({ kind: "rejected", label: name, detail: doc.rejection_reason ?? undefined });
    else if (doc.expires_on && doc.expires_on < todayIso) gaps.push({ kind: "expired", label: name, detail: `expired ${doc.expires_on}` });
    else if (doc.expires_on && doc.expires_on <= soon) gaps.push({ kind: "expiring", label: name, detail: `expires ${doc.expires_on}` });
  }

  return gaps;
}

// ─── Reviewer actions ──────────────────────────────────────────────────────

const ALLOWED: ApplicationStatus[] = ["submitted", "in_review", "info_requested", "interview", "approved", "declined", "withdrawn"];

/** Company status follows the application, so one lives where the other does. */
const COMPANY_STATUS: Partial<Record<ApplicationStatus, Company["qualification_status"]>> = {
  submitted: "applicant",
  in_review: "in_review",
  info_requested: "info_requested",
  interview: "interview",
  approved: "approved",
  declined: "declined",
};

export async function setApplicationStatus(
  id: string,
  status: ApplicationStatus,
  opts: { reason?: string | null; actorId?: string | null } = {},
): Promise<Application> {
  if (!ALLOWED.includes(status)) throw new PrequalError("That isn't a status an application can be moved to.");
  const supabase = getSupabaseAdmin();

  const patch: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (status === "approved" || status === "declined") {
    patch.decision = status;
    patch.decision_reason = opts.reason ?? null;
  }

  const { data, error } = await supabase
    .from("prequal_applications").update(patch).eq("id", id).select().single();
  if (error) throw new PrequalError(error.message, 500);
  const application = data as Application;

  const companyStatus = COMPANY_STATUS[status];
  if (application.company_id && companyStatus) {
    await updateCompany(application.company_id, {
      qualification_status: companyStatus,
      ...(status === "approved"
        ? {
            approved_at: new Date().toISOString(),
            approved_by: opts.actorId ?? null,
            // Trade partner qualification is good for a year.
            qualification_expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
          }
        : {}),
    } as Partial<Company>, opts.actorId);
  }

  return application;
}

export async function assignReviewer(id: string, reviewerId: string | null): Promise<Application> {
  const { data, error } = await getSupabaseAdmin()
    .from("prequal_applications")
    .update({ reviewer_id: reviewerId, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) throw new PrequalError(error.message, 500);
  return data as Application;
}

// ─── Documents ─────────────────────────────────────────────────────────────

export async function updateDocument(
  id: string,
  patch: Partial<CompanyDocument>,
  actorId?: string | null,
): Promise<CompanyDocument> {
  const allowed: Record<string, unknown> = {};
  for (const key of [
    "status", "issued_on", "expires_on", "rejection_reason", "carrier", "policy_number",
    "coverage_amount", "license_number", "license_class", "license_state", "notes", "label",
  ] as const) {
    if (key in patch) allowed[key] = patch[key] ?? null;
  }
  if (patch.status === "verified") {
    allowed.verified_by = actorId ?? null;
    allowed.verified_at = new Date().toISOString();
    allowed.rejection_reason = null;
  }
  if (patch.status === "rejected") {
    allowed.verified_by = null;
    allowed.verified_at = null;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("company_documents")
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) throw new PrequalError(error.message, 500);
  return data as CompanyDocument;
}

/** A short-lived link to a document in the private bucket. */
export async function documentUrl(id: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: doc } = await supabase.from("company_documents").select("file_url").eq("id", id).maybeSingle();
  const path = (doc as { file_url: string | null } | null)?.file_url;
  if (!path) return null;
  const { data } = await supabase.storage.from("prequal-documents").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}
