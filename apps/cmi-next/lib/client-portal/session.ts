// Set / clear the client-portal cookie pair on a route-handler response.
import type { NextResponse } from "next/server";
import {
  CLIENT_SESSION_COOKIE, CLIENT_REFRESH_COOKIE, CLIENT_SESSION_MAX_AGE, CLIENT_REFRESH_MAX_AGE, cookieOptions,
} from "@/lib/auth/tokens";

export function setClientSessionCookies(res: NextResponse, accessToken: string, refreshToken?: string | null) {
  res.cookies.set(CLIENT_SESSION_COOKIE, accessToken, cookieOptions(CLIENT_SESSION_MAX_AGE));
  if (refreshToken) res.cookies.set(CLIENT_REFRESH_COOKIE, refreshToken, cookieOptions(CLIENT_REFRESH_MAX_AGE));
}

export function clearClientSessionCookies(res: NextResponse) {
  res.cookies.set(CLIENT_SESSION_COOKIE, "", cookieOptions(0));
  res.cookies.set(CLIENT_REFRESH_COOKIE, "", cookieOptions(0));
}
