// Which roles may hold a staff dashboard session.
//
// `staff_users` holds internal staff *and* external parties — clients,
// vendors and subcontractors get rows there so they can be referenced from
// jobs and permissions. Until this existed, both the sign-in route and
// `requireAdmin` only checked `status IN ('active','invited')` and never the
// role, so an external party with a staff row and a password could obtain a
// full staff session and reach every one of the ~160 routes behind
// `requireAdmin`. One live `client` row did exactly that.
//
// Credential-free and dependency-free on purpose: edge, server and client
// code can all import it.

/** Roles that work *for* Constructed Matter and may sign in to the dashboard. */
export const STAFF_ROLES = [
  "super_admin",
  "admin",
  "project_manager",
  "staff",
  "designer",
  "estimator",
  "superintendent",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * External parties. Listed explicitly rather than inferred, so that adding a
 * new role to the union is a deliberate decision about which side it falls on
 * rather than something that silently defaults to having access.
 *
 * `viewer` sits here because nothing grants it today and `DashboardNav`
 * falls back to it for an unresolved session — it must not be a way in.
 */
export const NON_STAFF_ROLES = ["subcontractor", "vendor", "client", "viewer"] as const;

export function isStaffRole(role: string | null | undefined): role is StaffRole {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}
