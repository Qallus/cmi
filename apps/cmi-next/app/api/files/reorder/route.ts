// Persist a drag-and-drop order in one call:
//   POST { items: [{ id, kind: "file" | "folder", sort_order }] }
// Each item is permission-checked like any other edit.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { getFile, getFolder, updateFile, updateFolder, canModify } from "@/lib/files/data";

export const dynamic = "force-dynamic";
const MAX_ITEMS = 500;

type Item = { id: string; kind: "file" | "folder"; sort_order: number };

export async function POST(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const body = await request.json().catch(() => null) as { items?: Item[] } | null;
    const items = (body?.items ?? []).filter((i) => i && typeof i.id === "string" && (i.kind === "file" || i.kind === "folder") && Number.isFinite(i.sort_order));
    if (!items.length) return NextResponse.json({ error: "No items to reorder." }, { status: 400 });
    if (items.length > MAX_ITEMS) return NextResponse.json({ error: `Reorder up to ${MAX_ITEMS} items at a time.` }, { status: 400 });

    let updated = 0, skipped = 0;
    for (const item of items) {
      const row = item.kind === "folder" ? await getFolder(item.id) : await getFile(item.id);
      if (!row || !canModify(row, staff)) { skipped += 1; continue; }
      if (item.kind === "folder") await updateFolder(item.id, { sort_order: item.sort_order });
      else await updateFile(item.id, { sort_order: item.sort_order });
      updated += 1;
    }
    return NextResponse.json({ updated, skipped });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
