// Server-side guard for the agent routes.
//
// Mirrors lib/reporting/guard.ts and lib/prequal/guard.ts. It also builds the
// StaffContext, which both agent routes previously constructed by hand from
// identical copies of the same seven lines — a third copy was going to appear
// the moment anything else called the agent.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canReadFinancials, canUseBolt } from "./access";
import type { StaffContext } from "./types";

/**
 * Authenticate, then require a role the sidebar actually offers Bolt to.
 *
 * Returns the StaffContext every tool call is gated against, so a caller
 * cannot accidentally assemble one with the wrong role.
 */
export async function requireBolt(request: Request): Promise<{ ctx: StaffContext }> {
  const { user, staff } = await requireAdmin(request);

  if (!canUseBolt(staff.role_slug)) {
    throw new AuthError(`Forbidden — Bolt isn't available for your role (${staff.role_slug}).`, 403);
  }

  const record = staff as { display_name?: string | null };
  return {
    ctx: {
      id: staff.id,
      email: user.email ?? "",
      displayName: record.display_name || user.email || "Staff",
      role: staff.role_slug,
      // Previously this was set from a dead ADMIN_ROLES const that nothing
      // read. It now means something: may this person see money?
      isAdmin: canReadFinancials(staff.role_slug),
    },
  };
}

export function boltErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}
