import { NextResponse } from "next/server";
import { requireExtensionAccess, ExtensionAuthError } from "@/lib/extension/require-extension-access";
import { corsHeaders, preflight } from "@/lib/extension/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return preflight(request);
}

// Validate the token + extension access flag; return identity for the panel.
export async function GET(request: Request) {
  const headers = corsHeaders(request);
  try {
    const ctx = await requireExtensionAccess(request);
    const name =
      ctx.staff.display_name ||
      [ctx.staff.first_name, ctx.staff.last_name].filter(Boolean).join(" ").trim() ||
      ctx.user.email;
    return NextResponse.json(
      {
        ok: true,
        user: { id: ctx.user.id, email: ctx.user.email },
        staff: { id: ctx.staff.id, name, role: ctx.staff.role_slug },
        organization_id: ctx.organizationId,
      },
      { headers },
    );
  } catch (e) {
    if (e instanceof ExtensionAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status, headers });
    }
    return NextResponse.json({ error: "Session check failed." }, { status: 500, headers });
  }
}
