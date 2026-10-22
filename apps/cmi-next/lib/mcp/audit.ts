// One mcp_audit_log row per tool call, plus a per-person rate limit.
// Neither ever throws into the tool call.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { McpCaller } from "./auth";
import { redactArgs } from "./policy";

export async function logToolCall(entry: {
  caller: McpCaller; tool: string; args: Record<string, unknown>;
  success: boolean; error?: string | null; durationMs: number; targetUserEmail?: string | null;
}): Promise<void> {
  try {
    await getSupabaseAdmin().from("mcp_audit_log").insert({
      staff_user_id: entry.caller.ctx.id,
      client_id: entry.caller.clientId,
      tool: entry.tool,
      target_user_email: entry.targetUserEmail ?? null,
      args: redactArgs(entry.args),
      success: entry.success,
      error: entry.error ? entry.error.slice(0, 500) : null,
      duration_ms: entry.durationMs,
    });
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
