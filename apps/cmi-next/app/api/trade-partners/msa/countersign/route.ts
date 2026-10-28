// Countersign a trade partner's MSA: regenerates the executed PDF and emails it.
import { NextResponse } from "next/server";
import { requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { countersign } from "@/lib/prequal/msa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { staff, user } = await requirePrequalDecide(request);
    const { signature_id } = (await request.json()) as { signature_id?: string };
    if (!signature_id) return NextResponse.json({ error: "Which signature?" }, { status: 400 });
    const name = (staff as { display_name?: string | null }).display_name || user.email || "Constructed Matter";
    const sig = await countersign(signature_id, { id: staff.id, name });
    return NextResponse.json({ ok: true, countersigned_at: sig.countersigned_at });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
