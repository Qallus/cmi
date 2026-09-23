import { NextResponse } from "next/server";
import { SESSION_COOKIE, REFRESH_COOKIE, cookieOptions } from "@/lib/auth/tokens";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  for (const name of [SESSION_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set(name, "", cookieOptions(0));
  }
  return response;
}
