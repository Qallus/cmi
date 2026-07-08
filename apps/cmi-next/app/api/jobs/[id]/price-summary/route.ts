import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { buildPriceSummary, JobError } from "@/lib/jobs/data";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json(await buildPriceSummary(id));
  } catch (err) {
    if (err instanceof JobError) return NextResponse.json({ error: err.message }, { status: err.status });
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
