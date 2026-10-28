// Likely-duplicate companies (GET) and merging one into another (POST).
// Merging is a decision — Super Admin / Admin only.
import { NextResponse } from "next/server";
import { requirePrequalDecide, prequalErrorResponse } from "@/lib/prequal/guard";
import { loadDuplicatePairs, mergeCompanies } from "@/lib/companies/merge";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePrequalDecide(request);
    return NextResponse.json({ pairs: await loadDuplicatePairs() });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { actor } = await requirePrequalDecide(request);
    const { survivor_id, duplicate_id } = (await request.json()) as { survivor_id?: string; duplicate_id?: string };
    if (!survivor_id || !duplicate_id) return NextResponse.json({ error: "Choose which company to keep." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await mergeCompanies(survivor_id, duplicate_id, actor.id)) });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
