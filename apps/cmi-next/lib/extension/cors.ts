// CORS for the Chrome extension. Requests come from the extension's
// chrome-extension:// origin with a Bearer token (no cookies), so we restrict
// the allowed origin to the configured extension ID. Until CMI_EXTENSION_ID is
// set (before the signing key is finalized), we reflect any chrome-extension://
// origin so local unpacked development works.
export function extensionOrigin(request: Request): string {
  const configured = process.env.CMI_EXTENSION_ID?.trim();
  if (configured) return `chrome-extension://${configured}`;
  const origin = request.headers.get("origin") ?? "";
  if (origin.startsWith("chrome-extension://")) return origin;
  return "*";
}

export function corsHeaders(request: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": extensionOrigin(request),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}
