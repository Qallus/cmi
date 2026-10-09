// Shared-secret guard for scheduled endpoints (Coolify Scheduled Tasks).
//
// There's no user behind a cron, so these routes take AUTOMATION_SECRET as a
// Bearer token or an x-automation-secret header instead of a session.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Constant-time compare, so the secret can't be guessed a character at a time. */
function secretOk(provided: string | null): boolean {
  const expected = process.env.AUTOMATION_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Null when the caller holds the secret; otherwise the response to return. */
export function authorizeAutomation(request: Request): NextResponse | null {
  if (!process.env.AUTOMATION_SECRET) {
    return NextResponse.json({ error: "AUTOMATION_SECRET is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-automation-secret");
  if (!secretOk(token)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return null;
}
