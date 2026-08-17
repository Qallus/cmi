import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { listDocumentVersions, restoreDocumentVersion } from "@/lib/workspace/repository";

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Version action failed.";
  const status = message.includes("permission") || message.includes("Authentication") ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireWorkspaceAccess(request);
    const versions = await listDocumentVersions(id);
    return NextResponse.json({ ok: true, versions });
  } catch (error) {
    return fail(error);
  }
}

// Restore a prior version (snapshots the current content first, so it's undoable).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = await requireWorkspaceAccess(request, body.actionToken);
    if (!body.versionId) return NextResponse.json({ error: "A version is required." }, { status: 400 });
    const result = await restoreDocumentVersion(id, String(body.versionId), actor.id);
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch (error) {
    return fail(error);
  }
}
