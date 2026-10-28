// Place trade partners on the Directory map: geocodes a small batch of
// companies that have an address but no coordinates yet.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { locateMissing } from "@/lib/companies/locate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requirePrequal(request);
    return NextResponse.json({ ok: true, ...(await locateMissing(20)) });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
