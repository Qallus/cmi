// The MCP safety rules that don't need the database: risk tiers, tool
// annotations, when a pending action may still be confirmed, daily-cap math,
// and how each kind of record goes to the trash. Pure (no imports) so
// lib/mcp/safety.test.mjs runs it directly.

/** read runs at once; write runs at once and is snapshotted; high needs preview + cmi_confirm. */
export type Risk = "read" | "write" | "high";
export const RISKS: readonly Risk[] = ["read", "write", "high"];

/** May a client allowed these tiers see/call a tool of this risk? */
export function tierAllowed(risk: Risk, allowedTiers: readonly string[]): boolean {
  return allowedTiers.includes(risk);
}

/** What a client with no registered kind gets: look, don't touch. */
export const DEFAULT_TIERS: readonly Risk[] = ["read"];

/**
 * MCP tool annotations, from the risk. Claude and ChatGPT use these to decide
 * when to ask the person first; cmi_confirm enforces it server-side anyway.
 */
export function annotationsFor(risk: Risk, opts: { title: string; openWorld?: boolean; idempotent?: boolean }) {
  return {
    title: opts.title,
    readOnlyHint: risk === "read",
    destructiveHint: risk === "high",
    idempotentHint: risk === "read" ? true : !!opts.idempotent,
    openWorldHint: !!opts.openWorld,
  };
}

export const PENDING_TTL_MS = 15 * 60_000;

export type PendingRow = { staff_user_id: string; status: string; expires_at: string; client_id?: string | null };

/** Why this pending action can't be confirmed by this caller now, or null if it can. */
export function pendingProblem(row: PendingRow | null, caller: { staffId: string; clientId: string }, now = Date.now()): string | null {
  if (!row) return "That confirmation id doesn't exist.";
  if (row.staff_user_id !== caller.staffId) return "That confirmation belongs to someone else.";
  if (row.client_id && row.client_id !== caller.clientId) return "That confirmation was started from a different app. Start again here.";
  if (row.status === "confirmed") return "That action was already confirmed. Nothing was run twice.";
  if (row.status === "cancelled") return "That action was cancelled.";
  if (row.status !== "pending") return `That action is ${row.status}.`;
  if (new Date(row.expires_at).getTime() <= now) return "That confirmation expired (15 minutes). Ask again to get a fresh preview.";
  return null;
}

/** Caps count from midnight in Arizona (UTC-7, no daylight saving). */
export function phoenixDayStart(now = new Date()): Date {
  const shifted = new Date(now.getTime() - 7 * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 7));
}

export type CapGroup = "email" | "sms" | "trash";
export const DEFAULT_CAPS: Record<CapGroup, number> = { email: 25, sms: 25, trash: 20 };

/** null when allowed; otherwise the message to give back. */
export function capProblem(group: string, used: number, cap: number | undefined): string | null {
  if (cap == null || cap < 0) return null;
  if (cap === 0) return `AI ${group} actions are switched off (daily limit 0). An admin can change it in Settings → Claude.`;
  if (used >= cap) return `Daily limit reached: ${used} of ${cap} ${group} action${cap === 1 ? "" : "s"} today. It resets at midnight, or an admin can raise it in Settings → Claude.`;
  return null;
}

/**
 * How each kind of record is "deleted" through AI. Nothing is ever hard
 * deleted from an AI client:
 *  - archive: the table already has an archive column; set it.
 *  - status: contacts use status = 'archived' (the previous status is kept).
 *  - snapshot: a leaf row with nothing hanging off it; copy it to record_trash
 *    and remove it. Restore puts the same row back.
 * Anything not listed (quotes, invoices, selections, schedule items…) has
 * child records a snapshot can't bring back, so it's refused: use the dashboard.
 */
export type TrashRule =
  | { method: "archive"; table: string; column: "archived_at" | "deleted_at"; byColumn?: string }
  | { method: "status"; table: string; column: "status"; value: string }
  | { method: "snapshot"; table: string };

export const TRASH_POLICY: Record<string, TrashRule> = {
  job: { method: "archive", table: "jobs", column: "archived_at" },
  opportunity: { method: "archive", table: "pipeline_opportunities", column: "archived_at" },
  deal: { method: "archive", table: "deals", column: "archived_at", byColumn: "archived_by" },
  company: { method: "archive", table: "companies", column: "archived_at" },
  message: { method: "archive", table: "messages", column: "archived_at", byColumn: "archived_by" },
  business_card: { method: "archive", table: "business_cards", column: "archived_at" },
  portfolio_item: { method: "archive", table: "portfolio", column: "deleted_at" },
  contact: { method: "status", table: "contacts", column: "status", value: "archived" },
  daily_log: { method: "snapshot", table: "daily_logs" },
  job_note: { method: "snapshot", table: "job_notes" },
  job_update: { method: "snapshot", table: "job_updates" },
  action_item: { method: "snapshot", table: "job_action_items" },
  job_file: { method: "snapshot", table: "job_files" },
  warranty_request: { method: "snapshot", table: "warranty_requests" },
  blog_post: { method: "snapshot", table: "blog_posts" },
  email_template: { method: "snapshot", table: "email_templates" },
  contact_submission: { method: "snapshot", table: "contact_submissions" },
  meeting: { method: "snapshot", table: "meetings" },
  commitment: { method: "snapshot", table: "commitments" },
  knowledge_doc: { method: "snapshot", table: "bolt_training_docs" },
};

export function trashRuleFor(entity: string): TrashRule | null {
  return TRASH_POLICY[entity] ?? null;
}

/** A readable name for a record, for previews and the trash list. */
export function recordLabel(row: Record<string, unknown> | null | undefined, fallback: string): string {
  if (!row) return fallback;
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ");
  const pick = row.name ?? row.title ?? row.job_name ?? row.subject ?? (name || null) ?? row.email ?? row.job_number;
  if (pick) return String(pick).slice(0, 120);
  // Notes, logs and updates have no name: use the start of their text.
  const text = [row.body, row.content, row.notes, row.description].find((v) => typeof v === "string" && v.trim()) as string | undefined;
  if (text) { const t = text.trim().replace(/\s+/g, " "); return t.length > 60 ? `${t.slice(0, 60)}…` : t; }
  return fallback;
}

/** Roles that may trash and restore through AI (Jeremy, 2026-10-28). */
export const TRASH_ROLES = ["super_admin", "admin"] as const;
export const canTrash = (role: string) => (TRASH_ROLES as readonly string[]).includes(role);
