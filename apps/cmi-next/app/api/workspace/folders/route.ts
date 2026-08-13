import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { createFolder } from "@/lib/workspace/repository";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Folder name is required." }, { status: 400 });
    const scope = body.scope === "shared" ? "shared" : "personal";
    const result = await createFolder({ name, scope, parentId: body.parentId ?? null, workspaceId: body.workspaceId ?? null }, actor.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create folder.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
