// Insurance minimums (Trade Partners → Setup): read by anyone in Trade
// Partners, changed by Super Admin / Admin.
import { NextResponse } from "next/server";
import { requirePrequal, requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { loadMinimumsSettings, saveMinimumsSettings } from "@/lib/prequal/minimums";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    return NextResponse.json({ minimums: await loadMinimumsSettings() });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function PUT(request: Request) {
  try {
    const { actor } = await requirePrequalDecide(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ minimums: await saveMinimumsSettings(body?.minimums, actor.id) });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
