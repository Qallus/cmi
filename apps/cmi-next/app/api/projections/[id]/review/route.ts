// "New actuals — review forecast": { mode: "keep" | "redistribute" }.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { reviewActuals, loadDetail } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mode = body?.mode === "redistribute" ? "redistribute" : body?.mode === "keep" ? "keep" : null;
    if (!mode) return NextResponse.json({ error: "mode must be keep or redistribute." }, { status: 400 });
    await reviewActuals(id, mode, actor);
    return NextResponse.json(await loadDetail(id));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
