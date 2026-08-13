// Auth shim for the ported Workspace module. MJG used `profiles` + action-tokens
// via `@/lib/user-management/auth`, `@/lib/auth/server`, and `@/lib/rbac/permissions`.
// CMI authenticates staff from the `cmi-session` cookie (see lib/auth/server-session),
// so all three surfaces are re-expressed here against `getSessionStaff`.
//
// Workspace is Super Admin only (see workspace-features.md §1/§16).
import { getSessionStaff, type SessionStaff } from "@/lib/auth/server-session";

export type WorkspaceActor = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  status: "active";
};

function toActor(staff: SessionStaff): WorkspaceActor {
  return { id: staff.id, email: staff.email, role: staff.role_slug, display_name: staff.display_name, status: "active" };
}

/**
 * Route guard: resolve the current staff member and require Super Admin.
 * `request`/`actionToken` are accepted for signature-compatibility with the
 * MJG original but ignored — CMI authorizes via the session cookie.
 */
export async function requireSuperAdmin(_request?: Request, _actionToken?: string | null): Promise<WorkspaceActor> {
  const staff = await getSessionStaff();
  if (!staff) throw new Error("Authentication required.");
  if (staff.role_slug !== "super_admin") throw new Error("Super Admin permission required.");
  return toActor(staff);
}

/** Server-component helper: current staff as a profile-shaped object, or null. */
export async function getCurrentProfile(): Promise<WorkspaceActor | null> {
  const staff = await getSessionStaff();
  return staff ? toActor(staff) : null;
}

export const PERMISSIONS = { MANAGE_WORKSPACE: "manage_workspace" } as const;

/** Workspace is gated to Super Admins. */
export function can(role: string | null | undefined, _permission: string): boolean {
  return role === "super_admin";
}
