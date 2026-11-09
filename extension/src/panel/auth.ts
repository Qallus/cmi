import { API_BASE, AUTH_URL } from "./config";

// Sign-in reuses the CMI dashboard's own session: if you're signed in to the
// dashboard in this browser, the panel reads its session cookies (chrome.cookies
// can read HttpOnly cookies for hosts the extension may access) and you never
// see a sign-in step. An expired access token is refreshed through the app and
// the rotated tokens are written back into the dashboard's cookies, so the
// dashboard and the panel always share one session (Supabase rotates refresh
// tokens; two copies drifting apart would sign one of them out).
//
// Fallback: the /extension-auth handoff tab still works; its token is kept in
// session storage (cleared when the browser closes).

const SESSION_COOKIE = "cmi-session";
const REFRESH_COOKIE = "cmi-refresh";
const SESSION_MAX_AGE = 60 * 60 * 8; // matches the app's cookieOptions
const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
const SKEW_SECONDS = 120;

function secondsLeft(jwt: string | null | undefined): number | null {
  const part = jwt?.split(".")[1];
  if (!part) return null;
  try {
    const exp = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")))?.exp;
    return typeof exp === "number" ? exp - Math.floor(Date.now() / 1000) : null;
  } catch {
    return null;
  }
}
const fresh = (jwt: string | null | undefined) => !!jwt && (secondsLeft(jwt) ?? 0) > SKEW_SECONDS;

async function readCookie(name: string): Promise<string | null> {
  const c = await chrome.cookies.get({ url: API_BASE, name }).catch(() => null);
  return c?.value || null;
}

async function writeCookie(name: string, value: string, maxAge: number): Promise<void> {
  // Same attributes the app sets (host-only, path /, HttpOnly, Secure, SameSite=Strict).
  await chrome.cookies.set({
    url: API_BASE, name, value, path: "/", httpOnly: true, secure: true, sameSite: "strict",
    expirationDate: Math.floor(Date.now() / 1000) + maxAge,
  }).catch(() => null);
}

// One refresh at a time: two calls together must not spend the same refresh token twice.
let refreshing: Promise<string | null> | null = null;
function refreshFromCookie(refreshToken: string): Promise<string | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/extension/session/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { access_token?: string; refresh_token?: string };
      if (!j.access_token || !j.refresh_token) return null;
      await writeCookie(SESSION_COOKIE, j.access_token, SESSION_MAX_AGE);
      await writeCookie(REFRESH_COOKIE, j.refresh_token, REFRESH_MAX_AGE);
      return j.access_token;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function getToken(): Promise<string | null> {
  const r = await chrome.storage.session.get(["cmi_token", "cmi_paused"]);
  // "Sign out" in the panel pauses it until you choose Sign in again.
  if (r.cmi_paused) return null;

  // 1. The dashboard's session in this browser.
  const access = await readCookie(SESSION_COOKIE);
  if (fresh(access)) return access;
  const refresh = await readCookie(REFRESH_COOKIE);
  if (refresh) {
    const renewed = await refreshFromCookie(refresh);
    if (renewed) return renewed;
  }

  // 2. A token handed over by the /extension-auth tab, while it's still valid.
  const handed = (r.cmi_token as string | undefined) ?? null;
  return handed && (secondsLeft(handed) ?? 1) > 0 ? handed : null;
}

export async function getStaffName(): Promise<string | null> {
  const r = await chrome.storage.session.get(["cmi_staff_name"]);
  return (r.cmi_staff_name as string | undefined) ?? null;
}

/** A rejected session: drop the handed-over token (the dashboard cookies are left alone). */
export async function forgetToken(): Promise<void> {
  await chrome.storage.session.remove(["cmi_token", "cmi_staff_name"]);
}

/** Panel "Sign out": forget the handed-over token and stop reusing the dashboard session until Sign in. */
export async function clearToken(): Promise<void> {
  await forgetToken();
  await chrome.storage.session.set({ cmi_paused: true });
}

// Sign in: if the dashboard is already signed in, that's all it takes. Otherwise
// open the sign-in tab, remembering the page you were on (the vendor page the
// panel is building from) so the service worker can bring you back to it and
// close the sign-in tab once the session arrives.
export async function openSignIn(): Promise<void> {
  await chrome.storage.session.remove(["cmi_paused"]);
  if (await getToken()) {
    await chrome.storage.session.set({ cmi_signed_in_at: Date.now() }); // wakes the panel (onTokenChange)
    return;
  }
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const authTab = await chrome.tabs.create({ url: AUTH_URL });
  await chrome.storage.session.set({ cmi_return_tab: current?.id ?? null, cmi_auth_tab: authTab.id ?? null });
}

// Re-check when anything that decides sign-in changes: the handed-over token,
// Sign in / Sign out in the panel, or the dashboard signing in or out in this
// browser. Returns an unsubscribe function.
export function onTokenChange(cb: () => void): () => void {
  const storageListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "session" && (changes.cmi_token || changes.cmi_paused || changes.cmi_signed_in_at)) cb();
  };
  const host = new URL(API_BASE).hostname;
  const cookieListener = (info: chrome.cookies.CookieChangeInfo) => {
    // Refresh writes replace the cookie ("overwrite"); only a real sign-in or sign-out matters here.
    if (info.cookie.name === SESSION_COOKIE && info.cookie.domain.replace(/^\./, "") === host && info.cause !== "overwrite") cb();
  };
  chrome.storage.onChanged.addListener(storageListener);
  chrome.cookies.onChanged.addListener(cookieListener);
  return () => {
    chrome.storage.onChanged.removeListener(storageListener);
    chrome.cookies.onChanged.removeListener(cookieListener);
  };
}
