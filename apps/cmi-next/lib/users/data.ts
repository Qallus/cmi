import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ManagedUser, UserActivity, UsersData } from "./types";

export async function loadUsersData(): Promise<UsersData> {
  const supabase = getSupabaseAdmin();
  const [users, activities] = await Promise.all([
    supabase
      .from("staff_users")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("user_activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (users.error) throw users.error;
  if (activities.error && activities.error.code !== "42P01") throw activities.error;

  return {
    users: (users.data || []).map(normalizeUser),
    activities: ((activities.data || []) as UserActivity[])
  };
}

export function normalizeUser(row: Record<string, unknown>): ManagedUser {
  const firstName = String(row.first_name || "");
  const lastName = String(row.last_name || "");
  return {
    id: String(row.id),
    auth_user_id: row.auth_user_id ? String(row.auth_user_id) : null,
    contact_id: row.contact_id ? String(row.contact_id) : null,
    email: String(row.email || ""),
    first_name: firstName,
    last_name: lastName,
    display_name: String(row.display_name || `${firstName} ${lastName}`.trim() || row.email || "Unnamed User"),
    phone: row.phone ? String(row.phone) : null,
    role_slug: String(row.role_slug || "viewer") as ManagedUser["role_slug"],
    status: String(row.status || "pending") as ManagedUser["status"],
    company_name: row.company_name ? String(row.company_name) : null,
    job_title: row.job_title ? String(row.job_title) : row.title ? String(row.title) : null,
    title: row.title ? String(row.title) : row.job_title ? String(row.job_title) : null,
    avatar_url: row.avatar_url ? String(row.avatar_url) : null,
    notes: row.notes ? String(row.notes) : null,
    invited_at: row.invited_at ? String(row.invited_at) : null,
    invite_email_sent_at: row.invite_email_sent_at ? String(row.invite_email_sent_at) : null,
    invite_sms_sent_at: row.invite_sms_sent_at ? String(row.invite_sms_sent_at) : null,
    invite_accepted_at: row.invite_accepted_at ? String(row.invite_accepted_at) : null,
    disabled_at: row.disabled_at ? String(row.disabled_at) : null,
    last_login_at: row.last_login_at ? String(row.last_login_at) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null
  };
}
