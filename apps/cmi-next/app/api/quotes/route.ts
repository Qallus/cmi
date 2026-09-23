import { NextRequest, NextResponse } from "next/server";
import { loadQuotes, createQuote } from "@/lib/quotes/data";
import { denyUnlessStaff } from "@/lib/auth/guard";

export async function GET() {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    return NextResponse.json(await loadQuotes());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await denyUnlessStaff(); if (denied) return denied;

  try {
    const body = await req.json();
    return NextResponse.json(await createQuote(body), { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed." }, { status: 500 });
  }
}
