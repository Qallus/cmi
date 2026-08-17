// Role gating for the Multi-Schedule Builder. CMI authorizes by role_slug
// (no formal permission table), so these mirror the app's existing convention.

// Internal team roles that may open the scheduler.
export const SCHEDULE_VIEW_ROLES = [
  "super_admin", "admin", "project_manager", "superintendent", "estimator", "designer", "staff",
] as const;

// Roles that may create/edit schedules, phases, items, and dependencies.
export const SCHEDULE_EDIT_ROLES = [
  "super_admin", "admin", "project_manager", "superintendent", "estimator",
] as const;

// Roles that may manage templates/packages/baselines, delete schedules, and
// publish client visibility.
export const SCHEDULE_MANAGE_ROLES = [
  "super_admin", "admin", "project_manager",
] as const;

export function canViewSchedules(role: string | null | undefined): boolean {
  return !!role && (SCHEDULE_VIEW_ROLES as readonly string[]).includes(role);
}
export function canEditSchedules(role: string | null | undefined): boolean {
  return !!role && (SCHEDULE_EDIT_ROLES as readonly string[]).includes(role);
}
export function canManageSchedules(role: string | null | undefined): boolean {
  return !!role && (SCHEDULE_MANAGE_ROLES as readonly string[]).includes(role);
}
