// Dynamic client registration (RFC 7591) for MCP clients such as Claude.
// Public clients only (PKCE, no secret); redirect URIs must be on the allowlist
// in lib/mcp/oauth.ts or listed for an app in Settings → Claude → Clients
// (mcp_clients), so a registration alone can't send codes anywhere else. The
// matching app's kind (claude, chatgpt, codex…) decides which tiers it gets.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CORS_HEADERS, isAllowedRedirectUri, randomToken } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

const bad = (description: string) =>
  Response.json({ error: "invalid_client_metadata", error_description: description }, { status: 400, headers: CORS_HEADERS });

export async function POST(request: Request) {
  let body: { client_name?: string; redirect_uris?: unknown };
  try { body = await request.json(); } catch { return bad("Body must be JSON."); }

  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length) return bad("redirect_uris is required.");
  const supabase = getSupabaseAdmin();
  const { data: apps } = await supabase.from("mcp_clients").select("kind, redirect_uris, enabled");
  const known = (apps ?? []) as { kind: string; redirect_uris: string[] | null; enabled: boolean }[];
  const appFor = (u: string) => known.find((a) => (a.redirect_uris ?? []).includes(u));
  const rejected = uris.filter((u) => !isAllowedRedirectUri(u) && !appFor(u)?.enabled);
  if (rejected.length) return Response.json(
    { error: "invalid_redirect_uri", error_description: `Not an allowed redirect URI: ${rejected.join(", ")}` },
    { status: 400, headers: CORS_HEADERS },
  );

  const client_id = `cmi_${randomToken(16)}`;
  const client_name = (body.client_name ?? "MCP client").toString().slice(0, 120);
  const client_kind = uris.map((u) => appFor(u)?.kind).find(Boolean) ?? null;
  let { error } = await supabase.from("mcp_oauth_clients").insert({ client_id, client_name, redirect_uris: uris, client_kind });
  // Before the Phase A migration adds client_kind.
  if (error && /client_kind/.test(error.message)) ({ error } = await supabase.from("mcp_oauth_clients").insert({ client_id, client_name, redirect_uris: uris }));
  if (error) {
    console.error("[oauth] register failed", error);
    return Response.json({ error: "server_error" }, { status: 500, headers: CORS_HEADERS });
  }

  return Response.json({
    client_id, client_name, redirect_uris: uris,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  }, { status: 201, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
