// Convert a Lead (quote or contact) into an Opportunity — the moment a job
// number is created. Body: { source: "quote" | "contact", id, overrides?: {...} }.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { convertQuoteToOpportunity, convertContactToOpportunity } from "@/lib/pipeline/data";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireAdmin(request);
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 401 });
  }
  const { user, staff } = ctx;
  if (!WRITE_ROLES.includes(staff.role_slug)) {
    return NextResponse.json({ error: `Your role (${staff.role_slug}) can't create opportunities.` }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as
    | { source?: "quote" | "contact"; id?: string; overrides?: Record<string, unknown> }
    | null;
  if (!body?.source || !body.id) {
    return NextResponse.json({ error: "Missing `source` and `id`." }, { status: 400 });
  }

  const actor = { name: user.email, id: staff.id };
  try {
    const opp = body.source === "quote"
      ? await convertQuoteToOpportunity(body.id, (body.overrides ?? {}) as never, actor)
      : await convertContactToOpportunity(body.id, (body.overrides ?? {}) as never, actor);
    return NextResponse.json(opp, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Conversion failed." }, { status: 400 });
  }
}
