import { getSessionStaff } from "@/lib/auth/server-session";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listAllSchedules, dashboardMetrics, listAllItems } from "@/lib/schedules/data";
import { canViewSchedules } from "@/lib/schedules/permissions";
import { SchedulesDashboardClient } from "./schedules-dashboard-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Schedules — CMI Dashboard" };

async function loadStaff(): Promise<{ id: string; name: string }[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("staff_users").select("id, display_name, email").in("status", ["active", "invited"]).order("display_name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.display_name || s.email || "Staff" }));
}

// Global scheduling command center across all jobs.
export default async function SchedulesDashboardPage() {
  const staffMember = await getSessionStaff();
  if (!canViewSchedules(staffMember?.role_slug)) {
    return <div className="p-10 text-center text-sm text-muted-foreground">You don&apos;t have access to schedules.</div>;
  }
  const [schedules, metrics, items, staff] = await Promise.all([listAllSchedules(), dashboardMetrics(), listAllItems(), loadStaff()]);
  return <SchedulesDashboardClient schedules={schedules} metrics={metrics} items={items} staff={staff} />;
}
