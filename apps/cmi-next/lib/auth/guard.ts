// Drop-in guard for API routes: returns a 401/403 response when the caller
// isn't signed-in staff, or null to continue. Reads the session from cookies,
// so it works in handlers that don't take a Request (e.g. `GET()`).
//
//   export async function GET() {
//     const denied = await denyUnlessStaff(); if (denied) return denied;
//     …
//   }
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin, AuthError } from "./require-admin";
import { SESSION_COOKIE, REFRESH_COOKIE } from "./tokens";

export type StaffSession = Awaited<ReturnType<typeof requireAdmin>>;

/** Resolve the signed-in staff member from cookies (refreshing if needed). */
export async function getStaffSession(): Promise<StaffSession> {
  const jar = await cookies();
  const header = [SESSION_COOKIE, REFRESH_COOKIE]
    .map((name) => { const v = jar.get(name)?.value; return v ? `${name}=${encodeURIComponent(v)}` : null; })
    .filter(Boolean)
    .join("; ");
  return requireAdmin(new Request("http://internal/", { headers: { cookie: header } }));
}

/**
 * Null when the caller is staff (and, if `roles` is given, holds one of them);
 * otherwise the response to return.
 */
export async function denyUnlessStaff(roles?: readonly string[]): Promise<NextResponse | null> {
  try {
    const { staff } = await getStaffSession();
    if (roles && !roles.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't do that.` }, { status: 403 });
    }
    return null;
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message ?? "Unauthorized." }, { status: e.status ?? 401 });
  }
}
