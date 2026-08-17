import { NextResponse } from "next/server";
import { requireWorkspaceAccess } from "@/lib/workspace/auth";
import { updateDocument, deleteDocument, restoreDocument, purgeDocument } from "@/lib/workspace/repository";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const actor = await requireWorkspaceAccess(request, body.actionToken);
    if (body.restore === true) {
      await restoreDocument(id, actor.id);
      return NextResponse.json({ ok: true });
    }
    const result = await updateDocument(
      id,
      {
        title: typeof body.title === "string" ? body.title : undefined,
        content: body.content !== undefined ? body.content : undefined,
        folderId: body.folderId !== undefined ? (body.folderId || null) : undefined,
        scope: body.scope === "shared" || body.scope === "personal" ? body.scope : undefined,
        status: typeof body.status === "string" ? body.status : undefined,
        expectedUpdatedAt: typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined,
        force: body.force === true,
      },
      actor.id,
    );
    // Stale-write guard: the doc changed on another device since this editor loaded.
    if (result.conflict) return NextResponse.json({ conflict: true, serverUpdatedAt: result.serverUpdatedAt }, { status: 409 });
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save document.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    await requireWorkspaceAccess(request, body.actionToken);
    if (body.purge === true) await purgeDocument(id); // permanent delete from the trash
    else await deleteDocument(id); // soft delete → trash
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete document.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
