/** Shared, credential-free constants. Every page and route re-checks on the server. */
export const PREQUAL_FLAG = "prequalification";

// Reviewing an application exposes a company's licence, insurance and
// financial capacity, so it sits with the same audience as Pre-Con.
export const PREQUAL_ROLES = ["super_admin", "admin", "project_manager", "estimator"] as const;

export function canUsePrequal(role: string | null | undefined): boolean {
  return PREQUAL_ROLES.some((allowed) => allowed === role);
}

// Approving a trade partner, or verifying a document, is a narrower job.
export const PREQUAL_DECIDE_ROLES = ["super_admin", "admin"] as const;

export function canDecidePrequal(role: string | null | undefined): boolean {
  return PREQUAL_DECIDE_ROLES.some((allowed) => allowed === role);
}
