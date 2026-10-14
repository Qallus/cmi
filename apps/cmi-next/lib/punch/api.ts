// Shared guard + error handling for the punch list API routes. Any staff
// member can read; writing needs one of PUNCH_WRITE_ROLES. Server only.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { canWritePunch } from "./types";
import { PunchError } from "./data";

export async function punchSession(request: Request, write: boolean) {
  const { user, staff } = await requireAdmin(request);
  if (write && !canWritePunch(staff.role_slug)) {
    throw new AuthError(`Your role (${staff.role_slug}) can't change punch lists.`, 403);
  }
  return { staff, actor: { id: staff.id as string, name: (staff.display_name as string | null) || user.email || null } };
}

export function punchError(err: unknown) {
  const e = err as PunchError | AuthError;
  return NextResponse.json({ error: e.message || "Something went wrong." }, { status: e.status ?? 500 });
}
