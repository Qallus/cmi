// The trade partner directory.
//
// This is the point of collecting the information: find the demolition subs
// who work in Scottsdale, take $25k-$150k jobs, have capacity, and whose
// insurance is current — without opening a single PDF.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Company } from "./data";

export type ComplianceState = "clear" | "expiring" | "expired" | "missing" | "none";

export type DirectoryRow = Company & {
  contact_count: number;
  docs_total: number;
  docs_verified: number;
  docs_outstanding: number;
  next_expiry: string | null;
  compliance: ComplianceState;
};

export type DirectoryFilters = {
  q?: string | null;
  trade?: string | null;
  area?: string | null;
  status?: string | null;
  compliance?: ComplianceState | "any" | null;
  /** Partners who'll take a job of this size. */
  projectValue?: number | null;
};

const SOON_DAYS = 60;

export async function loadDirectory(filters: DirectoryFilters = {}): Promise<DirectoryRow[]> {
  const supabase = getSupabaseAdmin();

  let query = supabase.from("companies").select("*").is("archived_at", null).order("name").limit(1000);
  if (filters.status && filters.status !== "all") query = query.eq("qualification_status", filters.status);
  if (filters.trade) query = query.contains("trades", [filters.trade]);
  if (filters.area) query = query.contains("service_areas", [filters.area]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let companies = (data ?? []) as Company[];

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    companies = companies.filter((c) =>
      [c.name, c.legal_name, c.partner_type, c.city, (c.trades ?? []).join(" "), (c.service_areas ?? []).join(" ")]
        .some((v) => (v ?? "").toLowerCase().includes(q)));
  }

  // "Will they take a job this size?" — min is a floor, max a ceiling, and a
  // blank either side means they haven't said, which shouldn't exclude them.
  if (filters.projectValue != null && Number.isFinite(filters.projectValue)) {
    const v = filters.projectValue;
    companies = companies.filter((c) =>
      (c.min_project_value == null || c.min_project_value <= v) &&
      (c.max_project_value == null || c.max_project_value >= v));
  }

  const ids = companies.map((c) => c.id);
  const [docs, contacts] = await Promise.all([documentSummary(ids), contactCounts(ids)]);

  const rows = companies.map((c) => {
    const d = docs.get(c.id) ?? { total: 0, verified: 0, outstanding: 0, next: null, expired: false, expiring: false };
    const compliance: ComplianceState =
      d.total === 0 ? "none"
      : d.expired ? "expired"
      : d.outstanding > 0 ? "missing"
      : d.expiring ? "expiring"
      : "clear";
    return {
      ...c,
      contact_count: contacts.get(c.id) ?? 0,
      docs_total: d.total,
      docs_verified: d.verified,
      docs_outstanding: d.outstanding,
      next_expiry: d.next,
      compliance,
    };
  });

  if (filters.compliance && filters.compliance !== "any") {
    return rows.filter((r) => r.compliance === filters.compliance);
  }
  return rows;
}

type DocSummary = { total: number; verified: number; outstanding: number; next: string | null; expired: boolean; expiring: boolean };

async function documentSummary(ids: string[]): Promise<Map<string, DocSummary>> {
  const out = new Map<string, DocSummary>();
  if (ids.length === 0) return out;

  const { data } = await getSupabaseAdmin()
    .from("company_documents").select("company_id, status, expires_on").in("company_id", ids);

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + SOON_DAYS * 86_400_000).toISOString().slice(0, 10);

  for (const row of (data ?? []) as { company_id: string; status: string; expires_on: string | null }[]) {
    const e = out.get(row.company_id) ?? { total: 0, verified: 0, outstanding: 0, next: null, expired: false, expiring: false };
    e.total += 1;
    if (row.status === "verified") e.verified += 1;
    else e.outstanding += 1;

    if (row.expires_on) {
      if (!e.next || row.expires_on < e.next) e.next = row.expires_on;
      if (row.expires_on < today) e.expired = true;
      else if (row.expires_on <= soon) e.expiring = true;
    }
    out.set(row.company_id, e);
  }
  return out;
}

async function contactCounts(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  const { data } = await getSupabaseAdmin().from("contacts").select("company_id").in("company_id", ids);
  for (const row of (data ?? []) as { company_id: string }[]) {
    out.set(row.company_id, (out.get(row.company_id) ?? 0) + 1);
  }
  return out;
}

export type ComplianceItem = {
  id: string;
  company_id: string;
  company_name: string;
  doc_type: string;
  label: string | null;
  status: string;
  expires_on: string | null;
  days_left: number | null;
};

/**
 * The compliance worklist: everything missing, rejected, expired, or expiring
 * inside the window. Ordered by how soon it bites.
 */
export async function loadComplianceWorklist(windowDays = SOON_DAYS): Promise<ComplianceItem[]> {
  const supabase = getSupabaseAdmin();
  const horizon = new Date(Date.now() + windowDays * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("company_documents")
    .select("id, company_id, doc_type, label, status, expires_on, companies(name)")
    .or(`status.in.(requested,rejected,expired),expires_on.lte.${horizon}`)
    .limit(500);
  if (error) throw new Error(error.message);

  const today = Date.now();
  return ((data ?? []) as unknown as (ComplianceItem & { companies: { name: string } | null })[])
    .map((row) => ({
      id: row.id,
      company_id: row.company_id,
      company_name: row.companies?.name ?? "Unknown company",
      doc_type: row.doc_type,
      label: row.label,
      status: row.status,
      expires_on: row.expires_on,
      days_left: row.expires_on
        ? Math.floor((new Date(`${row.expires_on}T00:00:00`).getTime() - today) / 86_400_000)
        : null,
    }))
    .sort((a, b) => {
      const av = a.days_left ?? 9999;
      const bv = b.days_left ?? 9999;
      return av - bv;
    });
}

/** Headline counts for the workspace. */
export async function loadQualificationStats(): Promise<Record<string, number>> {
  const supabase = getSupabaseAdmin();
  const [apps, companies, worklist] = await Promise.all([
    supabase.from("prequal_applications").select("status"),
    supabase.from("companies").select("qualification_status").is("archived_at", null),
    loadComplianceWorklist(),
  ]);

  const count = (rows: { [k: string]: string }[] | null, key: string, value: string) =>
    (rows ?? []).filter((r) => r[key] === value).length;

  const appRows = (apps.data ?? []) as { status: string }[];
  const coRows = (companies.data ?? []) as { qualification_status: string }[];

  return {
    awaiting_review: count(appRows, "status", "submitted"),
    in_review: count(appRows, "status", "in_review"),
    info_requested: count(appRows, "status", "info_requested"),
    drafts: count(appRows, "status", "draft"),
    approved: count(coRows, "qualification_status", "approved") + count(coRows, "qualification_status", "preferred"),
    companies: coRows.length,
    compliance_items: worklist.length,
    expiring_soon: worklist.filter((w) => w.days_left != null && w.days_left >= 0 && w.days_left <= 60).length,
  };
}
