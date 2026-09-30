import { notFound, redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { loadAssignableStaff } from "@/lib/staff/assignable";
import { getOpportunity, loadOpportunities, loadStageHistory } from "@/lib/pipeline/data";
import type { Opportunity, StageHistoryRow } from "@/lib/pipeline/types";
import { OpportunityDetailClient, type OppContact, type OwnerOption } from "./opportunity-detail-client";

export const dynamic = "force-dynamic";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const opp = await getOpportunity((await params).id).catch(() => null);
  return { title: `${opp?.opportunity_name ?? "Opportunity"} — CMI Pre-Con` };
}

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await getOpportunity(id).catch(() => null);
  if (!opportunity) notFound();

  const staff = await getSessionStaff();
  if (!staff) redirect("/login");
  const canWrite = WRITE_ROLES.includes(staff.role_slug);

  const supabase = getSupabaseAdmin();
  let owners: OwnerOption[] = [];
  let history: StageHistoryRow[] = [];
  let contact: OppContact | null = null;
  // Board order for the previous/next arrows, matching the list.
  let siblingIds: string[] = [];

  try {
    const [staffRows, allHistory, everything, contactRes] = await Promise.all([
      loadAssignableStaff(),
      loadStageHistory(),
      loadOpportunities(),
      (opportunity as Opportunity).contact_id
        ? supabase.from("contacts").select("id, first_name, last_name, email, phone, company")
            .eq("id", (opportunity as Opportunity).contact_id as string).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    owners = staffRows.map((s) => ({ id: s.id, name: s.name }));
    history = allHistory.filter((h) => h.opportunity_id === id);
    siblingIds = everything.map((o) => o.id);
    const c = contactRes.data as Record<string, unknown> | null;
    if (c) {
      contact = {
        id: String(c.id),
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || (c.company as string) || "Contact",
        email: (c.email as string) ?? null,
        phone: (c.phone as string) ?? null,
        company: (c.company as string) ?? null,
      };
    }
  } catch {
    // Render with whatever loaded.
  }

  return (
    <OpportunityDetailClient
      opportunity={opportunity as Opportunity}
      contact={contact}
      owners={owners}
      history={history}
      siblingIds={siblingIds}
      canWrite={canWrite}
      isAdmin={["super_admin", "admin"].includes(staff.role_slug)}
    />
  );
}
