// Server guard for every Reporting route: a staff session, an allowed role and
// the feature flag. Reports carry contract values and client status, so the
// check lives here rather than trusting the nav or the page.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isFeatureEnabled } from "@/lib/flags";
import { canUseReporting, canEditReports, REPORTING_FLAG } from "./access";
import { ReportingError } from "./data";

export async function requireReporting(request: Request) {
  const ctx = await requireAdmin(request);
  if (!canUseReporting(ctx.staff.role_slug)) throw new AuthError("Forbidden — Reporting is Admin and PM only.", 403);
  if (!(await isFeatureEnabled(REPORTING_FLAG))) throw new AuthError("Not found.", 404);
  return {
    ...ctx,
    actor: { id: ctx.staff.id as string, name: ctx.user.email ?? null },
    canEdit: canEditReports(ctx.staff.role_slug),
  };
}

/** Same, but rejects read-only roles up front. */
export async function requireReportingWrite(request: Request) {
  const ctx = await requireReporting(request);
  if (!ctx.canEdit) throw new AuthError(`Your role (${ctx.staff.role_slug}) can't edit reports.`, 403);
  return ctx;
}

export function reportingErrorResponse(err: unknown) {
  if (err instanceof ReportingError || err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
