// "Attach to…" picker: search Jobs, Pre-Con and Pipeline deals by name or number.
import { NextResponse } from "next/server";
import { searchTargets } from "@/lib/punch/data";
import { punchError, punchSession } from "@/lib/punch/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await punchSession(request, false);
    return NextResponse.json(await searchTargets(new URL(request.url).searchParams.get("q") ?? ""));
  } catch (err) {
    return punchError(err);
  }
}
