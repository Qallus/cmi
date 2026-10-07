// Who may use Bolt, and who may see money through it.
//
// Follows the house convention (see lib/reporting/access.ts): this file holds
// credential-free constants only, so client components can import it; the
// server-only checks live in ./guard.ts.
//
// Before this existed, the agent routes called requireAdmin and nothing else,
// so every staff role reached Bolt while the sidebar advertised it to six.
// The sidebar was the honest description; this makes it true.

/** Roles the sidebar already offers Bolt to (components/dashboard/nav.tsx). */
export const BOLT_ROLES = [
  "super_admin",
  "admin",
  "project_manager",
  "designer",
  "estimator",
  "superintendent",
] as const;

export type BoltRole = (typeof BOLT_ROLES)[number];

/**
 * Roles that may see contract values, invoice amounts and client pricing.
 *
 * Separate from BOLT_ROLES because the useful split is not "can use Bolt" but
 * "can see money". A designer has a real reason to ask about a job and no
 * reason to learn its contract price.
 */
export const BOLT_FINANCIAL_ROLES = ["super_admin", "admin", "project_manager"] as const;

export function canUseBolt(role: string | null | undefined): role is BoltRole {
  return !!role && (BOLT_ROLES as readonly string[]).includes(role);
}

export function canReadFinancials(role: string | null | undefined): boolean {
  return !!role && (BOLT_FINANCIAL_ROLES as readonly string[]).includes(role);
}
