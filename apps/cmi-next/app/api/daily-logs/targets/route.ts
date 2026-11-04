// What a daily log can be filed against: active Jobs and Pre-Con opportunities.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { loadLogTargets } from "@/lib/daily-logs/data";
import { fieldReportsOn } from "@/lib/daily-logs/reports";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    // Field Reports: daily logs are for Jobs only.
    const [targets, jobsOnly] = await Promise.all([loadLogTargets(), fieldReportsOn()]);
    return NextResponse.json(jobsOnly ? targets.filter((t) => t.kind === "job") : targets);
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't load." }, { status: 500 });
  }
}
