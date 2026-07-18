// Public feature-flag read for client components to gate UI (nav entries, etc.).
// Returns only booleans keyed by flag name — no secrets. Feature on/off is not
// sensitive; the actual data behind a feature is still route-guarded.
import { NextResponse } from "next/server";
import { loadFlags } from "@/lib/flags";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const flags = await loadFlags();
    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ flags: {} });
  }
}
