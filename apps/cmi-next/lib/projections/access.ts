/** Shared, credential-free constants. Every page and route re-checks on the server. */
export const PROJECTIONS_FLAG = "projections";
export const PROJECTION_ROLES = ["super_admin", "admin"] as const;

export function canUseProjections(role: string | null | undefined): boolean {
  return PROJECTION_ROLES.some((allowed) => allowed === role);
}
