// What the MCP server exposes, per caller. Pure (no I/O, no path aliases) so
// lib/mcp/policy.test.mjs can run it directly.
//
// Bolt's entity reads don't check roles. MCP adds a money gate on top: callers
// who can't read financials (canReadFinancials → ctx.isAdmin) don't get the
// financial entities, and money fields are stripped from every result.
import type { StaffContext } from "../agent/types";

/** Entities that are financial records in themselves. */
export const FINANCIAL_ENTITIES = ["invoice", "change_order"] as const;
/** Dashboard-internal entities with no use from Claude. */
export const HIDDEN_ENTITIES = ["page_review_note", "page_review_export"] as const;
/** Staff accounts (emails, roles, status): admins only. */
export const ADMIN_ENTITIES = ["user"] as const;
const ADMIN_ROLES = ["super_admin", "admin"];

export function entityAllowed(entity: string, ctx: Pick<StaffContext, "role" | "isAdmin">): boolean {
  if ((HIDDEN_ENTITIES as readonly string[]).includes(entity)) return false;
  if ((FINANCIAL_ENTITIES as readonly string[]).includes(entity) && !ctx.isAdmin) return false;
  if ((ADMIN_ENTITIES as readonly string[]).includes(entity) && !ADMIN_ROLES.includes(ctx.role)) return false;
  return true;
}

// Field names that carry money. Matched on the key, at any depth.
const MONEY_KEYS = new Set([
  "amount", "amount_paid", "balance", "open_balance", "openbalance",
  "contract_price", "contract_value", "client_price", "unit_price", "price", "cost", "unit_cost",
  "subtotal", "estimated_value", "budget", "budget_amount", "markup", "margin",
  "billed", "retainage",
]);
const MONEY_COLLECTIONS = new Set(["invoices", "change_orders", "payments", "billing"]);

/** Deep copy with money fields and financial collections removed. */
export function redactFinancial<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => redactFinancial(v)) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const k = key.toLowerCase();
    if (MONEY_COLLECTIONS.has(k) || MONEY_KEYS.has(k) || /(_price|_cost|_amount|_value)$/.test(k)) continue;
    out[key] = redactFinancial(v);
  }
  return out as T;
}

export class ScopeError extends Error {}

/**
 * Whose data a person-scoped tool (briefing, tasks, later Gmail/Drive) may
 * read. Everyone reads their own; only the company-wide allowlist reads others.
 */
export function scopeUserEmail(requested: unknown, caller: { email: string; companyWide: boolean }): string {
  const own = caller.email.toLowerCase();
  const want = typeof requested === "string" && requested.trim() ? requested.trim().toLowerCase() : own;
  if (want !== own && !caller.companyWide) {
    throw new ScopeError("You can only read your own data. Company-wide access is granted in Settings → Claude.");
  }
  return want;
}

/** Shrink tool arguments for the audit log: no long text, no secrets. */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    if (/token|secret|password|key/i.test(k)) { out[k] = "[redacted]"; continue; }
    if (typeof v === "string") out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
    else if (v && typeof v === "object") out[k] = JSON.stringify(v).length > 500 ? "[object]" : v;
    else out[k] = v;
  }
  return out;
}
