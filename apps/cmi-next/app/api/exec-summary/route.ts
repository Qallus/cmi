// Executive summaries already sent for a Job or Pre-Con: GET ?target=job|precon&id=…
import { NextResponse } from "next/server";
import { loadHistory } from "@/lib/exec-summary/deliver";
import { parseTarget, summaryError, summarySession } from "@/lib/exec-summary/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await summarySession(request);
    const sp = new URL(request.url).searchParams;
    const t = parseTarget(sp.get("target"), sp.get("id"));
    if (!t) return NextResponse.json({ error: "Unknown record." }, { status: 400 });
    return NextResponse.json(await loadHistory(t.target, t.id));
  } catch (err) {
    return summaryError(err);
  }
}
