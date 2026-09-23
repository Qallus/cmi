// The trade partner directory: who can do what, where, at what size.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { loadDirectory, type ComplianceState } from "@/lib/companies/directory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequal(request);
    const q = new URL(request.url).searchParams;
    const value = q.get("value");
    return NextResponse.json(await loadDirectory({
      q: q.get("q"),
      trade: q.get("trade"),
      area: q.get("area"),
      status: q.get("status"),
      compliance: (q.get("compliance") as ComplianceState | "any" | null) ?? null,
      projectValue: value ? Number(value) : null,
    }));
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
