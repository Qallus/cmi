// Token endpoint: authorization_code (PKCE S256) and refresh_token (rotated).
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  ACCESS_TTL_S, CORS_HEADERS, MCP_SCOPE, REFRESH_TTL_S, randomToken, sha256, verifyPkce,
} from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const NO_STORE = { ...CORS_HEADERS, "Cache-Control": "no-store", Pragma: "no-cache" };
const err = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: NO_STORE });

async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([k, v]) => [k, String(v ?? "")]));
  }
  return Object.fromEntries(new URLSearchParams(await request.text()));
}

async function issue(clientId: string, staffUserId: string, scope: string) {
  const access = randomToken();
  const refresh = randomToken();
  const now = Date.now();
  const { error } = await getSupabaseAdmin().from("mcp_oauth_tokens").insert({
    token_hash: sha256(access),
    refresh_hash: sha256(refresh),
    client_id: clientId,
    staff_user_id: staffUserId,
    scope,
    expires_at: new Date(now + ACCESS_TTL_S * 1000).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TTL_S * 1000).toISOString(),
  });
  if (error) throw error;
  return Response.json(
    { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope },
    { headers: NO_STORE },
  );
}

export async function POST(request: Request) {
  const p = await readParams(request);
  const supabase = getSupabaseAdmin();

  try {
    if (p.grant_type === "authorization_code") {
      if (!p.code || !p.code_verifier || !p.client_id) return err("invalid_request", "code, code_verifier and client_id are required.");
      const { data: code } = await supabase.from("mcp_oauth_codes").select("*").eq("code_hash", sha256(p.code)).maybeSingle();
      if (!code || code.used_at || new Date(code.expires_at).getTime() < Date.now()) return err("invalid_grant", "The code is invalid or expired.");
      if (code.client_id !== p.client_id) return err("invalid_grant", "The code was issued to a different client.");
      if (p.redirect_uri && p.redirect_uri !== code.redirect_uri) return err("invalid_grant", "redirect_uri doesn't match.");
      if (!verifyPkce(p.code_verifier, code.code_challenge)) return err("invalid_grant", "PKCE verification failed.");

      // Single use: only the request that flips used_at wins.
      const { data: claimed } = await supabase.from("mcp_oauth_codes")
        .update({ used_at: new Date().toISOString() }).eq("code_hash", code.code_hash).is("used_at", null).select("code_hash");
      if (!claimed?.length) return err("invalid_grant", "The code was already used.");

      return await issue(code.client_id, code.staff_user_id, code.scope || MCP_SCOPE);
    }

    if (p.grant_type === "refresh_token") {
      if (!p.refresh_token) return err("invalid_request", "refresh_token is required.");
      const { data: row } = await supabase.from("mcp_oauth_tokens")
        .select("id, client_id, staff_user_id, scope, revoked_at, refresh_expires_at")
        .eq("refresh_hash", sha256(p.refresh_token)).maybeSingle();
      if (!row || row.revoked_at || !row.refresh_expires_at || new Date(row.refresh_expires_at).getTime() < Date.now()) {
        return err("invalid_grant", "The refresh token is invalid or expired.");
      }
      if (p.client_id && p.client_id !== row.client_id) return err("invalid_grant", "The refresh token was issued to a different client.");

      // Rotate: retire the old pair, then issue a new one. Status and role are
      // re-checked on every /api/mcp call, so a suspended account gets nothing.
      const { data: retired } = await supabase.from("mcp_oauth_tokens")
        .update({ revoked_at: new Date().toISOString() }).eq("id", row.id).is("revoked_at", null).select("id");
      if (!retired?.length) return err("invalid_grant", "The refresh token was already used.");

      return await issue(row.client_id, row.staff_user_id, row.scope || MCP_SCOPE);
    }

    return err("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (e) {
    console.error("[oauth] token failed", e);
    return err("server_error", "Couldn't issue a token.", 500);
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
