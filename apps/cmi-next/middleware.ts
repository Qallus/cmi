import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "cmi-session";
const CLIENT_SESSION_COOKIE = "cmi-client-session";
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/_next", "/favicon", "/brand"];
// Client-portal paths that must stay reachable without a client session.
const CLIENT_PUBLIC_PATHS = ["/client/login", "/client/set-account", "/api/client/auth"];

// Campaign domains funnel into CMI. Each serves its own landing page at the
// root; all other paths still resolve against the shared app.
const LANDING_HOSTS: Record<string, string> = {
  "designbuildenjoy.com": "/lp/design-build-enjoy",
  "www.designbuildenjoy.com": "/lp/design-build-enjoy",
  "constructionsucks.com": "/lp/construction-sucks",
  "www.constructionsucks.com": "/lp/construction-sucks",
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Campaign landing domains (serve their page at "/") ──
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const landing = LANDING_HOSTS[host];
  if (landing && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = landing;
    return NextResponse.rewrite(url);
  }

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
  matcher: ["/", "/dashboard/:path*", "/client/:path*"],
};
