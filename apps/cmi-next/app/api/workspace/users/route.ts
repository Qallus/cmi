import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { listMentionableUsers } from "@/lib/workspace/comments";

export async function GET(request: Request) {
  try {
    await requireWorkspaceAccess(request);
    const users = await listMentionableUsers();
    return NextResponse.json({ ok: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load users.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
