// Server guard for the Events builder and its API. The nav hides the page, but
// every route checks role and flag here.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { isFeatureEnabled } from "@/lib/flags";
import { canManageEvents, EVENTS_FLAG } from "./access";
import { EventError } from "./data";

export async function requireEvents(request: Request) {
  const ctx = await requireAdmin(request);
  if (!canManageEvents(ctx.staff.role_slug)) throw new AuthError("Forbidden: events are Admin, PM and Estimator only.", 403);
  if (!(await isFeatureEnabled(EVENTS_FLAG))) throw new AuthError("Not found.", 404);
  return { ...ctx, actorId: ctx.staff.id as string };
}

export function eventErrorResponse(err: unknown) {
  if (err instanceof EventError || err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
