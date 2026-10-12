// What a daily log can be filed against: active Jobs and Pre-Con opportunities.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadLogTargets } from "@/lib/daily-logs/data";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(await loadLogTargets());
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load." }, { status: 500 });
  }
}
