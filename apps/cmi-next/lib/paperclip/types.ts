// Shapes returned by the Paperclip control-plane API.
//
// Deliberately partial: Paperclip owns these records and its responses carry
// more than the dashboard renders. Declaring only what we read means an
// upstream addition cannot break the build, and an upstream *removal* shows up
// as an undefined field rather than a type error in CI long after deploy.
// Everything optional for the same reason.

export type PaperclipAgentStatus =
  | "active" | "idle" | "running" | "error" | "paused" | "terminated" | string;

export type PaperclipAgent = {
  id: string;
  name?: string | null;
  role?: string | null;
  status?: PaperclipAgentStatus | null;
  adapterType?: string | null;
  model?: string | null;
  lastHeartbeatAt?: string | null;
  currentIssueId?: string | null;
  errorMessage?: string | null;
};

/** Paperclip's task primitive is an "issue". */
export type PaperclipIssue = {
  id: string;
  title?: string | null;
  status?: string | null;
  priority?: string | number | null;
  assigneeAgentId?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type PaperclipApproval = {
  id: string;
  title?: string | null;
  status?: string | null;
  kind?: string | null;
  requestedByAgentId?: string | null;
  createdAt?: string | null;
};

export type PaperclipDashboard = {
  agents?: Record<string, number> | null;
  issues?: Record<string, number> | null;
  staleIssues?: number | null;
  costs?: { spend?: number | null; budget?: number | null } | null;
};

/**
 * Why the panel has nothing to show.
 *
 * Distinguished so the UI can tell the difference between "nobody has set this
 * up" (an instruction) and "Paperclip is down" (a status) — the two need very
 * different words, and conflating them is how a missing env var gets
 * investigated as an outage.
 */
export type PaperclipUnavailable =
  | { reason: "unconfigured"; missing: string[] }
  | { reason: "unauthorized"; detail: string }
  | { reason: "unreachable"; detail: string }
  | { reason: "error"; detail: string };

export type PaperclipResult<T> =
  | { ok: true; data: T }
  | { ok: false; unavailable: PaperclipUnavailable };
