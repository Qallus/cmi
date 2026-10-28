// Re-read a compliance document with Claude (COI coverages, W-9, license).
// Runs inline so the drawer can show the result straight away.
import { NextResponse } from "next/server";
import { requirePrequal, prequalErrorResponse } from "@/lib/prequal/guard";
import { aiReaderConfigured, readDocument } from "@/lib/prequal/ai-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePrequal(request);
    if (!aiReaderConfigured()) return NextResponse.json({ error: "Set ANTHROPIC_API_KEY to read documents automatically." }, { status: 503 });
    const result = await readDocument((await params).id);
    if (result.status === "failed") return NextResponse.json({ error: result.error ?? "Couldn't read that document." }, { status: 502 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return prequalErrorResponse(err);
  }
}
