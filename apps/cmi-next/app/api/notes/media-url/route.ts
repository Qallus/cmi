// Exchange a stored attachment path for a short-lived signed read URL.
import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { getNoteMediaUrl } from "@/lib/notes/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = (await request.json().catch(() => ({}))) as { path?: string };
  if (!path) return NextResponse.json({ error: "path is required." }, { status: 400 });

  const url = await getNoteMediaUrl(path.trim());
  if (!url) return NextResponse.json({ error: "Could not sign this media." }, { status: 500 });
  return NextResponse.json({ url });
}
