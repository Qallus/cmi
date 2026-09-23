// Server guard for the internal qualification workspace. An application holds
// a company's licence, insurance and financial capacity, so the check lives
// here rather than trusting the nav or the page.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isFeatureEnabled } from "@/lib/flags";
import { canUsePrequal, canDecidePrequal, PREQUAL_FLAG } from "./access";
import { PrequalError } from "./data";

export async function requirePrequal(request: Request) {
  const ctx = await requireAdmin(request);
  if (!canUsePrequal(ctx.staff.role_slug)) throw new AuthError("Forbidden — trade partner records are Admin, PM and Estimator only.", 403);
  if (!(await isFeatureEnabled(PREQUAL_FLAG))) throw new AuthError("Not found.", 404);
  return {
    ...ctx,
    actor: { id: ctx.staff.id as string, name: ctx.user.email ?? null },
    canDecide: canDecidePrequal(ctx.staff.role_slug),
  };
}

/** Approving a partner, or marking a document verified, is a narrower job. */
export async function requirePrequalDecide(request: Request) {
  const ctx = await requirePrequal(request);
  if (!ctx.canDecide) throw new AuthError(`Your role (${ctx.staff.role_slug}) can't approve or verify.`, 403);
  return ctx;
}

export function prequalErrorResponse(err: unknown) {
  if (err instanceof PrequalError || err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
