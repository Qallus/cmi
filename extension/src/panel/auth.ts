import { AUTH_URL } from "./config";

// The session token is written by the service worker into session storage
// (cleared when the browser closes). The panel reads it and watches for changes.

export async function getToken(): Promise<string | null> {
  const r = await chrome.storage.session.get(["cmi_token"]);
  return (r.cmi_token as string | undefined) ?? null;
}

export async function getStaffName(): Promise<string | null> {
  const r = await chrome.storage.session.get(["cmi_staff_name"]);
  return (r.cmi_staff_name as string | undefined) ?? null;
}

export async function clearToken(): Promise<void> {
  await chrome.storage.session.remove(["cmi_token", "cmi_staff_name"]);
}

export function openSignIn(): void {
  chrome.tabs.create({ url: AUTH_URL });
}

// Subscribe to token changes (sign-in completing in the handoff tab). Returns an
// unsubscribe function.
export function onTokenChange(cb: (token: string | null) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "session" && changes.cmi_token) {
      cb((changes.cmi_token.newValue as string | undefined) ?? null);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
