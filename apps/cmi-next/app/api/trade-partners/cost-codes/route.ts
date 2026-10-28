// Trade → cost code mapping (Trade Partners → Setup).
import { NextResponse } from "next/server";
import { requirePrequal, requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { loadCostCodes, saveCostCodes } from "@/lib/prequal/trades";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    return NextResponse.json({ rows: await loadCostCodes() });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    await requirePrequalDecide(request);
    const { rows } = (await request.json()) as { rows?: { trade: string; cost_code: string | null; label?: string | null }[] };
    await saveCostCodes(Array.isArray(rows) ? rows : []);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
