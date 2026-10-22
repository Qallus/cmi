// The consent decision from /oauth/authorize. A same-origin form POST, so the
// SameSite=strict session cookie is sent and also blocks cross-site forgery.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { mcpAccessFor } from "@/lib/mcp/auth";
import { checkAuthorizeParams, issueCode, redirectWith, type AuthorizeParams } from "@/lib/mcp/authorize";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const p = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) as AuthorizeParams & { decision?: string };

  const check = await checkAuthorizeParams(p);
  if (!check.ok) {
    if (!check.redirectable) return NextResponse.json({ error: check.message }, { status: 400 });
    return NextResponse.redirect(redirectWith(check.redirectUri, { error: check.error, error_description: check.message, state: check.state }), 303);
  }
  const { req } = check;

  if (p.decision !== "allow") {
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: "access_denied", state: req.state }), 303);
  }

  try {
    const { staff } = await requireAdmin(request);
    const access = await mcpAccessFor(staff);
    if (!access.allowed) {
      return NextResponse.redirect(redirectWith(req.redirectUri, { error: "access_denied", error_description: access.reason, state: req.state }), 303);
    }
    const code = await issueCode(req, staff.id);
    return NextResponse.redirect(redirectWith(req.redirectUri, { code, state: req.state }), 303);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent(`/oauth/authorize?${new URLSearchParams(p as Record<string, string>)}`)}`, request.url), 303);
    }
    console.error("[oauth] authorize failed", e);
    return NextResponse.redirect(redirectWith(req.redirectUri, { error: "server_error", state: req.state }), 303);
  }
}
