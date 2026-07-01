import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "cmi-session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAdmin(request: Request | NextRequest) {
  const cookieHeader = (request as Request).headers.get("cookie") ?? "";
  const token = parseCookie(cookieHeader, SESSION_COOKIE);

  if (!token) {
    throw new AuthError("Unauthorized — no session.", 401);
  }

  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);

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
