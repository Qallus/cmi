import { getSupabaseAdmin } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE, REFRESH_COOKIE, SESSION_MAX_AGE, REFRESH_MAX_AGE, cookieOptions, needsRefresh, refreshSession,
} from "@/lib/auth/tokens";

// Swap an expiring access token for a fresh one and write both cookies back.
// Route handlers may set cookies; server components can't, so failures here
// are ignored (middleware persists them on the next navigation).
async function tryRefresh(cookieHeader: string): Promise<string | null> {
  const refreshToken = parseCookie(cookieHeader, REFRESH_COOKIE);
  if (!refreshToken) return null;
  const next = await refreshSession(refreshToken);
  if (!next) return null;
  try {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, next.access_token, cookieOptions(SESSION_MAX_AGE));
    jar.set(REFRESH_COOKIE, next.refresh_token, cookieOptions(REFRESH_MAX_AGE));
  } catch { /* read-only context — the token is still usable for this request */ }
  return next.access_token;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAdmin(request: Request | NextRequest) {
  const cookieHeader = (request as Request).headers.get("cookie") ?? "";
  let token = parseCookie(cookieHeader, SESSION_COOKIE);

  // Refresh ahead of expiry so a long-running screen doesn't fail mid-action.
  if (!token || needsRefresh(token)) {
    token = (await tryRefresh(cookieHeader)) ?? token;
  }
  if (!token) {
    throw new AuthError("Unauthorized — no session.", 401);
  }

  const supabase = getSupabaseAdmin();
  let { data: { user }, error } = await supabase.auth.getUser(token);

  // Token rejected (e.g. expired between checks): one more refresh attempt.
  if (error || !user) {
    const fresh = await tryRefresh(cookieHeader);
    if (fresh) ({ data: { user }, error } = await supabase.auth.getUser(fresh));
  }

  if (error || !user) {
    throw new AuthError("Unauthorized — invalid or expired session.", 401);
  }

  // Verify the user has a staff record
  const { data: staff, error: staffErr } = await supabase
    .from("staff_users")
    .select("id, role_slug, status")
    .eq("email", user.email ?? "")
    .in("status", ["active", "invited"])
    .maybeSingle();

  if (staffErr || !staff) {
    throw new AuthError("Forbidden — not a staff member.", 403);
  }

  return { user, staff };
}

// Stricter guard for Super Admin-only surfaces (e.g. the Live Page Editor).
// Reuses requireAdmin, then enforces the top role.
export async function requireSuperAdmin(request: Request | NextRequest) {
  const ctx = await requireAdmin(request);
  if (ctx.staff.role_slug !== "super_admin") {
    throw new AuthError("Forbidden — Super Admin only.", 403);
  }
  return ctx;
}

function parseCookie(header: string, name: string): string | null {
  const match = header.split(";").find((c) => c.trim().startsWith(`${name}=`));
  if (!match) return null;
  return decodeURIComponent(match.trim().slice(name.length + 1)) || null;
}
