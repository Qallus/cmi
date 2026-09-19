// Save reviewed billing rows as csv_import actuals.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { importActuals } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { actor } = await requireProjections(request);
    const body = await request.json().catch(() => null);
    if (!Array.isArray(body?.rows)) return NextResponse.json({ error: "rows are required." }, { status: 400 });
    const rows = (body.rows as Record<string, unknown>[]).map((r) => ({
      projection_id: String(r.projection_id ?? ""),
      date: String(r.date ?? ""),
      amount: Number(r.amount),
      external_ref: String(r.external_ref ?? ""),
      note: r.note ? String(r.note).slice(0, 500) : null,
    }));
    return NextResponse.json(await importActuals(rows, body.switch_source === true, actor), { status: 201 });
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
