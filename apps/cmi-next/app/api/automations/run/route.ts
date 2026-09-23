// The scheduled automation entry point, called by a Coolify Scheduled Task.
//
// Guarded by a shared secret rather than a session, because there's no user
// behind a cron. Safe to call twice: every event carries a unique dedupe key.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runAutomations } from "@/lib/automations/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Constant-time compare, so the secret can't be guessed a character at a time. */
function secretOk(provided: string | null): boolean {
  const expected = process.env.AUTOMATION_SECRET;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authorize(request: Request): NextResponse | null {
  if (!process.env.AUTOMATION_SECRET) {
    return NextResponse.json({ error: "AUTOMATION_SECRET is not configured." }, { status: 503 });
  }
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-automation-secret");
  if (!secretOk(token)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  return null;
}

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    // AUTOMATION_ENABLED must be "true" before anything is actually delivered.
    // Until then the run scans and logs exactly what it would send, which is
    // how you watch it for a few days before letting it speak to anyone.
    const live = process.env.AUTOMATION_ENABLED === "true";
    const dryRun = url.searchParams.get("dry") === "1" || !live;

    const summary = await runAutomations({ trigger: dryRun ? "scheduled (dry run)" : "scheduled", dryRun });
    return NextResponse.json({ ok: true, dry_run: dryRun, ...summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Automation run failed." }, { status: 500 });
  }
}

// Same thing over GET, so a scheduled task can be a plain curl with no body.
export async function GET(request: Request) {
  return POST(request);
}
