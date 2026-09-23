import "leaflet/dist/leaflet.css";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { getSessionStaff } from "@/lib/auth/server-session";
import { loadDeals } from "@/lib/deals/data";
import type { Deal } from "@/lib/deals/types";
import { PipelineDealsClient, type OwnerOption, type SourceRow } from "./pipeline-deals-client";
import { canWriteDeals } from "@/lib/deals/roles";

export const metadata = { title: "Pipeline — CMI Dashboard" };
export const dynamic = "force-dynamic";


// The Pipeline (deals) early funnel: Contact / Lead / Form submission →
// Add to Pipeline → stages → Closed Won (hands off to a Pre-Con record).
export default async function PipelinePage() {
  const staff = await getSessionStaff();
  const canWrite = !!staff && canWriteDeals(staff.role_slug);
  const supabase = getSupabaseAdmin();

  let deals: Deal[] = [];
  let owners: OwnerOption[] = [];
  let contacts: SourceRow[] = [];
  let quotes: SourceRow[] = [];
  let submissions: SourceRow[] = [];
  let openTasks = 0;

  try {
    const [dealsRes, staffRes, contactsRes, quotesRes, subsRes, tasksRes] = await Promise.all([
      loadDeals(),
      loadAssignableStaff(),
      supabase.from("contacts").select("id, first_name, last_name, email, company").order("created_at", { ascending: false }).limit(500),
      supabase.from("quotes").select("id, name, email, project_type").order("created_at", { ascending: false }).limit(500),
      supabase.from("contact_submissions").select("id, first_name, last_name, email, subject").neq("status", "archived").order("submitted_at", { ascending: false }).limit(500),
      supabase.from("deal_tasks").select("id", { count: "exact", head: true }).is("completed_at", null),
    ]);
    deals = dealsRes;
    openTasks = tasksRes.count ?? 0;
    owners = staffRes.map((s) => ({ id: s.id, name: s.name }));
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
      openTasks={openTasks}
      canWrite={canWrite}
      isSuperAdmin={staff?.role_slug === "super_admin"}
    />
  );
}
