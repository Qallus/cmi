// Everything missing, rejected, expired or expiring.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { loadComplianceWorklist } from "@/lib/companies/directory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    const days = Number(new URL(request.url).searchParams.get("days") ?? 60);
    return NextResponse.json(await loadComplianceWorklist(Number.isFinite(days) ? days : 60));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
