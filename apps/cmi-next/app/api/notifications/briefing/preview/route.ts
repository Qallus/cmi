// A staff member's morning briefing email, rendered as a page and not sent.
// Super Admin only; opened in a new tab from the Morning Briefing tab.
import { NextResponse } from "next/server";
import { requireSuperAdmin, AuthError } from "@/lib/auth/require-admin";
import { buildBriefing, loadBriefingStaff } from "@/lib/briefing/build";
import { briefingSummary } from "@/lib/briefing/summary";
import { briefingEmailHtml } from "@/lib/email/briefing-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request);
    const url = new URL(request.url);
    const id = url.searchParams.get("staffId");
    const person = (await loadBriefingStaff()).find((s) => s.id === id);
    if (!person) return NextResponse.json({ error: "Not a staff member." }, { status: 404 });
    const briefing = await buildBriefing(person);
    const summary = await briefingSummary(briefing, { useAi: url.searchParams.get("ai") !== "0" });
    return new NextResponse(briefingEmailHtml(briefing, summary.text), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err instanceof Error ? err.message : "Preview failed." }, { status: 500 });
  }
}
