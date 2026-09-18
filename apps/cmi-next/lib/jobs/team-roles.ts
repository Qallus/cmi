// Standard roles for a job's internal team (job_internal_users.role).
// The column is free text; these are the values the UI writes. "Other" is
// stored as null so older, role-less rows keep meaning "team member".
export const JOB_TEAM_ROLES = ["Project Manager", "Superintendent", "Other"] as const;
export type JobTeamRole = (typeof JOB_TEAM_ROLES)[number];

// Maps any stored role text (including legacy free text) onto a standard role.
export function jobTeamRole(role: string | null | undefined): JobTeamRole {
  const r = (role ?? "").trim();
  if (/superintendent|supervisor|\bsuper\b/i.test(r)) return "Superintendent";
  if (/project\s*manager|proj\s*mgr|\bpm\b/i.test(r)) return "Project Manager";
  return "Other";
}

// Value to persist for a chosen role.
export function jobTeamRoleValue(role: JobTeamRole): string | null {
  return role === "Other" ? null : role;
}
