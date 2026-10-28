// High-risk MCP actions wait here for the person's go-ahead. The tool call
// stores its own arguments and a preview; cmi_confirm runs exactly those
// stored arguments once, for the same person and app, within 15 minutes.
// Nothing the AI client sends back at confirm time is trusted. Server-only.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { McpCaller } from "./auth";
import { pendingProblem, PENDING_TTL_MS } from "./safety";

export type Preview = {
  /** One plain sentence: what will happen. */
  summary: string;
  /** Anything the person should see before agreeing (recipient, record, fields). */
  details?: Record<string, unknown>;
  entity?: string;
  recordId?: string;
};

export type PendingAction = {
  id: string; tool: string; args: Record<string, unknown>; preview: Preview; status: string; expires_at: string; created_at: string;
};

export async function createPending(caller: McpCaller, tool: string, args: Record<string, unknown>, preview: Preview): Promise<PendingAction> {
  const { data, error } = await getSupabaseAdmin().from("mcp_pending_actions").insert({
    staff_user_id: caller.ctx.id, token_id: caller.tokenId, client_id: caller.clientId, client_kind: caller.clientKind,
    tool, args, preview, risk: "high", expires_at: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  }).select("id, tool, args, preview, status, expires_at, created_at").single();
  if (error || !data) throw new Error(`Couldn't hold the action for confirmation: ${error?.message ?? "unknown error"}`);
  return data as PendingAction;
}

/**
 * Claim a pending action for execution. The status flip is the lock: only one
 * confirm can move it from pending, so a double-click can't run it twice.
 */
export async function claimPending(id: string, caller: McpCaller): Promise<PendingAction> {
  const supabase = getSupabaseAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("That confirmation id doesn't exist.");
  const { data: claimed } = await supabase.from("mcp_pending_actions")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id).eq("staff_user_id", caller.ctx.id).eq("status", "pending").gt("expires_at", new Date().toISOString())
    .select("id, tool, args, preview, status, expires_at, created_at, client_id").maybeSingle();
  if (claimed && (!claimed.client_id || claimed.client_id === caller.clientId)) return claimed as PendingAction;

  // Explain why not (and undo a claim that came from another app).
  const { data: row } = await supabase.from("mcp_pending_actions").select("staff_user_id, status, expires_at, client_id").eq("id", id).maybeSingle();
  if (claimed) {
    await supabase.from("mcp_pending_actions").update({ status: "pending", confirmed_at: null }).eq("id", id);
    throw new Error(pendingProblem({ ...row!, status: "pending" }, { staffId: caller.ctx.id, clientId: caller.clientId }) ?? "Can't confirm that here.");
  }
  if (row && row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()) {
    await supabase.from("mcp_pending_actions").update({ status: "expired" }).eq("id", id);
  }
  throw new Error(pendingProblem(row, { staffId: caller.ctx.id, clientId: caller.clientId }) ?? "Can't confirm that action.");
}

export async function finishPending(id: string, outcome: { result?: unknown; error?: string | null }): Promise<void> {
  await getSupabaseAdmin().from("mcp_pending_actions").update(
    outcome.error ? { status: "failed", error: outcome.error.slice(0, 500) } : { result: outcome.result ?? null },
  ).eq("id", id);
}

export async function cancelPending(id: string, caller: McpCaller): Promise<boolean> {
  const { data } = await getSupabaseAdmin().from("mcp_pending_actions").update({ status: "cancelled" })
    .eq("id", id).eq("staff_user_id", caller.ctx.id).eq("status", "pending").select("id").maybeSingle();
  return !!data;
}

export async function listPending(caller: McpCaller): Promise<PendingAction[]> {
  const { data } = await getSupabaseAdmin().from("mcp_pending_actions")
    .select("id, tool, args, preview, status, expires_at, created_at")
    .eq("staff_user_id", caller.ctx.id).eq("status", "pending").gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false }).limit(20);
  return (data ?? []) as PendingAction[];
}
