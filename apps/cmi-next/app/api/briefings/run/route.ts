// The 6 AM morning briefing, called by a Coolify Scheduled Task.
//
//   GET /api/briefings/run                 → send to BRIEFING_AUDIENCE
//   GET /api/briefings/run?to=<email>      → one test briefing to that staff member
//   GET /api/briefings/run?dry=1           → build everything, send nothing
//   GET /api/briefings/run?preview=<email> → that person's email as a web page
//
// Guarded by AUTOMATION_SECRET, like /api/automations/run.
import { NextResponse } from "next/server";
import { authorizeAutomation } from "@/lib/automations/auth";
import { runBriefings } from "@/lib/briefing/send";
import { buildBriefing, loadBriefingStaff } from "@/lib/briefing/build";
import { briefingSummary } from "@/lib/briefing/summary";
import { briefingEmailHtml } from "@/lib/email/briefing-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One AI summary per person; give a full team room to finish.
export const maxDuration = 300;

export async function POST(request: Request) {
  const denied = authorizeAutomation(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const preview = url.searchParams.get("preview")?.trim().toLowerCase();
    if (preview) {
      const person = (await loadBriefingStaff()).find((s) => s.email.toLowerCase() === preview);
      if (!person) return NextResponse.json({ error: "Not an active staff member." }, { status: 404 });
      const briefing = await buildBriefing(person);
      const summary = await briefingSummary(briefing);
      return new NextResponse(briefingEmailHtml(briefing, summary.text), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const result = await runBriefings({
      testTo: url.searchParams.get("to"),
      dryRun: url.searchParams.get("dry") === "1",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Briefing run failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
