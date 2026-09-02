import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { loadDeals } from "@/lib/deals/data";
import type { Deal } from "@/lib/deals/types";
import { PipelineDealsClient, type OwnerOption, type SourceRow } from "./pipeline-deals-client";

export const metadata = { title: "Pipeline — CMI Dashboard" };
export const dynamic = "force-dynamic";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

// The Pipeline (deals) early funnel: Contact / Lead / Form submission →
// Add to Pipeline → stages → Closed Won (hands off to a Pre-Con record).
export default async function PipelinePage() {
  const staff = await getSessionStaff();
  const canWrite = !!staff && WRITE_ROLES.includes(staff.role_slug);
  const supabase = getSupabaseAdmin();

  let deals: Deal[] = [];
  let owners: OwnerOption[] = [];
  let contacts: SourceRow[] = [];
  let quotes: SourceRow[] = [];
  let submissions: SourceRow[] = [];

  try {
    const [dealsRes, staffRes, contactsRes, quotesRes, subsRes] = await Promise.all([
      loadDeals(),
      supabase.from("staff_users").select("id, display_name, first_name, last_name").eq("status", "active").order("display_name"),
      supabase.from("contacts").select("id, first_name, last_name, email, company").order("created_at", { ascending: false }).limit(500),
      supabase.from("quotes").select("id, name, email, project_type").order("created_at", { ascending: false }).limit(500),
      supabase.from("contact_submissions").select("id, first_name, last_name, email, subject").neq("status", "archived").order("submitted_at", { ascending: false }).limit(500),
    ]);
    deals = dealsRes;
    owners = (staffRes.data ?? []).map((s) => ({
      id: s.id,
      name: s.display_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Staff",
    }));
    contacts = (contactsRes.data ?? []).map((c) => ({
      id: c.id,
      label: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.company || c.email || "Contact",
      sub: c.company || c.email || "",
    }));
    quotes = (quotesRes.data ?? []).map((q) => ({ id: q.id, label: q.name || q.email || "Lead", sub: q.project_type || q.email || "" }));
    submissions = (subsRes.data ?? []).map((s) => ({
      id: s.id,
      label: `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email || "Submission",
      sub: s.subject || s.email || "",
    }));
  } catch {
    // fall through to empty datasets
  }

  return (
    <PipelineDealsClient
      initialDeals={deals}
      owners={owners}
      contacts={contacts}
      quotes={quotes}
      submissions={submissions}
      canWrite={canWrite}
    />
  );
}
