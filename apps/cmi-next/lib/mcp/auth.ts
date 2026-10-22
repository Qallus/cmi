// Resolve the caller of /api/mcp from its bearer token. Status, role and the
// Settings → Claude grants are re-checked on every call, so suspending someone
// or switching off "Connect Claude" takes effect immediately.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isStaffRole } from "@/lib/auth/roles";
import { canReadFinancials, canUseBolt } from "@/lib/agent/access";
import { loadAiCapabilities } from "@/lib/ai-access/check";
import type { StaffContext } from "@/lib/agent/types";
import { sha256 } from "./pkce";

export type McpCaller = {
  ctx: StaffContext;
  /** On the Settings → Claude company-wide allowlist (the "owner" view). */
  companyWide: boolean;
  tokenId: string;
  clientId: string;
};

export class McpAuthError extends Error {
  constructor(message: string, public status: 401 | 403 = 401) {
    super(message);
  }
}

/** May this staff member connect Claude at all? Shared with /oauth/authorize. */
export async function mcpAccessFor(staff: { id: string; role_slug: string; status?: string | null }) {
  if (!isStaffRole(staff.role_slug) || !canUseBolt(staff.role_slug)) {
    return { allowed: false as const, reason: "Your role doesn't include Claude access to CMI." };
  }
  const caps = await loadAiCapabilities({ type: "staff", staffUserId: staff.id, role: staff.role_slug });
  if (!caps.has("mcp_connect")) return { allowed: false as const, reason: "Claude access is switched off for your account. Ask a Super Admin (Settings → Claude)." };
  return { allowed: true as const, companyWide: caps.has("company_wide") };
}

export async function resolveMcpCaller(request: Request): Promise<McpCaller> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) throw new McpAuthError("Missing bearer token.");

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from("mcp_oauth_tokens")
    .select("id, client_id, staff_user_id, expires_at, revoked_at, last_used_at")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new McpAuthError("Invalid or expired token.");
  }

  const { data: staff } = await supabase
    .from("staff_users")
    .select("id, email, display_name, role_slug, status")
    .eq("id", row.staff_user_id)
    .in("status", ["active", "invited"])
    .maybeSingle();
  if (!staff) throw new McpAuthError("This CMI account is no longer active.", 403);

  const access = await mcpAccessFor(staff);
  if (!access.allowed) throw new McpAuthError(access.reason, 403);

  // Touch at most once a minute; never block the call on it.
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    // Supabase builders are lazy; .then() is what sends the request.
    supabase.from("mcp_oauth_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then(() => {}, () => {});
  }

  return {
    ctx: {
      id: staff.id,
      email: staff.email ?? "",
      displayName: staff.display_name || staff.email || "Staff",
      role: staff.role_slug,
      isAdmin: canReadFinancials(staff.role_slug),
    },
    companyWide: access.companyWide,
    tokenId: row.id,
    clientId: row.client_id,
  };
}
