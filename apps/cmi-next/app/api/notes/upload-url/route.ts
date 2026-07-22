// Issue a signed upload URL for a note attachment. Objects are namespaced under
// the acting staff id so media-url access can key off the path prefix.
import { NextResponse } from "next/server";
import { getSessionStaff } from "@/lib/auth/server-session";
import { createNoteUploadUrl } from "@/lib/notes/storage";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const staff = await getSessionStaff();
  if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { filename?: string };
  const result = await createNoteUploadUrl(staff.id, body.filename?.trim() || "upload");
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
