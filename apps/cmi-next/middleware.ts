import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE, REFRESH_COOKIE, SESSION_MAX_AGE, REFRESH_MAX_AGE, cookieOptions, needsRefresh, refreshSession,
  CLIENT_SESSION_COOKIE, CLIENT_REFRESH_COOKIE, CLIENT_SESSION_MAX_AGE, CLIENT_REFRESH_MAX_AGE,
} from "@/lib/auth/tokens";
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/_next", "/favicon", "/brand"];
// Client-portal paths that must stay reachable without a client session.
const CLIENT_PUBLIC_PATHS = [
  "/client/login", "/client/set-account", "/client/forgot-password", "/client/reset-password", "/api/client/auth",
];

// Mint a fresh client session from the refresh cookie and pass it downstream on
// this same request. Null when there's nothing to refresh or the token is spent.
async function refreshClient(request: NextRequest): Promise<NextResponse | null> {
  const session = request.cookies.get(CLIENT_SESSION_COOKIE)?.value;
  const refresh = request.cookies.get(CLIENT_REFRESH_COOKIE)?.value;
  if (!refresh || (session && !needsRefresh(session))) return null;
  const next = await refreshSession(refresh);
  if (!next) return null;
  const headers = new Headers(request.headers);
  const jar = request.cookies;
  jar.set(CLIENT_SESSION_COOKIE, next.access_token);
  jar.set(CLIENT_REFRESH_COOKIE, next.refresh_token);
  headers.set("cookie", jar.toString());
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(CLIENT_SESSION_COOKIE, next.access_token, cookieOptions(CLIENT_SESSION_MAX_AGE));
  response.cookies.set(CLIENT_REFRESH_COOKIE, next.refresh_token, cookieOptions(CLIENT_REFRESH_MAX_AGE));
  return response;
}

// Campaign domains funnel into CMI. Each serves its own landing page at the
// root; all other paths still resolve against the shared app.
const LANDING_HOSTS: Record<string, string> = {
  "designbuildenjoy.com": "/lp/design-build-enjoy",
  "www.designbuildenjoy.com": "/lp/design-build-enjoy",
  "constructionsucks.com": "/lp/construction-sucks",
  "www.constructionsucks.com": "/lp/construction-sucks",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Campaign landing domains (serve their page at "/") ──
  const host = request.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const landing = LANDING_HOSTS[host];
  if (landing && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = landing;
    return NextResponse.rewrite(url);
  }

  // ── Client portal API: keep the session fresh; each handler authorizes itself ──
  if (pathname.startsWith("/api/client")) {
    if (pathname.startsWith("/api/client/auth")) return NextResponse.next();
    return (await refreshClient(request)) ?? NextResponse.next();
  }

  // ── Client portal (separate session cookie from staff) ──
  if (pathname.startsWith("/client")) {
    if (CLIENT_PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();
    const refreshed = await refreshClient(request);
    if (refreshed) return refreshed;
    const clientSession = request.cookies.get(CLIENT_SESSION_COOKIE);
    // A staff "Preview as client" carries its own signed cookie; the pages verify it.
    if (!clientSession?.value && !request.cookies.get("cmi-client-preview")?.value) {
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
  const refresh = request.cookies.get(REFRESH_COOKIE);

  // Access token about to expire (or already gone) but we still hold a refresh
  // token: mint a new session so the page — and the API calls it makes — keep
  // working. The refreshed token is passed downstream on this same request.
  if (refresh?.value && (!session?.value || needsRefresh(session.value))) {
    const next = await refreshSession(refresh.value);
    if (next) {
      const headers = new Headers(request.headers);
      const jar = request.cookies;
      jar.set(SESSION_COOKIE, next.access_token);
      jar.set(REFRESH_COOKIE, next.refresh_token);
      headers.set("cookie", jar.toString());
      const response = NextResponse.next({ request: { headers } });
      response.cookies.set(SESSION_COOKIE, next.access_token, cookieOptions(SESSION_MAX_AGE));
      response.cookies.set(REFRESH_COOKIE, next.refresh_token, cookieOptions(REFRESH_MAX_AGE));
      return response;
    }
    // Refresh token is spent — fall through to the login redirect below.
  }

  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/client/:path*", "/api/client/:path*"],
};
