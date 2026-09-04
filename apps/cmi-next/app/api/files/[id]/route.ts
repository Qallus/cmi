// Single file: rename / move / trash / restore (PATCH) and permanent delete (DELETE).
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getFile, updateFile, purgeFile, canModify } from "@/lib/files/data";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    if (!canModify(file, staff)) return NextResponse.json({ error: "You can only change files you uploaded." }, { status: 403 });

    const body = await request.json() as { name?: string; folder_id?: string | null; trash?: boolean; restore?: boolean };
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string") patch.name = body.name.trim() || file.name;
    if ("folder_id" in body) patch.folder_id = body.folder_id ?? null;
    if (body.trash) patch.deleted_at = new Date().toISOString();
    if (body.restore) patch.deleted_at = null;
    return NextResponse.json({ file: await updateFile(id, patch) });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { staff } = await requireAdmin(request);
    const { id } = await params;
    const file = await getFile(id);
    if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });
    if (!canModify(file, staff)) return NextResponse.json({ error: "You can only delete files you uploaded." }, { status: 403 });
    await purgeFile(file);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
