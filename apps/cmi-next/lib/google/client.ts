// Google Workspace access for the CMI MCP server: a service account with
// domain-wide delegation, read-only, acting as one staff member at a time.
// Setup: docs/ai-os/google-dwd-setup.md. Server-only.
//
// Whose mailbox a request may read is decided by the caller (lib/mcp/policy
// scopeUserEmail). This module adds a second wall: the subject must be an
// active CMI staff member on the Workspace domain.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { buildAssertion, parseServiceAccount, type ServiceAccount } from "./parse";

export class GoogleError extends Error {}

function config(): { sa: ServiceAccount; domain: string } | null {
  const sa = parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim().toLowerCase();
  return sa && domain ? { sa, domain } : null;
}

export function googleConfigured(): boolean {
  return config() !== null;
}

/** Throws unless `email` is an active staff member on the Workspace domain. */
export async function assertWorkspaceStaff(email: string): Promise<void> {
  const cfg = config();
  if (!cfg) throw new GoogleError("Google Workspace isn't connected yet (see docs/ai-os/google-dwd-setup.md).");
  if (!email.toLowerCase().endsWith(`@${cfg.domain}`)) {
    throw new GoogleError(`${email} isn't a ${cfg.domain} Google mailbox. Connect Claude with your @${cfg.domain} CMI account.`);
  }
  const { data } = await getSupabaseAdmin().from("staff_users").select("id")
    .ilike("email", email.replace(/[%_\\]/g, "\\$&")).in("status", ["active", "invited"]).maybeSingle();
  if (!data) throw new GoogleError(`${email} isn't an active CMI staff member.`);
}

const tokenCache = new Map<string, { token: string; exp: number }>();

async function accessToken(subject: string, scope: string): Promise<string> {
  const cfg = config();
  if (!cfg) throw new GoogleError("Google Workspace isn't connected yet.");
  const key = `${subject}|${scope}`;
  const hit = tokenCache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;

  const res = await fetch(cfg.sa.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildAssertion(cfg.sa, subject, scope),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    // unauthorized_client = the scope isn't authorized in Google Admin → Domain wide delegation.
    const hint = json.error === "unauthorized_client" ? " Check the scopes in Google Admin → Domain wide delegation." : "";
    const reason = String(json.error_description || json.error || res.status).replace(/\.$/, "");
    throw new GoogleError(`Google sign-in for ${subject} failed: ${reason}.${hint}`);
  }
  tokenCache.set(key, { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

/** GET a Google API as `subject`. JSON by default; "text" or "bytes" for downloads. */
export async function googleGet<T = unknown>(subject: string, scope: string, url: string, as: "json"): Promise<T>;
export async function googleGet(subject: string, scope: string, url: string, as: "text"): Promise<string>;
export async function googleGet(subject: string, scope: string, url: string, as: "bytes"): Promise<Uint8Array>;
export async function googleGet(subject: string, scope: string, url: string, as: "json" | "text" | "bytes" = "json") {
  const token = await accessToken(subject, scope);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new GoogleError(`Google API error (${res.status}): ${body?.error?.message ?? res.statusText}`);
  }
  if (as === "text") return res.text();
  if (as === "bytes") return new Uint8Array(await res.arrayBuffer());
  return res.json();
}
