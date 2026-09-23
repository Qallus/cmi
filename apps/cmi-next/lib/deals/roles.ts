// Who can work a deal: create them, log activity, add and edit tasks.
//
// This is the whole internal team, not just sales leadership — staff and
// designers sit in on calls and take the notes, so locking them out of the
// timeline just means the notes never get written down. Clients, viewers,
// subcontractors and vendors stay out.
export const DEAL_WRITE_ROLES = [
  "super_admin", "admin", "project_manager",
  "estimator", "staff", "designer", "superintendent",
] as const;

export function canWriteDeals(role: string | null | undefined): boolean {
  return !!role && (DEAL_WRITE_ROLES as readonly string[]).includes(role);
}
