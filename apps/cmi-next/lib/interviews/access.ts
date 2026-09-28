/** Shared, credential-free constants. Every page and route re-checks on the server. */
export const INTERVIEWS_FLAG = "interviews";

// An interview exposes the same licence, insurance and financial detail a
// prequalification application does, so it keeps the same audience.
export const INTERVIEW_ROLES = ["super_admin", "admin", "project_manager", "estimator"] as const;

export function canUseInterviews(role: string | null | undefined): boolean {
  return INTERVIEW_ROLES.some((allowed) => allowed === role);
}

// Editing the questionnaire everyone else works from is a narrower job.
export const INTERVIEW_TEMPLATE_ROLES = ["super_admin", "admin"] as const;

export function canManageTemplates(role: string | null | undefined): boolean {
  return INTERVIEW_TEMPLATE_ROLES.some((allowed) => allowed === role);
}
