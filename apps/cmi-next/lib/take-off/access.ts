/** Shared, credential-free constants. Page authorization is checked on the server. */
export const TAKE_OFF_FLAG = "take_off";
export const TAKE_OFF_ROLES = [
  "super_admin",
  "admin",
  "project_manager",
  "staff",
  "estimator",
] as const;

export function canUseTakeOff(role: string | null | undefined): boolean {
  return TAKE_OFF_ROLES.some((allowed) => allowed === role);
}
