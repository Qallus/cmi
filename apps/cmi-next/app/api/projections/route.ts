// Projections board: GET the 12-month grid (?start=YYYY-MM), POST to add jobs
// ({ job_ids: string[] } or { all_active: true }). Admin / Super Admin only.
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/require-admin";
import { requireProjections } from "@/lib/projections/guard";
import { loadBoard, addJobs, activeJobIds, ProjectionError } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    const start = new URL(request.url).searchParams.get("start");
    return NextResponse.json(await loadBoard({ start }));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { actor } = await requireProjections(request);
    const body = await request.json().catch(() => ({}));
    const ids: string[] = body?.all_active
      ? await activeJobIds()
      : Array.isArray(body?.job_ids) ? body.job_ids.filter((v: unknown): v is string => typeof v === "string") : [];
    if (ids.length === 0) return NextResponse.json({ error: "No jobs to add." }, { status: 400 });
    return NextResponse.json(await addJobs(ids, actor), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

function errorResponse(err: unknown) {
  if (err instanceof ProjectionError || err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  return NextResponse.json({ error: (err as Error)?.message ?? "Something went wrong." }, { status: 500 });
}
