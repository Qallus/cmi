// Company-wide Projections settings (default actuals source, workload threshold).
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { loadSettings, saveSettings } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    return NextResponse.json(await loadSettings());
  } catch (err) {
    return projectionErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { actor } = await requireProjections(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await saveSettings(body ?? {}, actor));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
