// Requalification: send selected partners a pre-filled update form (POST),
// or leave a partner out of "select all" sends (PATCH). Super Admin / Admin.
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { startRequalification } from "@/lib/prequal/requalify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const { actor } = await requirePrequalDecide(request);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.company_ids) ? body.company_ids.filter((x: unknown): x is string => typeof x === "string") : [];
    const result = await startRequalification(ids, {
      message: typeof body?.message === "string" ? body.message.slice(0, 4000) : null,
      includeMsa: !!body?.include_msa,
      force: !!body?.force,
      actorId: actor.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePrequalDecide(request);
    const body = await request.json().catch(() => ({}));
    if (typeof body?.company_id !== "string") return NextResponse.json({ error: "Which company?" }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("companies")
      .update({ requal_excluded: !!body.excluded, updated_at: new Date().toISOString() }).eq("id", body.company_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
