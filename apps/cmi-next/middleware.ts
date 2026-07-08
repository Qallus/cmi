import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "cmi-session";
const CLIENT_SESSION_COOKIE = "cmi-client-session";
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/_next", "/favicon", "/brand"];
// Client-portal paths that must stay reachable without a client session.
const CLIENT_PUBLIC_PATHS = ["/client/login", "/client/set-account", "/api/client/auth"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Client portal (separate session cookie from staff) ──
  if (pathname.startsWith("/client")) {
    if (CLIENT_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
    const clientSession = request.cookies.get(CLIENT_SESSION_COOKIE);
    if (!clientSession?.value) {
      const loginUrl = new URL("/client/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Staff dashboard ──
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE);
  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/client/:path*"],
};
