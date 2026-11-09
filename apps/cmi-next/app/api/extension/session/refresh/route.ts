import { NextResponse } from "next/server";
import { refreshSession } from "@/lib/auth/tokens";
import { corsHeaders, preflight } from "@/lib/extension/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// The extension reuses the dashboard's own sign-in (it reads the session cookies
// with chrome.cookies). When the access token has expired it sends the refresh
// token here and writes the rotated pair straight back into the dashboard's
// cookies, so the dashboard and the extension stay on one session. The refresh
// token is the credential; the new access token is checked by /session as usual.
export async function POST(request: Request) {
  const headers = corsHeaders(request);
  const body = (await request.json().catch(() => ({}))) as { refresh_token?: unknown };
  const token = typeof body.refresh_token === "string" ? body.refresh_token : "";
  if (!token) return NextResponse.json({ error: "Missing refresh token." }, { status: 400, headers });
  const next = await refreshSession(token);
  if (!next) return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401, headers });
  return NextResponse.json({ access_token: next.access_token, refresh_token: next.refresh_token, expires_in: next.expires_in ?? null }, { headers });
}
