// Cloud file manager — list view (folders + files) by scope.
import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth/require-admin";
import { listFolders, listFiles, searchFiles, storageUsedBytes } from "@/lib/files/data";
import { storageConfigured } from "@/lib/files/s3";

export async function GET(request: Request) {
  try {
    const { staff } = await requireAdmin(request);
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "browse";
    const projectParam = url.searchParams.get("project"); // absent = all, "general" = null, else id
    const folderId = url.searchParams.get("folder");
    const q = url.searchParams.get("q") || "";
    const projectId = projectParam === "general" ? null : projectParam || undefined;

    let folders: unknown[] = [];
    let files: unknown[] = [];

    if (view === "search") {
      files = q.trim() ? await searchFiles(q.trim()) : [];
    } else if (view === "trash") {
      [folders, files] = await Promise.all([listFolders({ trashed: true }), listFiles({ trashed: true })]);
    } else if (view === "my") {
      files = await listFiles({ uploadedBy: staff.id });
    } else if (view === "recent") {
      files = await listFiles({ recent: true });
    } else {
      [folders, files] = await Promise.all([
        listFolders({ projectId, folderId }),
        listFiles({ projectId, folderId }),
      ]);
    }

    return NextResponse.json({
      folders, files,
      me: staff.id,
      storageUsed: await storageUsedBytes(),
      storageOnline: storageConfigured(),
    });
  } catch (err) {
    const e = err as AuthError;
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
