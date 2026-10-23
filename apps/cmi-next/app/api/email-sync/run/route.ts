// Scheduled email reply sync, called by a Coolify Scheduled Task (every
// 10–15 minutes). Same shared-secret guard as /api/automations/run. Safe to
// call repeatedly: each Gmail message is logged once (provider_id).
import { NextResponse } from "next/server";
import { authorizeAutomation as authorize } from "@/lib/automations/auth";
import { syncEmailReplies } from "@/lib/email-sync/replies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const days = Number(new URL(request.url).searchParams.get("days")) || 30;
    const result = await syncEmailReplies({ sinceDays: Math.min(days, 90) });
    return NextResponse.json({ ok: true, ...result, errors: result.errors.slice(0, 20) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Email sync failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
