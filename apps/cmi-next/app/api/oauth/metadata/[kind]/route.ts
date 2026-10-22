// OAuth discovery for the MCP server, served at the standard paths through
// rewrites in next.config.ts:
//   /.well-known/oauth-authorization-server[/…] → kind = authorization-server
//   /.well-known/oauth-protected-resource[/…]   → kind = protected-resource
import { authServerMetadata, CORS_HEADERS, protectedResourceMetadata } from "@/lib/mcp/oauth";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const body = kind === "authorization-server" ? authServerMetadata()
    : kind === "protected-resource" ? protectedResourceMetadata()
    : null;
  if (!body) return Response.json({ error: "not_found" }, { status: 404, headers: CORS_HEADERS });
  return Response.json(body, { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
