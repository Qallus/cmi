// Server guard for the Interviews module. An interview holds a company's
// licence, insurance and financial capacity, plus internal notes that must
// never reach the partner, so the check lives here rather than in the nav.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseInterviews, canManageTemplates, INTERVIEWS_FLAG } from "./access";
import { InterviewError } from "./data";

export async function requireInterviews(request: Request) {
  const ctx = await requireAdmin(request);
  if (!canUseInterviews(ctx.staff.role_slug)) {
    throw new AuthError("Forbidden — interviews are Admin, PM and Estimator only.", 403);
  }
  if (!(await isFeatureEnabled(INTERVIEWS_FLAG))) throw new AuthError("Not found.", 404);
  return {
    ...ctx,
    actor: { id: ctx.staff.id as string, name: ctx.user.email ?? null },
    canManageTemplates: canManageTemplates(ctx.staff.role_slug),
  };
}

/** Editing the questionnaire everyone else works from. */
export async function requireTemplateAdmin(request: Request) {
  const ctx = await requireInterviews(request);
  if (!ctx.canManageTemplates) {
    throw new AuthError(`Your role (${ctx.staff.role_slug}) can't edit interview templates.`, 403);
  }
  return ctx;
}

export function interviewErrorResponse(err: unknown) {
  if (err instanceof InterviewError || err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
