// Edit one forecast month: { month: "YYYY-MM", amount, mode: "leave" | "redistribute" }.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { setMonth } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requireProjections(request);
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const mode = body?.mode === "redistribute" ? "redistribute" : body?.mode === "leave" ? "leave" : null;
    if (!mode || typeof body?.month !== "string") return NextResponse.json({ error: "month and mode are required." }, { status: 400 });
    await setMonth(id, { month: body.month, amount: Number(body.amount), mode }, actor);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
