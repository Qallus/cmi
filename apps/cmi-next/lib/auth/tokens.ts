// Session cookie helpers shared by middleware (edge), route handlers and
// server components. No next/headers import here so it stays edge-safe.
//
// Supabase access tokens last about an hour; the refresh token is what keeps
// someone signed in. We store both: the access token for request auth, the
// refresh token to mint a new one before (or just after) it expires.
export const SESSION_COOKIE = "cmi-session";
export const REFRESH_COOKIE = "cmi-refresh";
export const SESSION_MAX_AGE = 60 * 60 * 8;       // 8 hours
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
/** Refresh this many seconds before the access token actually expires. */
export const REFRESH_SKEW_SECONDS = 120;

export type SessionTokens = { access_token: string; refresh_token: string; expires_in?: number };

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge,
    path: "/",
  };
}

/** Seconds until this JWT expires (negative when already expired); null if unreadable. */
export function secondsUntilExpiry(jwt: string | undefined | null): number | null {
  if (!jwt) return null;
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = JSON.parse(json)?.exp;
    if (typeof exp !== "number") return null;
    return exp - Math.floor(Date.now() / 1000);
  } catch {
    return null;
  }
}

export function needsRefresh(accessToken: string | undefined | null): boolean {
  const left = secondsUntilExpiry(accessToken);
  return left === null ? false : left <= REFRESH_SKEW_SECONDS;
}

/**
 * Exchange a refresh token for a fresh session. Uses the Supabase auth REST
 * endpoint directly (works in the edge runtime, no SDK needed). Returns null
 * if the refresh token is spent or revoked — the caller then signs the user out.
 */
export async function refreshSession(refreshToken: string): Promise<SessionTokens | null> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !refreshToken) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json() as Partial<SessionTokens>;
    if (!json.access_token || !json.refresh_token) return null;
    return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in };
  } catch {
    return null;
  }
}
