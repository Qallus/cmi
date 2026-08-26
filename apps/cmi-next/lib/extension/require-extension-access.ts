import { getSupabaseAdmin } from "@/lib/supabase/server";

// Thrown by requireExtensionAccess. `code` lets the side panel distinguish an
// expired token (reconnect) from a disabled account (contact admin).
export class ExtensionAuthError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ExtensionAuthError";
    this.status = status;
    this.code = code;
  }
}

export type ExtensionContext = {
  user: { id: string; email: string };
  staff: {
    id: string;
    role_slug: string;
    organization_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  organizationId: string;
};

// Bearer-token analogue of requireAdmin() for the extension API. Verifies the
// Supabase access token, resolves the staff record, then checks the per-user
// extension_access flag. Access is grant-per-row: no row (or enabled = false)
// means no access. Enforced on EVERY /api/extension/* route.
export async function requireExtensionAccess(request: Request): Promise<ExtensionContext> {
  const auth = request.headers.get("authorization") ?? "";
  const token = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
  if (!token) throw new ExtensionAuthError("Missing bearer token.", 401, "NO_TOKEN");

  const supabase = getSupabaseAdmin();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw new ExtensionAuthError("Invalid or expired session.", 401, "INVALID_TOKEN");

  const { data: staff, error: staffErr } = await supabase
    .from("staff_users")
    .select("id, role_slug, status, organization_id, display_name, first_name, last_name")
    .eq("email", user.email ?? "")
    .in("status", ["active", "invited"])
    .maybeSingle();
  if (staffErr || !staff) throw new ExtensionAuthError("Not a staff member.", 403, "NOT_STAFF");

  const { data: access } = await supabase
    .from("extension_access")
    .select("enabled")
    .eq("staff_user_id", staff.id)
    .maybeSingle();
  if (!access || !access.enabled) {
    throw new ExtensionAuthError(
      "Extension access is disabled for your account. Contact your admin.",
      403,
      "EXTENSION_ACCESS_DISABLED",
    );
  }

  return {
    user: { id: user.id, email: user.email ?? "" },
    staff: {
      id: staff.id,
      role_slug: staff.role_slug,
      organization_id: staff.organization_id,
      display_name: staff.display_name ?? null,
      first_name: staff.first_name ?? null,
      last_name: staff.last_name ?? null,
    },
    organizationId: staff.organization_id,
  };
}
