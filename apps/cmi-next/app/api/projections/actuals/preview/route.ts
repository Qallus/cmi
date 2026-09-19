// Match parsed billing-export rows to projections before importing.
import { NextResponse } from "next/server";
import { requireProjections, projectionErrorResponse } from "@/lib/projections/guard";
import { previewImport, type ImportRowInput } from "@/lib/projections/data";

export const dynamic = "force-dynamic";
const MAX_ROWS = 5000;

export async function POST(request: Request) {
  try {
    await requireProjections(request);
    const body = await request.json().catch(() => null);
    const rows = Array.isArray(body?.rows) ? (body.rows as ImportRowInput[]) : null;
    if (!rows?.length) return NextResponse.json({ error: "No rows to preview." }, { status: 400 });
    if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Import up to ${MAX_ROWS} rows at a time.` }, { status: 400 });
    const clean = rows.map((r) => ({
      customer: r.customer ? String(r.customer).slice(0, 200) : null,
      job: r.job ? String(r.job).slice(0, 200) : null,
      date: String(r.date ?? ""),
      amount: Number(r.amount),
      ref: r.ref ? String(r.ref).slice(0, 200) : null,
      memo: r.memo ? String(r.memo).slice(0, 500) : null,
    }));
    return NextResponse.json(await previewImport(clean));
  } catch (err) {
    return projectionErrorResponse(err);
  }
}
