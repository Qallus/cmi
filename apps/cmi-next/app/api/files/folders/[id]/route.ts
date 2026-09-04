// Single folder: rename / move / trash / restore (PATCH) and permanent delete (DELETE, purges subtree).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getFolder, updateFolder, purgeFolder, canModify } from "@/lib/files/data";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const folder = await getFolder(id);
    if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    if (!canModify(folder, staff)) return NextResponse.json({ error: "You can only change folders you created." }, { status: 403 });

    const body = await request.json() as { name?: string; parent_id?: string | null; trash?: boolean; restore?: boolean };
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim() || folder.name;
    if ("parent_id" in body) patch.parent_id = body.parent_id ?? null;
    if (body.trash) patch.deleted_at = new Date().toISOString();
    if (body.restore) patch.deleted_at = null;
    return NextResponse.json({ folder: await updateFolder(id, patch) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const folder = await getFolder(id);
    if (!folder) return NextResponse.json({ error: "Folder not found." }, { status: 404 });
    if (!canModify(folder, staff)) return NextResponse.json({ error: "You can only delete folders you created." }, { status: 403 });
    await purgeFolder(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
