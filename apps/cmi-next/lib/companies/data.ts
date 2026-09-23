// Companies — the record a trade partner's qualification profile hangs off.
//
// Until this existed a company was a free-text column on contacts, so nothing
// could be filtered by trade, service area or capacity. Matching is by slug:
// punctuation and legal suffixes stripped, so "ABC Demolition, LLC" and
// "ABC Demolition" are the same company.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type QualificationStatus =
  | "prospect" | "applicant" | "in_review" | "info_requested" | "interview"
  | "qualified" | "approved" | "preferred" | "suspended" | "declined" | "inactive";

export type Company = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  partner_type: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  business_structure: string | null;
  years_in_business: number | null;
  employee_count: number | null;
  w2_employee_count: number | null;
  subcontractor_count: number | null;
  uses_subcontractors: boolean | null;
  trades: string[] | null;
  capabilities: string[] | null;
  service_areas: string[] | null;
  max_travel_miles: number | null;
  does_residential: boolean | null;
  does_commercial: boolean | null;
  min_project_value: number | null;
  ideal_project_value: number | null;
  max_project_value: number | null;
  concurrent_capacity: number | null;
  pricing_methods: string[] | null;
  estimates_from_plans: boolean | null;
  requires_site_walk: boolean | null;
  equipment: string[] | null;
  certifications: string[] | null;
  osha_trained: boolean | null;
  has_safety_program: boolean | null;
  bonding_capacity: number | null;
  qualification_status: QualificationStatus;
  approved_at: string | null;
  qualification_expires_at: string | null;
  reviewer_id: string | null;
  tags: string[] | null;
  notes: string | null;
  internal_notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Must match the expression used by the unique index and the backfill, or
 * matching silently stops working.
 */
export function companySlug(name: string): string {
  return name
    .trim()
    .replace(/\s*,?\s*(inc|llc|l\.l\.c|corp|corporation|co|company|ltd|lp|llp)\.?\s*$/i, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();
}

export async function getCompany(id: string): Promise<Company | null> {
  const { data, error } = await getSupabaseAdmin().from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Company) ?? null;
}

export async function findCompanyByName(name: string): Promise<Company | null> {
  const slug = companySlug(name);
  if (!slug) return null;
  const { data, error } = await getSupabaseAdmin().from("companies").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Company) ?? null;
}

/**
 * Find the company by name, or create it. `patch` is applied either way, but
 * never blanks a value that's already on file — an applicant's typo shouldn't
 * wipe a field someone verified.
 */
export async function findOrCreateCompany(
  name: string,
  patch: Partial<Company> = {},
): Promise<Company> {
  const supabase = getSupabaseAdmin();
  const slug = companySlug(name);
  if (!slug) throw new Error("A company name is required.");

  const existing = await findCompanyByName(name);
  const clean = Object.fromEntries(
    Object.entries(patch).filter(([, v]) => v !== null && v !== undefined && v !== ""),
  );

  if (existing) {
    if (Object.keys(clean).length === 0) return existing;
    const { data, error } = await supabase
      .from("companies")
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Company;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ name: name.trim(), slug, ...clean })
    .select()
    .single();
  if (error) {
    // Another request created it between the lookup and the insert.
    if (error.code === "23505") {
      const raced = await findCompanyByName(name);
      if (raced) return raced;
    }
    throw new Error(error.message);
  }
  return data as Company;
}

export async function updateCompany(id: string, patch: Partial<Company>, actorId?: string | null): Promise<Company> {
  const { data, error } = await getSupabaseAdmin()
    .from("companies")
    .update({ ...patch, updated_by: actorId ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Company;
}
