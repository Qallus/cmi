import { loadJobList, loadJobTypes } from "@/lib/jobs/data";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { computeJobReport } from "@/lib/jobs/reporting";
import type { JobListRow } from "@/lib/jobs/data";
import type { JobType } from "@/lib/jobs/types";
import { JobsListClient } from "./jobs-list-client";
import { getSessionStaff } from "@/lib/auth/server-session";

export const metadata = { title: "Jobs — CMI Dashboard" };
export const dynamic = "force-dynamic";

// Every Constructed Matter employee (staff roles, not clients/vendors), by name.
async function loadStaffNames(): Promise<string[]> {
  const { data } = await getSupabaseAdmin().from("staff_users").select("display_name")
    .in("role_slug", [...STAFF_ROLES]).in("status", ["active", "invited"]);
  return Array.from(new Set((data ?? []).map((s) => (s.display_name as string | null)?.trim()).filter((n): n is string => !!n)));
}

export default async function JobsPage() {
  let rows: JobListRow[] = [];
  let types: JobType[] = [];
  let staffNames: string[] = [];
  try {
    [rows, types, staffNames] = await Promise.all([loadJobList(), loadJobTypes(), loadStaffNames()]);
  } catch {
    // empty fallback
  }
  const report = computeJobReport(rows, new Date().toISOString().slice(0, 10));
  const staff = await getSessionStaff();
  return <JobsListClient initialRows={rows} types={types} staffNames={staffNames} report={report} role={staff?.role_slug ?? null} />;
}
