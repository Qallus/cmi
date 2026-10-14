// Shared guard for the executive summary routes. Server only.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { SUMMARY_ROLES } from "./deliver";
import type { Audience, SummaryTarget } from "./snapshot";

export async function summarySession(request: Request) {
  const { user, staff } = await requireAdmin(request);
  if (!SUMMARY_ROLES.includes(staff.role_slug)) throw new AuthError(`Your role (${staff.role_slug}) can't create executive summaries.`, 403);
  return { id: staff.id as string, role: staff.role_slug as string, name: (staff.display_name as string | null) || user.email || "CMI" };
}

export function parseTarget(target: unknown, id: unknown): { target: SummaryTarget; id: string } | null {
  if ((target !== "job" && target !== "precon") || typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { target, id };
}

export const parseAudience = (a: unknown): Audience => (a === "client" ? "client" : "team");

export function summaryError(err: unknown) {
  const e = err as Error & { status?: number };
  return NextResponse.json({ error: e.message || "Something went wrong." }, { status: e.status ?? 500 });
}
