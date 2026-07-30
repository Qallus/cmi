// Stable image src for note bodies. A note's HTML embeds
// /api/notes/image?path=<objectPath>; this checks the staff session and
// redirects to a fresh signed URL, so the src never expires the way a raw
// signed URL embedded in stored HTML would.
import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { getNoteMediaUrl } from "@/lib/notes/storage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const path = new URL(request.url).searchParams.get("path")?.trim();
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const url = await getNoteMediaUrl(path);
  if (!url) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.redirect(url);
}
