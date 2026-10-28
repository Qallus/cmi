// One mcp_audit_log row per tool call, plus a per-person rate limit.
// Neither ever throws into the tool call.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { McpCaller } from "./auth";
import { redactArgs } from "./policy";

export type AuditEntry = {
  caller: McpCaller; tool: string; args: Record<string, unknown>;
  success: boolean; error?: string | null; durationMs: number; targetUserEmail?: string | null;
  /** Phase A: what kind of call, which record, what it looked like before/after. */
  risk?: string; entity?: string | null; recordId?: string | null;
  before?: unknown; after?: unknown; confirmationId?: string | null; capGroup?: string | null;
};

const SNAPSHOT_MAX = 20_000;
/** Keep before/after small enough to store; big rows keep their shape, not their text. */
function trimSnapshot(v: unknown): unknown {
  if (v == null) return null;
  const text = JSON.stringify(v);
  if (text.length <= SNAPSHOT_MAX) return v;
  if (typeof v !== "object" || Array.isArray(v)) return { truncated: true };
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = typeof val === "string" && val.length > 500 ? `${val.slice(0, 500)}…` : val;
  }
  return out;
}

export async function logToolCall(entry: AuditEntry): Promise<void> {
  const base = {
    staff_user_id: entry.caller.ctx.id,
    client_id: entry.caller.clientId,
    tool: entry.tool,
    target_user_email: entry.targetUserEmail ?? null,
    args: redactArgs(entry.args),
    success: entry.success,
    error: entry.error ? entry.error.slice(0, 500) : null,
    duration_ms: entry.durationMs,
  };
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("mcp_audit_log").insert({
      ...base,
      risk: entry.risk ?? "read",
      client_kind: entry.caller.clientKind,
      entity: entry.entity ?? null,
      record_id: entry.recordId ?? null,
      before: trimSnapshot(entry.before),
      after: trimSnapshot(entry.after),
      confirmation_id: entry.confirmationId ?? null,
      cap_group: entry.capGroup ?? null,
    });
    // Before the Phase A migration: keep logging with the original columns.
    if (error) await supabase.from("mcp_audit_log").insert(base);
  } catch (err) {
    console.error("[mcp] audit log write failed", err);
  }
}

// In-memory token bucket per staff member. Fine for the single app container;
// move to Postgres/Redis if the app ever runs more than one instance.
const RATE_PER_MIN = Number(process.env.MCP_RATE_PER_MIN) || 120;
const buckets = new Map<string, { tokens: number; at: number }>();

export function takeRateToken(staffId: string): boolean {
  const now = Date.now();
  const b = buckets.get(staffId) ?? { tokens: RATE_PER_MIN, at: now };
  b.tokens = Math.min(RATE_PER_MIN, b.tokens + ((now - b.at) / 60_000) * RATE_PER_MIN);
  b.at = now;
  if (b.tokens < 1) { buckets.set(staffId, b); return false; }
  b.tokens -= 1;
  buckets.set(staffId, b);
  return true;
}
