import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "cmi-session";
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health", "/_next", "/favicon", "/brand"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only gate dashboard routes
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Allow paths that should be public even under /dashboard (none expected, but safe guard)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE);

  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
