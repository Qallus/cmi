// Who can be assigned work (deal owners, tasks, etc.).
//
// Clients and view-only accounts are never assignable. Invited staff are —
// they've been added to the team and simply haven't signed in yet, and
// leaving them out makes people look "missing" from assignment lists.
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const ASSIGNABLE_ROLES = [
  "super_admin", "admin", "project_manager", "staff",
  "designer", "estimator", "superintendent",
  "subcontractor", "vendor",
] as const;

export const ASSIGNABLE_STATUSES = ["active", "invited"] as const;

export type AssignableStaff = { id: string; name: string; email: string | null; role: string; status: string };

export async function loadAssignableStaff(): Promise<AssignableStaff[]> {
  const { data } = await getSupabaseAdmin()
    .from("staff_users")
    .select("id, display_name, first_name, last_name, email, role_slug, status")
    .in("role_slug", [...ASSIGNABLE_ROLES])
    .in("status", [...ASSIGNABLE_STATUSES])
    .order("display_name");

  const rows = (data ?? []).map((s) => ({
    id: s.id as string,
    name: (s.display_name || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.email || "Staff") as string,
    email: (s.email ?? null) as string | null,
    role: s.role_slug as string,
    status: s.status as string,
  }));

  // Same person can hold two staff accounts (e.g. two work emails). Show the
  // email alongside so the list isn't three identical names.
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
  return rows.map((r) => (counts.get(r.name)! > 1 && r.email ? { ...r, name: `${r.name} (${r.email})` } : r));
}
