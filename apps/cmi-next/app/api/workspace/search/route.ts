import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { searchDocuments } from "@/lib/workspace/repository";

export async function GET(request: Request) {
  try {
    const actor = await requireWorkspaceAccess(request);
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const results = await searchDocuments(actor.id, q);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
