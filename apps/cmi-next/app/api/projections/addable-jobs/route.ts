// Jobs that can be added to Projections (real, non-archived, not already in).
import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/require-admin";
import { requireProjections } from "@/lib/projections/guard";
import { listAddableJobs } from "@/lib/projections/data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProjections(request);
    return NextResponse.json(await listAddableJobs());
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
