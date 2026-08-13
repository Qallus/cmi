"use client";

// No-op shim for the MJG action-token context. CMI authorizes same-origin API
// calls with the `cmi-session` cookie, so no bearer/action token is needed —
// the empty string is passed through fetch headers harmlessly and ignored by
// the Workspace routes (which resolve the actor via getSessionStaff).
export function useDashboardActionToken(): string {
  return "";
}
