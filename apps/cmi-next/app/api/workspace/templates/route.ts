import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/workspace/auth";
import { hideTemplate, unhideTemplate, favoriteTemplate } from "@/lib/workspace/repository";

// PATCH toggles a per-user favorite on a template.
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const templateId = String(body.templateId ?? "").trim();
    if (!templateId) return NextResponse.json({ error: "A template is required." }, { status: 400 });
    await favoriteTemplate(actor.id, templateId, body.favorite !== false);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update favorite.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST hides (deletes) a built-in template from the gallery; DELETE restores it.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const actor = await requireSuperAdmin(request, body.actionToken);
    const templateId = String(body.templateId ?? "").trim();
    if (!templateId) return NextResponse.json({ error: "A template is required." }, { status: 400 });
    await hideTemplate(templateId, actor.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to hide template.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    await requireSuperAdmin(request, body.actionToken);
    const templateId = String(body.templateId ?? "").trim();
    if (!templateId) return NextResponse.json({ error: "A template is required." }, { status: 400 });
    await unhideTemplate(templateId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to restore template.";
    const status = message.includes("permission") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
