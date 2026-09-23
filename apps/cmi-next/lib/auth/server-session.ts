import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  SESSION_COOKIE, REFRESH_COOKIE, SESSION_MAX_AGE, REFRESH_MAX_AGE, cookieOptions, needsRefresh, refreshSession,
} from "@/lib/auth/tokens";

export type SessionStaff = {
  id: string;
  email: string;
  role_slug: string;
  display_name: string | null;
};

/**
 * Server Component / route helper: resolve the current staff member from the
 * session cookie. Returns null when there is no valid session or no active
 * staff record. Uses the service-role client (RLS bypass) after verifying the
 * Supabase auth token — the same trust model as require-admin.ts.
 */
export async function getSessionStaff(): Promise<SessionStaff | null> {
  const store = await cookies();
  let token = store.get(SESSION_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  // Middleware refreshes on navigation; this covers the gap for server
  // components rendered from a stale token.
  if (refreshToken && (!token || needsRefresh(token))) {
    const next = await refreshSession(refreshToken);
    if (next) {
      token = next.access_token;
      try {
        store.set(SESSION_COOKIE, next.access_token, cookieOptions(SESSION_MAX_AGE));
        store.set(REFRESH_COOKIE, next.refresh_token, cookieOptions(REFRESH_MAX_AGE));
      } catch { /* server components can't set cookies; middleware will */ }
    }
  }
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const { data: staff } = await supabase
    .from("staff_users")
    .select("id, email, role_slug, display_name")
    .eq("email", user.email ?? "")
    .in("status", ["active", "invited"])
    .maybeSingle();

  if (!staff) return null;
  return {
    id: staff.id,
    email: staff.email ?? user.email ?? "",
    role_slug: staff.role_slug,
    display_name: staff.display_name ?? null,
  };
}

export async function isSuperAdmin(): Promise<boolean> {
  const staff = await getSessionStaff();
  return staff?.role_slug === "super_admin";
}
