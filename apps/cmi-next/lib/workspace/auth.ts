// Auth shim for the ported Workspace module. MJG used `profiles` + action-tokens
// via `@/lib/user-management/auth`, `@/lib/auth/server`, and `@/lib/rbac/permissions`.
// CMI authenticates staff from the `cmi-session` cookie (see lib/auth/server-session),
// so all three surfaces are re-expressed here against `getSessionStaff`.
//
// Workspace is open to the whole internal team (see WORKSPACE_ROLES) — everyone
// can read and edit so meetings/docs can be updated live. External portal roles
// (client / vendor / subcontractor / viewer) are excluded.
import { getSessionStaff, type SessionStaff } from "@/lib/auth/server-session";

// Internal team roles that may use the Workspace.
export const WORKSPACE_ROLES = [
  "super_admin", "admin", "project_manager", "designer", "estimator", "superintendent", "staff",
] as const;

export function isWorkspaceRole(role: string | null | undefined): boolean {
  return !!role && (WORKSPACE_ROLES as readonly string[]).includes(role);
}

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
 * Route guard: resolve the current staff member and require a Workspace role.
 * `request`/`actionToken` are accepted for signature-compatibility with the
 * MJG original but ignored — CMI authorizes via the session cookie.
 */
export async function requireWorkspaceAccess(_request?: Request, _actionToken?: string | null): Promise<WorkspaceActor> {
  const staff = await getSessionStaff();
  if (!staff) throw new Error("Authentication required.");
  if (!isWorkspaceRole(staff.role_slug)) throw new Error("Workspace permission required.");
  return toActor(staff);
}

/** Server-component helper: current staff as a profile-shaped object, or null. */
export async function getCurrentProfile(): Promise<WorkspaceActor | null> {
  const staff = await getSessionStaff();
  return staff ? toActor(staff) : null;
}

export const PERMISSIONS = { MANAGE_WORKSPACE: "manage_workspace" } as const;

/** Workspace is available to the internal team. */
export function can(role: string | null | undefined, _permission: string): boolean {
  return isWorkspaceRole(role);
}
