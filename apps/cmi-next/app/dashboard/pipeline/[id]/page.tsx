import { notFound } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { getDeal, loadActivities, loadDealTasks, loadStageHistory, loadChecklistProgress } from "@/lib/deals/data";
import type { Activity, Deal, DealChecklistProgress, DealStageHistoryRow, DealTask } from "@/lib/deals/types";
import { DealDetailClient, type DealContact, type OwnerOption } from "./deal-detail-client";

export const metadata = { title: "Deal — CMI Pipeline" };
export const dynamic = "force-dynamic";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(id).catch(() => null);
  if (!deal) notFound();

  const staff = await getSessionStaff();
  const canWrite = !!staff && WRITE_ROLES.includes(staff.role_slug);
  const supabase = getSupabaseAdmin();

  let contact: DealContact | null = null;
  let owners: OwnerOption[] = [];
  let activities: Activity[] = [];
  let tasks: DealTask[] = [];
  let history: DealStageHistoryRow[] = [];
  let checklist: DealChecklistProgress[] = [];

  try {
    [activities, tasks, history, checklist] = await Promise.all([
      loadActivities({ dealId: id }),
      loadDealTasks({ dealId: id }),
      loadStageHistory(id),
      loadChecklistProgress(id),
    ]);
    const [{ data: staffRows }, contactRes] = await Promise.all([
      supabase.from("staff_users").select("id, display_name, first_name, last_name").eq("status", "active").order("display_name"),
      (deal as Deal).contact_id
        ? supabase.from("contacts").select("id, first_name, last_name, email, phone, company, type, tags").eq("id", (deal as Deal).contact_id as string).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    owners = (staffRows ?? []).map((s) => ({ id: s.id, name: s.display_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "Staff" }));
    const c = contactRes.data as Record<string, unknown> | null;
    if (c) {
      contact = {
        id: String(c.id),
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || (c.company as string) || "Contact",
        email: (c.email as string) ?? null,
        phone: (c.phone as string) ?? null,
        company: (c.company as string) ?? null,
        role: (c.type as string) ?? null,
        tags: (c.tags as string[]) ?? null,
      };
    }
  } catch {
    // fall through with partial data
  }

  return (
    <DealDetailClient
      deal={deal as Deal}
      contact={contact}
      owners={owners}
      canWrite={canWrite}
      initialActivities={activities}
      initialTasks={tasks}
      initialHistory={history}
      initialChecklist={checklist}
    />
  );
}
