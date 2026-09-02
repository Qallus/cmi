// Add to Pipeline — convert one or more Contacts / Leads (quotes) / Form
// submissions into deals. Idempotent per source (a source already in the
// pipeline returns its existing deal, created:false).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { addContactToPipeline, addQuoteToPipeline, addSubmissionToPipeline, type AddResult } from "@/lib/deals/data";
import type { DealDraft } from "@/lib/deals/types";

const WRITE_ROLES = ["super_admin", "admin", "project_manager", "estimator"];

type Body = {
  source_type: "contact" | "quote" | "contact_submission";
  ids: string[];
  overrides?: Partial<DealDraft>;
};

export async function POST(request: Request) {
  try {
    const { user, staff } = await requireAdmin(request);
    if (!WRITE_ROLES.includes(staff.role_slug)) {
      return NextResponse.json({ error: `Your role (${staff.role_slug}) can't add to the pipeline.` }, { status: 403 });
    }
    const body = (await request.json()) as Body;
    const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];
    if (!ids.length) return NextResponse.json({ error: "No records selected." }, { status: 400 });

    const actor = { name: user.email, id: staff.id };
    const overrides = body.overrides ?? {};
    const add = (id: string): Promise<AddResult> => {
      switch (body.source_type) {
        case "contact": return addContactToPipeline(id, overrides, actor);
        case "quote": return addQuoteToPipeline(id, overrides, actor);
        case "contact_submission": return addSubmissionToPipeline(id, overrides, actor);
        default: throw new AuthError("Invalid source type.", 400);
      }
    };

    const results = await Promise.all(ids.map(add));
    return NextResponse.json({
      created: results.filter((r) => r.created).map((r) => r.deal),
      existing: results.filter((r) => !r.created).map((r) => r.deal),
    }, { status: 201 });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
