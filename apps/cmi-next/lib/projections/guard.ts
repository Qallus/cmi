// Server guard for every Projections API route: a staff session (requireAdmin),
// an Admin / Super Admin role, and the feature flag. Financial data, so the
// check lives here rather than trusting the nav or the page.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseProjections, PROJECTIONS_FLAG } from "./access";
import { ProjectionError } from "./data";

export async function requireProjections(request: Request) {
  const ctx = await requireAdmin(request);
  if (!canUseProjections(ctx.staff.role_slug)) throw new AuthError("Forbidden — Projections are Admin only.", 403);
  if (!(await isFeatureEnabled(PROJECTIONS_FLAG))) throw new AuthError("Not found.", 404);
  return { ...ctx, actor: { id: ctx.staff.id as string, name: ctx.user.email ?? null } };
}

// Uniform JSON error for Projections routes.
export function projectionErrorResponse(err: unknown) {
  if (err instanceof ProjectionError || err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
