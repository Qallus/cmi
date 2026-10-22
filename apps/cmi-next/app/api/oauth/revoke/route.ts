// Token revocation (RFC 7009). Accepts an access or refresh token; always 200.
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { CORS_HEADERS, sha256 } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const params = type.includes("application/json")
    ? ((await request.json().catch(() => ({}))) as Record<string, string>)
    : Object.fromEntries(new URLSearchParams(await request.text()));
  const token = params.token;
  if (token) {
    const hash = sha256(token);
    await getSupabaseAdmin().from("mcp_oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .or(`token_hash.eq.${hash},refresh_hash.eq.${hash}`)
      .is("revoked_at", null);
  }
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
