// OAuth 2.1 helpers for the CMI MCP server. The app is its own authorization
// server: Claude registers (DCR), sends the staff member to /oauth/authorize,
// and swaps the code (PKCE S256) for an opaque bearer token. We never hand out
// the Supabase session JWT, and only SHA-256 hashes of codes/tokens are stored.
import { publicAppUrl } from "@/lib/twilio";

export { randomToken, sha256, verifyPkce } from "./pkce";

export const ACCESS_TTL_S = 60 * 60;             // 1 hour
export const REFRESH_TTL_S = 30 * 24 * 60 * 60;  // 30 days, rotated on use
export const CODE_TTL_S = 5 * 60;
export const MCP_SCOPE = "cmi";

export function baseUrl(): string {
  return publicAppUrl().replace(/\/+$/, "");
}
export const mcpResourceUrl = () => `${baseUrl()}/api/mcp`;
export const resourceMetadataUrl = () => `${baseUrl()}/.well-known/oauth-protected-resource`;

// Claude's connector callbacks, plus loopback for MCP Inspector / local tools.
// MCP_EXTRA_REDIRECT_URIS (comma-separated, exact match) adds more.
const CLAUDE_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];

export function isAllowedRedirectUri(uri: string): boolean {
  let u: URL;
  try { u = new URL(uri); } catch { return false; }
  if (u.hash) return false;
  if (CLAUDE_CALLBACKS.includes(uri)) return true;
  const extra = (process.env.MCP_EXTRA_REDIRECT_URIS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (extra.includes(uri)) return true;
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, WWW-Authenticate",
};

export function authServerMetadata() {
  const base = baseUrl();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [MCP_SCOPE],
  };
}

export function protectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [baseUrl()],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Constructed Matter (CMI)",
  };
}
