// Server guard for the dashboard routes: a signed-in staff member, with the
// dashboard_v2 flag on.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isFeatureEnabled, loadFlags } from "@/lib/flags";
import { DASHBOARD_FLAG } from "./access";

export async function requireDashboard(request: Request) {
  const ctx = await requireAdmin(request);
  if (!(await isFeatureEnabled(DASHBOARD_FLAG))) throw new AuthError("Not found.", 404);
  return { ...ctx, staffId: ctx.staff.id as string, role: ctx.staff.role_slug as string, flags: await loadFlags() };
}

export function dashboardError(err: unknown) {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
