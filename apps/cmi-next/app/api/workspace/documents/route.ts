import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { createDocument } from "@/lib/workspace/repository";
import { getTemplateContent, WORKSPACE_TEMPLATES } from "@/lib/workspace/templates";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const scope = body.scope === "shared" ? "shared" : "personal";
    const template = body.templateId ? WORKSPACE_TEMPLATES.find((t) => t.id === body.templateId) : null;
    const content = body.templateId ? getTemplateContent(body.templateId) ?? undefined : undefined;
    const title = typeof body.title === "string" ? body.title : template && template.id !== "blank" ? template.name : undefined;
    const result = await createDocument({ title, scope, folderId: body.folderId ?? null, content, workspaceId: body.workspaceId ?? null }, actor.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create document.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
