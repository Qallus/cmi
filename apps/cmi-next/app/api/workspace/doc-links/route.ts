import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { listLinkableDocuments, listWorkspaces } from "@/lib/workspace/repository";

// Powers the "#" document-link picker in the Workspace editor.
export async function GET(request: Request) {
  try {
    const actor = await requireSuperAdmin(request);
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const ws = url.searchParams.get("ws") ?? "";
    const [docs, workspaces] = await Promise.all([listLinkableDocuments(actor.id, q, ws || undefined), listWorkspaces()]);
    return NextResponse.json({ ok: true, docs, workspaces });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load documents.";
    const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
