/** Shared, credential-free constants for event invitations. Every page and route re-checks on the server. */
export const EVENTS_FLAG = "event_invitations";

// Same audience as Bookings (lib/mcp/tools-comms.ts BOOKING_ROLES).
export const EVENT_ROLES = ["super_admin", "admin", "project_manager", "estimator"] as const;

export function canManageEvents(role: string | null | undefined): boolean {
  return EVENT_ROLES.some((r) => r === role);
}
