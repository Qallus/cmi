import { NextRequest, NextResponse } from "next/server";
import { loadQuotes, createQuote } from "@/lib/quotes/data";

export async function GET() {
  try {
    return NextResponse.json(await loadQuotes());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json(await createQuote(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
