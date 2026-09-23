/** Shared, credential-free constants. Every page and route re-checks on the server. */
export const REPORTING_FLAG = "reporting";

// Reports pull together client budgets, contract values and lead status, so
// they sit with the same audience as Pre-Con rather than the whole team.
export const REPORTING_ROLES = ["super_admin", "admin", "project_manager", "estimator"] as const;

export function canUseReporting(role: string | null | undefined): boolean {
  return REPORTING_ROLES.some((allowed) => allowed === role);
}

// Editing a report writes back to jobs and leads, so it's a narrower list.
export const REPORTING_WRITE_ROLES = ["super_admin", "admin", "project_manager"] as const;

export function canEditReports(role: string | null | undefined): boolean {
  return REPORTING_WRITE_ROLES.some((allowed) => allowed === role);
}
